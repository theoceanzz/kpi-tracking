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
async function loginAs(key) {
  if (tokens[key]) return tokens[key];
  const acc = BANK.accounts[key];
  if (!acc) throw new Error('Không có tài khoản: ' + key);
  const r = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: acc.email, password: acc.password }),
  }).then(x => x.json());
  if (!r.data || !r.data.accessToken) throw new Error('Đăng nhập hỏng: ' + acc.email);
  tokens[key] = r.data.accessToken;
  return tokens[key];
}

const RATE_LIMITED = /quá nhanh|rate limit/i;

async function askOnce(question, accountKey) {
  const token = await loginAs(accountKey);
  const r = await fetch(BASE + '/ai/chat-org-unit', {
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

  for (const [key, title, items] of GROUPS) {
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
      // Giãn nhịp cho dưới ngưỡng 15 lượt/phút của backend (xem ghi chú ở hàm ask).
      const pace = Number(argOf('--delay', '4500'));
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