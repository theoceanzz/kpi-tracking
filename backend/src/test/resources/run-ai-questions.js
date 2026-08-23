/**
 * Chạy bộ câu hỏi kiểm thử tool AI và chấm kết quả.
 *
 *   node run-ai-questions.js [--group A|B|C|D] [--log <duong-dan-log-backend>] [--out ket-qua.json]
 *
 * Cần backend đang chạy ở :8081. Truyền --log để đọc được TOOL nào thực sự chạy và NHÓM nào
 * router chọn (backend ghi "AI-TOOL-CALL <tên>" và "Router chọn [...]"); không truyền thì vẫn
 * chấm được nội dung câu trả lời, chỉ không kiểm được chuỗi tool.
 *
 * Dùng Node chứ KHÔNG dùng bash: Git Bash làm hỏng UTF-8 tiếng Việt khi đi qua sed/printf,
 * request tới backend sẽ chết với "Invalid UTF-8 middle byte".
 */
const fs = require('fs');
const path = require('path');

const BASE = process.env.AI_TEST_BASE || 'http://localhost:8081/api/v1';
const BANK = JSON.parse(fs.readFileSync(path.join(__dirname, 'ai-questions.json'), 'utf8'));

const args = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const onlyGroup = (argOf('--group', '') || '').toUpperCase();
const LOG_PATH = argOf('--log', process.env.AI_TEST_LOG || '');
const OUT_PATH = argOf('--out', 'ai-questions-result.json');

/** Câu trả lời "chịu thua" của chính hệ thống — đếm là hỏng, trừ nhóm D nơi từ chối là ĐÚNG. */
const GAVE_UP = /trục trặc khi xử lý|không tạo được câu trả lời|hết hạn mức token/i;

// ── đọc log backend để lấy chuỗi tool + nhóm router ──────────────────────────
let logCursor = 0;
function markLog() {
  if (!LOG_PATH) return;
  try { logCursor = fs.statSync(LOG_PATH).size; } catch { logCursor = 0; }
}
function readLogSince() {
  if (!LOG_PATH) return { tools: [], groups: [] };
  let text = '';
  try {
    const fd = fs.openSync(LOG_PATH, 'r');
    const size = fs.statSync(LOG_PATH).size;
    if (size > logCursor) {
      const buf = Buffer.alloc(size - logCursor);
      fs.readSync(fd, buf, 0, buf.length, logCursor);
      text = buf.toString('utf8');
    }
    fs.closeSync(fd);
  } catch { /* log không đọc được thì bỏ qua, không làm hỏng lượt chấm */ }

  const tools = [...text.matchAll(/AI-TOOL-CALL (\w+)/g)].map(m => m[1]);

  // Nhóm HIỆU LỰC là thứ quyết định model cầm được tool nào — nó có thể rộng hơn nhóm router tự
  // chọn, vì kế hoạch nới thêm nhóm. Chấm theo "Router chọn" sẽ báo hỏng oan những câu mà kế hoạch
  // đã cứu (đã xảy ra với C08). Chỉ lùi về "Router chọn" khi log không có dòng nhóm hiệu lực.
  const groups = [];
  const effective = [...text.matchAll(/Nhóm hiệu lực \[([^\]]*)\]/g)];
  const source = effective.length ? effective : [...text.matchAll(/Router chọn \[([^\]]*)\]/g)];
  for (const m of source) {
    for (const g of m[1].split(',')) {
      const name = g.trim();
      if (name && !groups.includes(name)) groups.push(name);
    }
  }
  return { tools: [...new Set(tools)], groups };
}

// ── gọi API ──────────────────────────────────────────────────────────────────
const tokens = {};

/**
 * Lấy token từ COOKIE chứ không phải từ body.
 *
 * Từ khi đăng nhập chuyển sang cookie HttpOnly, `AuthController.issueSession` gỡ hẳn accessToken
 * khỏi body (luôn null) — bản cũ của hàm này vì thế ném "Đăng nhập hỏng" ở câu đầu tiên. Cookie
 * `kg_at` chứa nguyên JWT; HttpOnly chỉ chặn JavaScript trong trình duyệt, script đọc Set-Cookie
 * vẫn thấy bình thường.
 *
 * Dùng nó làm header Bearer thay vì gửi lại cookie: client có `Authorization: Bearer` được MIỄN
 * CSRF (SecurityConfig.csrfProtectionMatcher), nên không phải xoay xở với XSRF-TOKEN.
 */
async function loginAs(key) {
  if (tokens[key]) return tokens[key];
  const acc = BANK.accounts[key];
  if (!acc) throw new Error('Không có tài khoản: ' + key);
  const r = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: acc.email, password: acc.password }),
  });
  const setCookies = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [];
  for (const c of setCookies) {
    const m = /^kg_at=([^;]+)/.exec(c);
    if (m && m[1]) { tokens[key] = m[1]; return tokens[key]; }
  }
  throw new Error('Đăng nhập hỏng (không thấy cookie kg_at): ' + acc.email);
}

/**
 * Hạn mức token THÁNG của chính hệ thống đã cạn (429 từ AiTokenQuotaExceededException).
 *
 * <p>Khác hẳn `depleted` (nhà cung cấp hết credit) và khác cả chặn tần suất. Không nhận ra nó
 * thì mọi câu còn lại đỏ hàng loạt trông y hệt model sai — đã xảy ra thật: 12 ca đỏ giả từng bị
 * đọc nhầm thành một đợt hồi quy.
 */
const QUOTA_EXHAUSTED = /hết hạn mức token AI/i;

const RATE_LIMITED = /quá nhanh|rate limit/i;

/**
 * Nhà cung cấp model chặn tần suất (HTTP 429) — KHÁC với bộ chặn 15 lượt/phút của backend.
 *
 * Backend gói lỗi này thành "Hệ thống AI đã đạt giới hạn sử dụng", trùng chữ với lỗi hết hạn mức
 * token trong ứng dụng nên rất dễ chẩn nhầm. Đã đo được: một lần chạy tưởng tụt 37/40 -> 30/40,
 * hoá ra 7/10 câu hỏng là 429 chứ không phải model chọn sai.
 *
 * Từ khi có công đoạn lập kế hoạch + định tuyến + hỏi lại, MỖI câu hỏi gọi nhà cung cấp 3-4 lần,
 * nên nhịp giãn phải tính theo lời gọi nhà cung cấp chứ không phải theo số câu hỏi.
 */
const PROVIDER_THROTTLED = /đạt giới hạn sử dụng/i;

async function askOnce(question, accountKey) {
  const token = await loginAs(accountKey);
  const r = await fetch(BASE + '/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ message: question }),
  });
  const j = await r.json();
  if (j.success && j.data && j.data.text) return j.data.text.replace(/\s+/g, ' ').trim();
  return '[LỖI] ' + (j.message || JSON.stringify(j)).slice(0, 160);
}

/**
 * Backend giới hạn 15 lượt AI mỗi phút (app.rate-limit.ai-per-minute). Bắn liên tục sẽ bị chặn
 * từ câu thứ 16 trở đi và mọi câu sau đó hỏng hàng loạt — trông y như lỗi tool, rất dễ chẩn nhầm.
 * Vì vậy giãn nhịp sẵn, và nếu vẫn bị chặn thì chờ hết cửa sổ một phút rồi thử lại đúng một lần.
 */
async function ask(question, accountKey) {
  let answer = await askOnce(question, accountKey);
  if (PROVIDER_THROTTLED.test(answer)) {
    process.stdout.write('       (nhà cung cấp chặn 429, chờ 60s rồi thử lại)\n');
    await new Promise(r => setTimeout(r, 60_000));
    markLog();
    answer = await askOnce(question, accountKey);
  }
  if (RATE_LIMITED.test(answer)) {
    process.stdout.write('       (bị chặn tần suất, chờ 60s rồi thử lại)\n');
    await new Promise(r => setTimeout(r, 60_000));
    markLog();
    answer = await askOnce(question, accountKey);
  }
  return answer;
}

// ── chấm ─────────────────────────────────────────────────────────────────────
function grade(item, answer, trace, isTrapGroup) {
  const problems = [];

  if (!isTrapGroup && GAVE_UP.test(answer)) problems.push('hệ thống chịu thua');
  if (answer.startsWith('[LỖI]')) problems.push('gọi API lỗi');

  for (const pat of item.expect || []) {
    if (!new RegExp(pat, 'i').test(answer)) problems.push(`thiếu "${pat}"`);
  }
  for (const pat of item.reject || []) {
    if (new RegExp(pat, 'i').test(answer)) problems.push(`RÒ: chứa "${pat}"`);
  }
  // Log rỗng nghĩa là KHÔNG ĐỌC ĐƯỢC log (sai đường dẫn, hoặc backend đã khởi động lại và ghi
  // sang file khác), chứ không phải model không gọi tool nào. Chấm hỏng ở đây sẽ báo oan hàng
  // loạt trong khi câu trả lời hoàn toàn đúng — đã gặp đúng lỗi này một lần.
  const traceUsable = trace.tools.length > 0;
  if (LOG_PATH && traceUsable && item.tools) {
    const missing = item.tools.filter(t => !trace.tools.includes(t));
    if (missing.length) problems.push('không gọi ' + missing.join('+'));
  }
  // toolsAny: mỗi nhóm chỉ cần MỘT tool khớp. Dùng khi có nhiều đường đúng như nhau để trả lời
  // một vế — vd "tổng quan KPI" làm được bằng get_kpi(summary) lẫn get_analytics(dashboard).
  // Đòi đúng một tool trong những trường hợp đó là chấm hỏng một câu trả lời đúng.
  if (LOG_PATH && traceUsable && item.toolsAny) {
    for (const alternatives of item.toolsAny) {
      if (!alternatives.some(t => trace.tools.includes(t))) {
        problems.push('không gọi tool nào trong ' + alternatives.join('|'));
      }
    }
  }
  if (LOG_PATH && traceUsable && item.groups && trace.groups.length) {
    const missing = item.groups.filter(g => !trace.groups.includes(g));
    // Router trả đủ nhóm đọc là hành vi lùi an toàn, không tính là thiếu.
    if (missing.length && trace.groups.length < 3) problems.push('router thiếu nhóm ' + missing.join('+'));
  }
  return problems;
}

// ── chạy ─────────────────────────────────────────────────────────────────────
const GROUPS = [
  ['A', 'Từng tool / từng view', BANK.groupA],
  ['B', 'Một câu cần nhiều tool', BANK.groupB],
  ['C', 'Một câu cần nhiều intent', BANK.groupC],
  ['D', 'Bẫy an toàn — phải đạt TUYỆT ĐỐI', BANK.groupD],
];

(async () => {
  const results = [];
  let pass = 0, fail = 0;
  let quotaOut = false;

  for (const [key, title, items] of GROUPS) {
    if (quotaOut) break;
    if (onlyGroup && onlyGroup !== key) continue;
    console.log(`\n━━ NHÓM ${key} — ${title} ━━`);

    for (const item of items) {
      const account = item.as || 'director';
      markLog();
      let answer;
      try {
        answer = await ask(item.q, account);
      } catch (e) {
        answer = '[LỖI] ' + e.message;
      }
      await new Promise(r => setTimeout(r, 300)); // để log kịp ghi xong
      const trace = readLogSince();

      // Hạn mức tháng cạn thì mọi câu sau đều đỏ mà KHÔNG phải model sai. Dừng ngay: đừng đốt
      // thêm câu, và đừng để lại một bảng kết quả trông như hồi quy.
      if (QUOTA_EXHAUSTED.test(answer)) {
        console.log('\nDỪNG: hạn mức token AI THÁNG của tài khoản đo đã cạn — không phải model sai. '
          + 'Nâng hạn mức (ai_token_quotas.monthly_limit) hoặc chờ sang tháng rồi chạy lại.');
        quotaOut = true;
        break;
      }
      // Giãn nhịp cho dưới ngưỡng 15 lượt/phút của backend (xem ghi chú ở hàm ask).
      // 4500 là nhịp tính cho bộ chặn 15 lượt/phút của BACKEND, hồi mỗi câu chỉ gọi model một lần.
      //
      // Giờ ràng buộc chặt hơn nằm ở NHÀ CUNG CẤP, và nó tính theo TOKEN chứ không phải lời gọi:
      // 429 kèm "Tokens per minute limit exceeded". Mỗi câu tốn ~16.000 token (định tuyến + lập
      // kế hoạch + gọi chính, mỗi lời gọi mang theo toàn bộ định nghĩa tool), nên với hạn mức TPM
      // của gói đang dùng chỉ chạy được 3-4 câu/phút. Bắn nhanh hơn là hỏng hàng loạt trông y hệt
      // model chọn sai — đã đo nhầm một lần thành "tụt 37/40 -> 30/40".
      const pace = Number(argOf('--delay', '20000'));
      const problems = grade(item, answer, trace, key === 'D');
      const ok = problems.length === 0;
      ok ? pass++ : fail++;

      const who = account === 'director' ? '' : `[${account}] `;
      console.log(`${ok ? ' OK ' : 'HỎNG'} ${item.id} ${who}${item.q}`);
      if (trace.tools.length) console.log(`       tool: ${trace.tools.join(', ')}`
        + (trace.groups.length ? `   |   router: ${trace.groups.join(', ')}` : ''));
      if (!ok) console.log(`       ✗ ${problems.join(' · ')}`);
      console.log(`       → ${answer.slice(0, 150)}`);

      results.push({ ...item, account, answer, trace, problems, ok });
      await new Promise(r => setTimeout(r, pace));
    }
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(`Đạt ${pass} / ${pass + fail}`);
  if (LOG_PATH && results.every(r => r.trace.tools.length === 0)) {
    console.log(`⚠  KHÔNG đọc được lời gọi tool nào từ ${LOG_PATH}`);
    console.log(`   Backend có thể đã khởi động lại và đang ghi sang file log khác.`);
    console.log(`   Phần kiểm "gọi đúng tool" và "router chọn đúng nhóm" đã bị BỎ QUA ở lần chạy này.`);
  }
  const leaks = results.filter(r => r.problems.some(p => p.startsWith('RÒ')));
  if (leaks.length) console.log(`⚠  ${leaks.length} câu RÒ DỮ LIỆU: ${leaks.map(r => r.id).join(', ')}`);
  fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));
  console.log(`Chi tiết: ${OUT_PATH}`);
})().catch(e => { console.error('LỖI:', e); process.exit(1); });