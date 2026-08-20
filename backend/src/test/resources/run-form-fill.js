/**
 * Kiểm tính năng gợi ý điền form đang mở trên màn hình người dùng.
 *
 *   node run-form-fill.js [--log <đường-dẫn-log-backend>] [--out ket-qua.json]
 *
 * Cần backend đang chạy ở :8081.
 *
 * Vì sao KHÔNG dùng chung run-ai-questions.js: harness đó chỉ gửi `{ message }` và chấm trên CHỮ
 * của câu trả lời. Ở đây phải gửi kèm `openFormId` + `openFormValues`, và thứ cần chấm là
 * `response.formPatch` — dữ liệu có cấu trúc, không phải văn xuôi.
 *
 * Dùng Node chứ KHÔNG dùng bash: Git Bash làm hỏng UTF-8 tiếng Việt khi đi qua sed/printf và
 * backend chết với "Invalid UTF-8 middle byte".
 */
const fs = require('fs');

const BASE = process.env.AI_TEST_BASE || 'http://localhost:8081/api/v1';
const ACCOUNT = { email: 'director@demo.com', password: 'Demo123@' };

const args = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const LOG_PATH = argOf('--log', process.env.AI_TEST_LOG || '');
const OUT_PATH = argOf('--out', 'form-fill-result.json');
/** Xem chú thích ở vòng chạy: giới hạn của nhà cung cấp tính theo TOKEN/phút. */
const PACE = Number(argOf('--delay', '20000'));

// UUID thật trong dữ liệu mẫu (V2__seed_data.sql) — dùng để chắc chắn model không bịa id.
const TEAM_BACKEND = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const THANG_6_2026 = '33333333-0000-0000-0000-000000000106';
/** Dữ liệu mẫu có hai kỳ tháng 6 gần trùng tên: "Tháng 6/2026" và "Tháng 6-2026". */
const THANG_6_2026_ALT = '33333333-0000-0000-0000-000000000103';

const KPI_FORM = 'kpi_form';
const SUBMISSION_FORM = 'submission_form';
const EVALUATION_FORM = 'evaluation_form';
const KPI_ADJUSTMENT_FORM = 'kpi_adjustment_form';
const ORG_UNIT_FORM = 'org_unit_form';
const ORG_UNIT_DRAWER_FORM = 'org_unit_drawer_form';

/** Cấp bậc "Phòng ban" của tổ chức mẫu. */
const LEVEL_PHONG_BAN = '22222222-2222-2222-2222-222222222222';

/** KPI "API hoàn thành" của riêng kỳ Tháng 6/2026 — mọi KPI đều lặp qua 3 kỳ nên phải nêu kỳ. */
const KPI_API_T6 = '3daf855a-72f5-4941-aa42-37d13a1440f1';
const USER_TEAMLEAD = '22222222-0000-0000-0000-000000000300';

/** formId -> tên @Tool phụ trách, phải khớp FormRegistry phía backend. */
const TOOL_OF = {
  [KPI_FORM]: 'suggest_kpi_form',
  [SUBMISSION_FORM]: 'suggest_submission_form',
  [EVALUATION_FORM]: 'suggest_evaluation_form',
  [KPI_ADJUSTMENT_FORM]: 'suggest_kpi_adjustment_form',
  [ORG_UNIT_FORM]: 'suggest_org_unit_form',
  [ORG_UNIT_DRAWER_FORM]: 'suggest_org_unit_drawer_form',
};

/**
 * Chín ca kiểm.
 *
 * Bốn ca `mustHavePatch: false` là các PHÉP SO NGƯỢC và chúng quan trọng hơn các ca thuận: một
 * tính năng điền form quá sốt sắng sẽ ghi bừa vào form người dùng, và đó là hỏng nặng hơn nhiều
 * so với việc không điền được.
 */
const CASES = [
  {
    id: 'F01',
    why: 'ca cơ bản — các ô giá trị đơn',
    message: "Điền giúp tôi KPI tên 'Số bug tồn đọng', trọng số 15, tần suất hàng tháng",
    formId: KPI_FORM,
    values: {},
    mustHavePatch: true,
    expectFields: { name: /bug/i, weight: 15, frequency: 'MONTHLY' },
  },
  {
    id: 'F02',
    why: 'tra tên đơn vị ra UUID thật, và hiện TÊN cho người đọc',
    message: 'Giao KPI này cho Team Backend',
    formId: KPI_FORM,
    values: { name: 'Số bug tồn đọng' },
    mustHavePatch: true,
    expectFields: { orgUnitIds: [TEAM_BACKEND] },
    expectDisplay: { orgUnitIds: /Team Backend/i },
  },
  {
    id: 'F03',
    why: 'tra tên kỳ ra UUID thật',
    message: 'Đặt kỳ là Tháng 6/2026',
    formId: KPI_FORM,
    values: { name: 'Số bug tồn đọng' },
    mustHavePatch: true,
    expectFields: { kpiPeriodId: THANG_6_2026 },
    expectDisplay: { kpiPeriodId: /Tháng 6\/2026/i },
  },
  {
    id: 'F04',
    why: 'tên kỳ mơ hồ ("tháng 6" khớp 2 kỳ) — nếu vẫn ra đề xuất thì id PHẢI là kỳ CÓ THẬT',
    // Bản đầu đòi "không được có đề xuất" — SAI: model tự chuẩn hoá "tháng 6" thành
    // "Tháng 6/2026" rồi truyền xuống, nên tool không hề gặp cảnh nhập nhằng. Việc model tự
    // chọn là chấp nhận được vì bản xem trước hiện TÊN kỳ và người dùng vẫn phải bấm đồng ý.
    // Thứ thật sự phải chặn là id BỊA — nên chuyển sang kiểm đúng điều đó. Nhánh nhập nhằng
    // của tool đã có test đơn vị riêng (KpiFormFillToolTest.ambiguousPeriodAsksBack).
    message: 'Đặt kỳ tháng 6',
    formId: KPI_FORM,
    values: { name: 'Số bug tồn đọng' },
    mustCallTool: true,
    allowedIfPresent: { kpiPeriodId: [THANG_6_2026, THANG_6_2026_ALT] },
  },
  {
    id: 'F05',
    why: 'NGƯỢC — trọng số ngoài khoảng 0..100 phải bị validator chặn',
    message: 'Đặt trọng số 150 cho KPI này',
    formId: KPI_FORM,
    values: { name: 'Số bug tồn đọng' },
    mustHavePatch: false,
    mustCallTool: true,
  },
  {
    id: 'F06',
    why: 'NGƯỢC — KHÔNG mở form thì tool không được trao, tuyệt đối không có đề xuất',
    message: "Điền giúp tôi KPI tên 'Số bug tồn đọng', trọng số 15, tần suất hàng tháng",
    formId: null,
    values: null,
    mustHavePatch: false,
    // formId=null nên phép chấm tự kiểm rằng KHÔNG tool điền form nào chạy.
  },
  {
    id: 'F07',
    why: 'NGƯỢC — form đã có sẵn đúng các giá trị đó thì không đề xuất lại',
    message: "Điền giúp tôi KPI tên 'Số bug tồn đọng', trọng số 15, tần suất hàng tháng",
    formId: KPI_FORM,
    values: { name: 'Số bug tồn đọng', weight: 15, frequency: 'MONTHLY' },
    mustHavePatch: false,
  },
  {
    id: 'F08',
    why: 'NGƯỢC — ô không có trong FormRegistry thì không được đề xuất',
    message: 'Điền mật khẩu quản trị và quyền admin vào form này',
    formId: KPI_FORM,
    values: {},
    mustHavePatch: false,
  },
  {
    id: 'S01',
    why: 'NỘP BÁO CÁO — tra KPI đúng KỲ ra UUID thật (mọi KPI đều lặp qua 3 kỳ)',
    message: 'Nộp báo cáo KPI "API hoàn thành" kỳ Tháng 6/2026, đạt 12 endpoint, ghi chú làm xong sớm',
    formId: SUBMISSION_FORM,
    values: {},
    mustHavePatch: true,
    expectFields: { kpiCriteriaId: KPI_API_T6, actualValue: 12 },
    expectDisplay: { kpiCriteriaId: /Tháng 6\/2026/ },
  },
  {
    id: 'S02',
    why: 'NGƯỢC — không nêu kỳ thì KPI trùng tên phải bắt hỏi lại, không tự chọn kỳ',
    message: 'Nộp báo cáo KPI "API hoàn thành", đạt 12',
    formId: SUBMISSION_FORM,
    values: {},
    mustHavePatch: false,
    mustCallTool: true,
  },
  {
    id: 'S03',
    why: 'NGƯỢC — không mở form nộp báo cáo thì không được đề xuất',
    message: 'Nộp báo cáo KPI "API hoàn thành" kỳ Tháng 6/2026, đạt 12',
    formId: null,
    values: null,
    mustHavePatch: false,
  },
  {
    id: 'E01',
    why: 'ĐÁNH GIÁ — tra người và kỳ ra UUID thật, bản xem trước hiện TÊN',
    message: 'Đánh giá Hoàng Văn TeamLead kỳ Tháng 6/2026, 8 điểm, nhận xét hoàn thành tốt',
    formId: EVALUATION_FORM,
    values: {},
    mustHavePatch: true,
    expectFields: { userId: USER_TEAMLEAD, score: 8 },
    expectDisplay: { userId: /TeamLead/i, kpiPeriodId: /Tháng 6\/2026/ },
  },
  {
    id: 'E02',
    why: 'NGƯỢC — điểm âm phải bị validator chặn',
    message: 'Đánh giá Hoàng Văn TeamLead kỳ Tháng 6/2026 với điểm -5',
    formId: EVALUATION_FORM,
    values: {},
    mustHavePatch: false,
  },
  {
    id: 'E03',
    why: 'NGƯỢC — ô không có trong FormRegistry thì không được đề xuất',
    message: 'Điền mật khẩu và vai trò quản trị vào form đánh giá này',
    formId: EVALUATION_FORM,
    values: {},
    mustHavePatch: false,
  },
  {
    id: 'A01',
    why: 'ĐIỀU CHỈNH KPI — mục tiêu mới kèm lý do',
    message: 'Xin điều chỉnh mục tiêu xuống 40, lý do là khối lượng công việc quý này tăng đột biến',
    formId: KPI_ADJUSTMENT_FORM,
    values: {},
    mustHavePatch: true,
    expectFields: { requestedTargetValue: 40 },
  },
  {
    id: 'A02',
    why: 'NGƯỢC — lý do ngắn hơn 10 ký tự phải bị chặn, không để form báo đỏ sau khi Điền',
    message: 'Xin điều chỉnh mục tiêu xuống 40, lý do: bận',
    formId: KPI_ADJUSTMENT_FORM,
    values: {},
    mustHavePatch: false,
  },
  {
    id: 'U01',
    why: 'ĐƠN VỊ — tra cấp bậc theo tên ra UUID thật',
    message: 'Tạo đơn vị tên Phòng Marketing, mã MKT, cấp bậc Phòng ban',
    formId: ORG_UNIT_FORM,
    values: {},
    mustHavePatch: true,
    expectFields: { name: /Marketing/i, code: /MKT/i, orgHierarchyId: LEVEL_PHONG_BAN },
    expectDisplay: { orgHierarchyId: /Phòng ban/i },
  },
  {
    id: 'U02',
    why: 'NGƯỢC — cấp bậc không có thật thì không được bịa id',
    message: 'Tạo đơn vị tên Phòng Marketing, mã MKT, cấp bậc Chi nhánh vùng',
    formId: ORG_UNIT_FORM,
    values: {},
    mustHavePatch: false,
    mustCallTool: true,
  },
  {
    id: 'D01',
    why: 'DRAWER ĐƠN VỊ — trạng thái nhận nhãn tiếng Việt',
    message: 'Đổi trạng thái đơn vị này sang tạm dừng',
    formId: ORG_UNIT_DRAWER_FORM,
    values: {},
    mustHavePatch: true,
    expectFields: { status: 'INACTIVE' },
  },
  {
    id: 'D02',
    why: 'NGƯỢC — không mở form drawer thì không được đề xuất',
    message: 'Đổi trạng thái đơn vị này sang tạm dừng',
    formId: null,
    values: null,
    mustHavePatch: false,
  },
  {
    id: 'F09',
    why: 'VÒNG LẶP ĐẦY ĐỦ — nhiều ô giá trị + hai thực thể phải tra, gộp trong một đề xuất',
    message:
      'Tạo KPI đo số task hoàn thành cho Team Backend, kỳ Tháng 6/2026, trọng số 20, mục tiêu 50 task',
    formId: KPI_FORM,
    values: {},
    mustHavePatch: true,
    expectFields: {
      orgUnitIds: [TEAM_BACKEND],
      kpiPeriodId: THANG_6_2026,
      weight: 20,
      targetValue: 50,
    },
  },
];

// ── đọc log backend để biết tool nào thực sự chạy ────────────────────────────
let logCursor = 0;
function markLog() {
  if (!LOG_PATH) return;
  try { logCursor = fs.statSync(LOG_PATH).size; } catch { logCursor = 0; }
}
function readLogSince() {
  if (!LOG_PATH) return { tools: [], rejected: [], depleted: false };
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
  return {
    tools: [...new Set([...text.matchAll(/AI-TOOL-CALL (\w+)/g)].map(m => m[1]))],
    // Tool BỊ TỪ CHỐI không ghi AI-TOOL-CALL (chỉ lời gọi thành công mới ghi) mà đi qua
    // ToolSupport.toolError -> "Recoverable error in <tên tool>". Với các ca kiểm phép chặn,
    // đây mới là bằng chứng tool đã chạy và validator đã làm việc.
    rejected: [...new Set([...text.matchAll(/Recoverable error in (\w+)/g)].map(m => m[1]))],
    // Hết credit NHÀ CUNG CẤP: triệu chứng giống hệt hết hạn mức trong ứng dụng nhưng cách chữa
    // khác hẳn. Phát hiện sớm để dừng thay vì đốt cả bộ vào lỗi 402.
    depleted: /depleted/.test(text),
  };
}

// ── gọi API ──────────────────────────────────────────────────────────────────
let token = null;

/**
 * Lấy token từ COOKIE chứ không phải từ body.
 *
 * <p>Từ khi đăng nhập chuyển sang cookie HttpOnly, `AuthController.issueSession` gỡ hẳn
 * accessToken khỏi body (luôn null). Cookie `kg_at` chứa nguyên JWT — HttpOnly chỉ chặn
 * JavaScript trong trình duyệt, script đọc Set-Cookie vẫn thấy bình thường.
 *
 * <p>Dùng nó làm header Bearer thay vì gửi lại cookie: client có `Authorization: Bearer` được
 * MIỄN CSRF (SecurityConfig.csrfProtectionMatcher), nên không phải xoay xở với XSRF-TOKEN.
 */
async function login() {
  if (token) return token;
  const r = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ACCOUNT),
  });
  const setCookies = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [];
  for (const c of setCookies) {
    const m = /^kg_at=([^;]+)/.exec(c);
    if (m && m[1]) { token = m[1]; return token; }
  }
  throw new Error('Đăng nhập hỏng (không thấy cookie kg_at): ' + ACCOUNT.email);
}

const RATE_LIMITED = /quá nhanh|rate limit/i;
/** Nhà cung cấp chặn 429 — khác bộ chặn 15 lượt/phút của backend; xem chú thích ở run-ai-questions.js. */
const PROVIDER_THROTTLED = /đạt giới hạn sử dụng/i;

async function askOnce(c) {
  const t = await login();
  const body = { message: c.message };
  if (c.formId) {
    body.openFormId = c.formId;
    body.openFormValues = c.values || {};
  }
  const r = await fetch(BASE + '/ai/chat-org-unit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (j.success && j.data) {
    return { text: (j.data.text || '').replace(/\s+/g, ' ').trim(), patch: j.data.formPatch || null };
  }
  return { text: '[LỖI] ' + (j.message || JSON.stringify(j)).slice(0, 160), patch: null };
}

/** Backend chặn 15 lượt AI/phút; bị chặn thì chờ hết cửa sổ rồi thử lại đúng một lần. */
async function ask(c) {
  let res = await askOnce(c);
  if (PROVIDER_THROTTLED.test(res.text)) {
    process.stdout.write('       (nhà cung cấp chặn 429, chờ 60s rồi thử lại)\n');
    await new Promise(r => setTimeout(r, 60_000));
    markLog();
    res = await askOnce(c);
  }
  if (RATE_LIMITED.test(res.text)) {
    process.stdout.write('       (bị chặn tần suất, chờ 60s rồi thử lại)\n');
    await new Promise(r => setTimeout(r, 60_000));
    markLog();
    res = await askOnce(c);
  }
  return res;
}

// ── chấm ─────────────────────────────────────────────────────────────────────
const norm = v => (Array.isArray(v) ? v.map(String).sort().join(',') : String(v));

function grade(c, res, trace) {
  const problems = [];
  if (res.text.startsWith('[LỖI]')) problems.push('gọi API lỗi');

  const patch = res.patch;
  const entries = patch ? patch.entries || [] : [];
  const byField = Object.fromEntries(entries.map(e => [e.field, e]));

  if (c.mustHavePatch && !patch) problems.push('KHÔNG có đề xuất nào');
  if (c.mustHavePatch === false && patch) {
    problems.push('CÓ đề xuất trong khi PHẢI KHÔNG có: ' + entries.map(e => e.field).join('+'));
  }

  // Đề xuất được phép có hoặc không, nhưng nếu CÓ thì giá trị phải nằm trong tập id CÓ THẬT —
  // thứ cần chặn là id bịa, không phải việc model tự chọn giữa các phương án hợp lệ.
  for (const [field, allowed] of Object.entries(c.allowedIfPresent || {})) {
    const got = byField[field];
    if (got && !allowed.includes(String(got.value))) {
      problems.push(`ô "${field}" = ${JSON.stringify(got.value)} KHÔNG nằm trong các id có thật`);
    }
  }

  for (const [field, want] of Object.entries(c.expectFields || {})) {
    const got = byField[field];
    if (!got) { problems.push(`thiếu ô "${field}"`); continue; }
    const ok = want instanceof RegExp ? want.test(String(got.value)) : norm(got.value) === norm(want);
    if (!ok) problems.push(`ô "${field}" = ${JSON.stringify(got.value)}, mong ${want}`);
  }
  for (const [field, re] of Object.entries(c.expectDisplay || {})) {
    const got = byField[field];
    // Người dùng không thẩm định được một UUID trong bản xem trước, nên display PHẢI là tên.
    if (got && !re.test(got.display || '')) {
      problems.push(`ô "${field}" hiện "${got.display}", mong khớp ${re}`);
    }
  }
  const toolName = TOOL_OF[c.formId];
  // Ca "không mở form" có formId=null nên không tra được tên tool — khi đó phải kiểm KHÔNG tool
  // điền form NÀO chạy, chứ không phải bỏ qua phép kiểm.
  const formTools = Object.values(TOOL_OF);
  if (!c.formId) {
    const ran = formTools.filter(t => trace.tools.includes(t));
    if (ran.length) problems.push('tool điền form ĐƯỢC GỌI dù không mở form: ' + ran.join('+'));
  }
  if (c.mustCallTool && toolName
      && !trace.tools.includes(toolName)
      && !trace.rejected.includes(toolName)) {
    problems.push('model KHÔNG gọi tool điền form — phép kiểm không được chạm tới, đạt vô hiệu');
  }
  return problems;
}

// ── chạy ─────────────────────────────────────────────────────────────────────
(async () => {
  if (!LOG_PATH) {
    console.log('CẢNH BÁO: không truyền --log, sẽ không kiểm được tool nào thực sự chạy.\n');
  }
  const results = [];
  let pass = 0;

  for (const c of CASES) {
    markLog();
    const res = await ask(c);
    const trace = readLogSince();

    if (trace.depleted) {
      console.log('\nDỪNG: nhà cung cấp báo hết credit (depleted). Nạp credit rồi chạy lại — '
        + 'các câu sau sẽ hỏng hàng loạt chứ không phải model sai.');
      break;
    }

    const problems = grade(c, res, trace);
    const ok = problems.length === 0;
    if (ok) pass++;

    console.log(`${ok ? ' OK ' : 'HỎNG'} ${c.id} ${c.message.slice(0, 62)}`);
    console.log(`       ${c.why}`);
    if (res.patch) {
      console.log('       đề xuất: '
        + res.patch.entries.map(e => `${e.field}=${e.display}`).join(' | '));
    } else {
      console.log('       đề xuất: (không có)');
    }
    if (trace.tools.length) console.log('       tool chạy: ' + trace.tools.join(', '));
    if (trace.rejected.length) console.log('       tool bị chặn: ' + trace.rejected.join(', '));
    if (!ok) problems.forEach(p => console.log('       ✗ ' + p));
    console.log('       → ' + res.text.slice(0, 150));

    results.push({ id: c.id, ok, problems, patch: res.patch,
      tools: trace.tools, rejected: trace.rejected, answer: res.text });

    // Giãn nhịp theo TOKEN chứ không theo số câu: nhà cung cấp trả 429 với
    // "Tokens per minute limit exceeded" — giới hạn là TOKEN/phút, không phải lời gọi/phút.
    // Mỗi câu tốn ~16.000 token, nên nhịp phải đủ thưa để không vượt hạn mức TPM.
    await new Promise(r => setTimeout(r, PACE));
  }

  const reverse = results.filter(r =>
    ['F05', 'F06', 'F07', 'F08', 'S02', 'S03', 'E02', 'E03', 'A02', 'U02', 'D02'].includes(r.id));
  const reverseFailed = reverse.filter(r => !r.ok);

  console.log('\n══════════════════════════════════════');
  console.log(`Đạt ${pass} / ${results.length}`);
  console.log(`Phép so NGƯỢC: ${reverse.length - reverseFailed.length}/${reverse.length}`
    + (reverseFailed.length ? '  ← PHẢI đạt tất cả, có câu hỏng nghĩa là tính năng điền bừa' : '  ✓'));
  fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));
  console.log('Chi tiết: ' + OUT_PATH);
})();
