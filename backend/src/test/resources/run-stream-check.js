/**
 * Đối chiếu hai đường chat: JSON (`/ai/chat`) và luồng (`/ai/chat/stream`).
 *
 *   node run-stream-check.js [--delay 20000]
 *
 * Cần backend đang chạy ở :8081.
 *
 * Thứ QUAN TRỌNG NHẤT ở đây không phải phần hiển thị mà là SỐ TOKEN GHI ĐƯỢC. Trước bản vá,
 * `TokenUsageAuditAdvisor.adviseStream` chuyển tiếp mà không gọi record(...), nghĩa là mọi lượt
 * streaming ghi 0 token — một đường đi vòng qua toàn bộ hạn mức. Phép kiểm: hỏi CÙNG một câu qua
 * hai đường rồi so mức tiêu thụ đọc từ `/ai/quota/me`. Lệch nhiều = bản vá chưa đúng.
 *
 * Các điều kiểm thêm:
 *   - `done` mang đủ options / formPatch / followups như đường JSON
 *   - tiến độ chỉ gồm VÀI bước có nghĩa, mọi nhãn đều là giọng "Đang…" và không rò tên lớp Java
 *   - có ít nhất một nhãn TOOL — đó là phần lấp quãng chờ dài nhất của một lượt
 *
 * Không kiểm chữ chảy dần vì đường SSE KHÔNG phát chữ: đo được là `.stream()` gọi ít tool hơn hẳn
 * `.call()` nên câu trả lời mỏng đi mà không báo lỗi. Xem ghi chú ở `ModelCallStage`.
 */
const BASE = process.env.AI_TEST_BASE || 'http://localhost:8081/api/v1';
const ACCOUNT = { email: 'director@demo.com', password: 'Demo123@' };

const args = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
/** Giãn nhịp theo TOKEN/phút của nhà cung cấp — xem chú thích ở run-ai-questions.js. */
const PACE = Number(argOf('--delay', '20000'));

/**
 * Câu hỏi phải nêu một đơn vị DUY NHẤT trong dữ liệu mẫu. Tên mơ hồ ("Phòng Kỹ thuật" khớp nhiều
 * đơn vị) khiến trợ lý hỏi lại, và lượt hỏi lại đi nhánh khác — không sinh câu hỏi gợi ý — nên hai
 * lần chạy sẽ khác hình dạng vì lý do chẳng liên quan gì tới streaming.
 */
const QUESTION = argOf('--question', 'Team Backend có bao nhiêu thành viên?');

let token = null;

/** Lấy JWT từ cookie kg_at rồi dùng làm Bearer (được miễn CSRF) — xem run-form-fill.js. */
async function login() {
  if (token) return token;
  const r = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ACCOUNT),
  });
  const cookies = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [];
  for (const c of cookies) {
    const m = /^kg_at=([^;]+)/.exec(c);
    if (m && m[1]) { token = m[1]; return token; }
  }
  throw new Error('Đăng nhập hỏng (không thấy cookie kg_at)');
}

async function auth() {
  return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await login()) };
}

/** Mức token đã tiêu trong tháng của chính tài khoản này. */
async function usedTokens() {
  const r = await fetch(BASE + '/ai/quota/me', { headers: await auth() });
  const j = await r.json();
  return j?.data?.used ?? null;
}

async function askJson(message) {
  const r = await fetch(BASE + '/ai/chat', {
    method: 'POST', headers: await auth(), body: JSON.stringify({ message }),
  });
  const j = await r.json();
  return j?.data ?? { text: '[LỖI] ' + (j.message || JSON.stringify(j)) };
}

/** Đọc luồng SSE, trả về các sự kiện đã gom nhóm. */
async function askStream(message, form) {
  const body = { message };
  if (form) { body.openFormId = form.formId; body.openFormValues = form.values || {}; }
  const r = await fetch(BASE + '/ai/chat/stream', {
    method: 'POST', headers: await auth(), body: JSON.stringify(body),
  });
  if (!r.ok || !r.body) throw new Error('HTTP ' + r.status + ' từ /ai/chat/stream');

  const out = { stages: [], toolStages: [], done: null, error: null };
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let split;
    while ((split = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);

      let event = 'message';
      const dataLines = [];
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
      }
      if (!dataLines.length) continue;

      let payload;
      try { payload = JSON.parse(dataLines.join('\n')); } catch { continue; }

      if (event === 'stage') {
        out.stages.push(payload.code + ' (' + payload.label + ')');
        // Nhãn của TOOL mang mã "tool:<tên>" — đây là phần lấp quãng chờ dài nhất của một lượt.
        if (String(payload.code).startsWith('tool:')) out.toolStages.push(payload.label);
      } else if (event === 'done') {
        out.done = payload;
      } else if (event === 'error') {
        out.error = payload.message;
      }
    }
  }
  return out;
}

const wait = ms => new Promise(r => setTimeout(r, ms));
const short = (s, n = 110) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);

(async () => {
  const problems = [];

  console.log('Câu hỏi: ' + QUESTION + '\n');

  // ── đường JSON ────────────────────────────────────────────────────────────
  const beforeJson = await usedTokens();
  const jsonRes = await askJson(QUESTION);
  const afterJson = await usedTokens();
  const jsonTokens = afterJson - beforeJson;
  console.log('── ĐƯỜNG JSON ──');
  console.log('  token ghi được: ' + jsonTokens);
  console.log('  → ' + short(jsonRes.text, 150));

  await wait(PACE);

  // ── đường luồng ───────────────────────────────────────────────────────────
  const beforeStream = await usedTokens();
  const s = await askStream(QUESTION);
  const afterStream = await usedTokens();
  const streamTokens = afterStream - beforeStream;

  console.log('\n── ĐƯỜNG LUỒNG ──');
  console.log('  token ghi được: ' + streamTokens);
  console.log('  công đoạn (' + s.stages.length + '): ' + s.stages.join(' → '));
  console.log('  trong đó nhãn tool: ' + (s.toolStages.join(', ') || '(không có)'));
  console.log('  → ' + short(s.done?.text, 150));
  if (s.error) console.log('  LỖI: ' + s.error);

  // ── chấm ──────────────────────────────────────────────────────────────────
  if (s.error) problems.push('luồng báo lỗi: ' + s.error);
  if (!s.done) problems.push('không nhận được sự kiện done — client sẽ chờ mãi mà không có câu trả lời');
  if (!s.done?.text) problems.push('done không có câu trả lời');
  if (!s.stages.length) problems.push('không có sự kiện stage nào — phần tiến độ không chạy');

  // Chỉ những công đoạn ĐÁNG cho người dùng đọc mới được hiện. Trước đây phát cả 12 công đoạn,
  // trong đó có cả tên kỹ thuật lẫn nhãn nói sai thời điểm.
  const stageOnly = s.stages.filter(e => !e.startsWith('tool:'));
  if (stageOnly.length > 8) {
    problems.push('hiện quá nhiều công đoạn (' + stageOnly.length + ') — đáng lẽ chỉ vài bước có nghĩa');
  }
  for (const e of s.stages) {
    // Nhãn là chữ người dùng đọc; lọt tên lớp Java hay tên tool ra là hỏng.
    const label = e.slice(e.indexOf('(') + 1, -1);
    if (!label.startsWith('Đang ')) problems.push('nhãn không phải giọng "Đang…": ' + label);
    if (/Stage$/.test(label)) problems.push('rò tên lớp Java ra giao diện: ' + label);
  }
  // Câu hỏi này bắt buộc phải tra cứu, nên phải có ít nhất một nhãn tool.
  if (!s.toolStages.length) {
    problems.push('không có nhãn tool nào — quãng chờ dài nhất của lượt vẫn im lặng');
  }

  // Hai đường phải trả về CÙNG hình dạng. Lệch là client luồng thiếu tính năng.
  //
  // Nhưng model KHÔNG tất định: cùng một câu, một lượt có thể hỏi lại còn lượt kia trả lời thẳng,
  // và hai nhánh đó vốn dĩ khác hình dạng (lượt hỏi lại không sinh câu hỏi gợi ý). So hình dạng
  // trong trường hợp đó là chấm sai — nên phát hiện và hạ xuống mức ghi chú.
  const asked = r => Array.isArray(r?.options) && r.options.length > 0;
  const routeDiffers = asked(jsonRes) !== asked(s.done);
  if (routeDiffers) {
    console.log('\n  (ghi chú: hai lượt đi hai nhánh khác nhau — một lượt hỏi lại, một lượt không.'
      + ' Bỏ qua phép so hình dạng, chạy lại nếu cần kết luận chắc.)');
  } else {
    for (const key of ['options', 'formPatch', 'followups']) {
      const inJson = jsonRes[key] !== undefined && jsonRes[key] !== null;
      const inStream = s.done && s.done[key] !== undefined && s.done[key] !== null;
      if (inJson !== inStream) problems.push(`trường "${key}" chỉ có ở ${inJson ? 'JSON' : 'luồng'}`);
    }
  }

  // Mốc chính: token ghi qua luồng phải XẤP XỈ đường JSON. Cùng câu hỏi nhưng model không
  // tất định nên cho phép lệch rộng; thứ cần bắt là 0 hoặc lệch cả một bậc.
  if (streamTokens <= 0) {
    problems.push('luồng ghi ' + streamTokens + ' token — ĐI VÒNG QUA HẠN MỨC, đây là lỗi nặng nhất');
  } else if (jsonTokens > 0) {
    const ratio = streamTokens / jsonTokens;
    if (ratio < 0.5 || ratio > 2) {
      problems.push(`token lệch quá xa: luồng ${streamTokens} vs JSON ${jsonTokens} (tỉ lệ ${ratio.toFixed(2)})`);
    }
  }

  // ── điền form qua đường luồng ─────────────────────────────────────────────
  //
  // Phép kiểm QUAN TRỌNG NHẤT của phần trạng thái theo lượt. Bản đề xuất điền form đi ra khỏi vòng
  // gọi tool qua ThreadLocal, mà ở lượt streaming tool chạy trên luồng reactor — đo được: trước khi
  // có TurnStatePropagation, `formPatch` luôn rỗng ở đường luồng dù tool vẫn chạy đúng.
  await wait(PACE);
  const filled = await askStream(
    "Điền giúp tôi KPI tên 'Số bug tồn đọng', trọng số 15, tần suất hàng tháng",
    { formId: 'kpi_form', values: {} });
  const entries = filled.done?.formPatch?.entries || [];

  console.log('\n── ĐIỀN FORM QUA LUỒNG ──');
  console.log('  đề xuất: ' + (entries.length
    ? entries.map(e => e.field + '=' + e.display).join(' | ')
    : '(không có)'));

  if (!entries.length) {
    problems.push('điền form qua luồng KHÔNG ra đề xuất — trạng thái theo lượt không sang được '
      + 'luồng reactor (xem TurnStatePropagation)');
  }

  console.log('\n══════════════════════════════════════');
  if (problems.length) {
    console.log('HỎNG:');
    problems.forEach(p => console.log('  ✗ ' + p));
    process.exitCode = 1;
  } else {
    console.log('ĐẠT — hai đường ghi token tương đương, tiến độ và done đầy đủ.');
  }
})();
