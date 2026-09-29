#!/usr/bin/env node
/**
 * Bộ đo AI đọc bài nộp và đề xuất điểm — đường REST riêng (/ai/submission-reviews), KHÔNG qua khung chat.
 *
 *   node run-submission-review.js [--enable]
 *
 * --enable : bật tính năng cho tổ chức demo trước khi đo (director, quyền AI_REVIEW:CONFIG).
 *
 * Bốn ca, theo tài liệu kế hoạch mục B11:
 *   R1 ca đúng       — trưởng phòng nhờ AI đọc bài nộp của nhân viên mình -> DONE, có nhãn, số do hệ thống
 *                      tính, điểm không vượt trọng số, nhận xét chất lượng luôn kèm trích dẫn
 *   R2 thiếu dữ liệu — đợt nhân viên chưa nộp gì -> mức tin cậy THAP, nói rõ là thiếu
 *   R3 bẫy phạm vi   — trưởng phòng IT xin phân tích nhân viên phòng khác -> 403, không lộ tên / số
 *   R4 thiếu quyền   — nhân viên thường gọi API -> 403
 *
 * Giai đoạn 2–3 (--phase2; cần psql để gắn tạm tệp minh chứng, dọn sạch sau khi chạy):
 *   R5 bộ tiêu chí     — giám đốc tải quy chế mẫu (.docx) -> AI bóc bản nháp có đoạn gốc KHỚP tài liệu -> xác nhận
 *   R9 tắt theo đơn vị — tắt riêng đơn vị của nhân viên -> trưởng phòng bị 403; bỏ cấu hình -> theo lại công ty
 *   R6 đọc minh chứng  — gắn tạm .docx + ảnh + .mp4 + tệp ngoài kho -> đọc 2/4, hai tệp còn lại có lý do,
 *                        lượt ghi phiên bản bộ tiêu chí, nhận xét dùng tới nội dung tệp
 *   R7 chạy theo lô    — trưởng phòng chạy cả đơn vị -> 200, có người được xếp hàng / dùng lại
 *   R8 báo cáo lệch    — giám đốc xem báo cáo đợt -> 200, có dòng của nhân viên vừa chạy
 * Bộ tiêu chí mẫu bị xoá sau khi đo (--keep-criteria để giữ).
 *
 * Nghiệm thu (--acceptance "<tên đợt>" [--run]): sai số AI so với điểm quản lý trên cả tổ chức — xem acceptance().
 *
 * Mỗi lượt R1/R2 gọi mô hình thật (tốn token) — chỉ chạy khi sửa đúng luồng này.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');

const PSQL = process.env.PSQL || 'C:/Program Files/PostgreSQL/16/bin/psql.exe';
const FIXTURES = path.join(__dirname, 'fixtures', 'ai-review');
const FIXTURE_PORT = 3157;

function sql(q) {
  return execFileSync(PSQL, ['-U', 'postgres', '-h', 'localhost', '-d', process.env.PGDATABASE || 'kpitracking', '-Atc', q],
    { env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || '123456' }, encoding: 'utf8' }).trim();
}

/** Máy chủ tệp tạm: backend tải minh chứng mẫu qua http://localhost (dev có localhost trong allowed-hosts). */
function serveFixtures() {
  const srv = http.createServer((req, res) => {
    const f = path.join(FIXTURES, path.basename(decodeURIComponent(req.url)));
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200);
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(ok => srv.listen(FIXTURE_PORT, () => ok(srv)));
}

const BASE = process.env.AI_TEST_BASE || 'http://localhost:8081/api/v1';
const BANK = JSON.parse(fs.readFileSync(path.join(__dirname, 'ai-questions.json'), 'utf8'));
const ACCOUNTS = {
  ...BANK.accounts,
  otherStaff: { email: 'cont.staff@demo.com', password: 'Demo123@', note: 'Nhân viên Team Content — NGOÀI phạm vi trưởng phòng IT' },
  deputyDir: { email: 'deputy.dir@demo.com', password: 'Demo123@', note: 'Phó giám đốc — có chỉ tiêu nhưng CHƯA nộp bài nào (ca thiếu dữ liệu)' },
};
const args = process.argv.slice(2);
const tokens = {};

async function loginAs(key) {
  if (tokens[key]) return tokens[key];
  const acc = ACCOUNTS[key];
  const r = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: acc.email, password: acc.password }),
  });
  const cookies = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [];
  for (const c of cookies) {
    const m = /^kg_at=([^;]+)/.exec(c);
    if (m && m[1]) return (tokens[key] = m[1]);
  }
  throw new Error('Đăng nhập hỏng: ' + acc.email);
}

async function call(key, method, url, body) {
  const token = await loginAs(key);
  const r = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await r.json(); } catch { /* không có thân */ }
  return { status: r.status, json };
}

const me = async key => (await call(key, 'GET', '/auth/me')).json.data;

/** Đợt đầu tiên mà nhân viên CÓ (want=true) / KHÔNG có (want=false) bài nộp. */
async function periodWith(staffId, want) {
  const periods = (await call('head', 'GET', '/kpi-periods?size=100')).json.data;
  const list = Array.isArray(periods) ? periods : (periods.content || []);
  for (const p of list) {
    const subs = (await call('head', 'GET', `/submissions?submittedById=${staffId}&kpiPeriodId=${p.id}&size=1`)).json.data;
    const n = subs.totalElements ?? (subs.content || []).length;
    if ((n > 0) === want) return p;
  }
  return null;
}

async function runReview(userId, periodId, rerun, as = 'head') {
  let r = await call(as, 'POST', '/ai/submission-reviews', { kpiPeriodId: periodId, userId });
  if (r.status !== 200) return { error: `HTTP ${r.status}: ${r.json && r.json.message}` };
  let review = r.json.data;
  if (rerun && review.status === 'DONE') {
    review = (await call(as, 'POST', `/ai/submission-reviews/${review.id}/rerun`)).json.data;
  }
  const deadline = Date.now() + 180_000;
  while (review.status === 'QUEUED' || review.status === 'RUNNING') {
    if (Date.now() > deadline) return { error: 'quá 180 giây vẫn chưa xong' };
    await new Promise(res => setTimeout(res, 3000));
    review = (await call(as, 'GET', `/ai/submission-reviews/${review.id}`)).json.data;
  }
  return { review };
}

function report(id, title, problems, extra) {
  console.log(`${problems.length ? 'HỎNG' : ' OK '} ${id} ${title}`);
  if (extra) console.log('       ' + extra);
  for (const p of problems) console.log('       ✗ ' + p);
  return problems.length === 0;
}

(async () => {
  if (args.includes('--acceptance')) return acceptance();
  if (args.includes('--enable')) {
    const r = await call('director', 'PUT', '/ai/submission-reviews/settings',
      { enabled: true, weightTarget: 60, weightQuality: 30, weightOnTime: 10 });
    console.log('Bật tính năng cho tổ chức demo:', r.status === 200 ? 'xong' : `HTTP ${r.status}`);
  }

  const staff = await me('staff');
  const other = await me('otherStaff');
  let pass = 0, total = 0;

  // --phase2: chỉ các ca giai đoạn 2–3 (R6 đã gồm các kiểm của R1 trên lượt có tệp).
  if (args.includes('--phase2')) {
    const r = await phase2(staff);
    console.log('\n══════════════════════════════════════');
    console.log(`Đạt ${r.pass} / ${r.total}`);
    return;
  }

  // R1 — ca đúng
  total++;
  {
    const p = await periodWith(staff.id, true);
    const started = Date.now();
    const { review, error } = p ? await runReview(staff.id, p.id, args.includes('--rerun')) : { error: 'không tìm thấy đợt có bài nộp' };
    const problems = [];
    if (error) problems.push(error);
    else {
      if (review.status !== 'DONE') problems.push('trạng thái ' + review.status + ' — ' + review.errorMessage);
      if (!/AI gợi ý/.test(review.disclaimer || '')) problems.push('thiếu nhãn "Kết quả do AI gợi ý"');
      if (!review.items.length) problems.push('không có kết quả chỉ tiêu nào');
      for (const it of review.items) {
        if (it.suggestedScore != null && it.weight != null && it.suggestedScore > it.weight + 1e-9) {
          problems.push(`${it.kpiCriteriaName}: điểm ${it.suggestedScore} vượt trọng số ${it.weight}`);
        }
        if (it.qualityComment && !(it.evidenceQuotes || []).length) {
          problems.push(`${it.kpiCriteriaName}: nhận xét chất lượng không kèm trích dẫn`);
        }
        if (it.errorMessage) problems.push(`${it.kpiCriteriaName}: ${it.errorMessage}`);
      }
    }
    const extra = review ? `đợt ${p.name} · ${review.items.length} chỉ tiêu · tin cậy ${review.confidence} · ${((Date.now() - started) / 1000).toFixed(0)}s`
      + `\n       → ${(review.overallSummary || '').slice(0, 220)}` : null;
    if (review) for (const it of review.items.slice(0, 4)) {
      console.log(`         · ${it.kpiCriteriaName}: đáp ứng ${it.achievementPercent ?? '—'}% · đúng hạn ${it.onTimePercent ?? '—'}% · chất lượng ${it.qualityLevel ?? '—'} · đề xuất ${it.suggestedScore ?? '—'}/${it.weight ?? '?'}`);
    }
    if (report('R1', 'Trưởng phòng nhờ AI đọc bài nộp của nhân viên mình', problems, extra)) pass++;
  }

  // R2 — thiếu dữ liệu: giám đốc xin phân tích phó giám đốc (có chỉ tiêu, chưa nộp bài nào)
  total++;
  {
    const deputy = await me('deputyDir');
    const periods = (await call('director', 'GET', '/kpi-periods?size=100')).json.data;
    const p = (Array.isArray(periods) ? periods : periods.content || []).find(x => x.name === 'Tháng 6/2026');
    const problems = [];
    let extra = null;
    if (!p) problems.push('không tìm thấy đợt Tháng 6/2026');
    else {
      const { review, error } = await runReview(deputy.id, p.id, false, 'director');
      if (error) problems.push(error);
      else {
        if (review.confidence !== 'THAP') problems.push('mức tin cậy ' + review.confidence + ', mong THAP');
        if (!/chưa|thiếu/i.test((review.overallSummary || '') + (review.missingData || []).join(' '))) problems.push('không nói rõ là thiếu dữ liệu');
        if (/xuất sắc|rất tốt|hoàn thành tốt/i.test(review.overallSummary || '')) problems.push('khẳng định chắc nịch khi không có dữ liệu');
        extra = `đợt ${p.name} → ${(review.overallSummary || '').slice(0, 200)}`;
      }
    }
    if (report('R2', 'Đợt nhân viên chưa nộp gì -> tin cậy THAP, nói rõ thiếu', problems, extra)) pass++;
  }

  // R3 — bẫy phạm vi
  total++;
  {
    const p = await periodWith(staff.id, true);
    const r = await call('head', 'POST', '/ai/submission-reviews', { kpiPeriodId: p.id, userId: other.id });
    const problems = [];
    if (r.status !== 403) problems.push('HTTP ' + r.status + ', mong 403');
    const body = JSON.stringify(r.json || {});
    if (body.includes(other.fullName || '@@')) problems.push('LỘ tên người ngoài phạm vi');
    if (report('R3', 'Trưởng phòng IT xin phân tích nhân viên Team Content -> 403', problems, `→ ${(r.json && r.json.message) || ''}`)) pass++;
  }

  // R4 — thiếu quyền
  total++;
  {
    const p = await periodWith(staff.id, true);
    const r = await call('staff', 'POST', '/ai/submission-reviews', { kpiPeriodId: p.id, userId: staff.id });
    const problems = r.status === 403 ? [] : ['HTTP ' + r.status + ', mong 403'];
    if (report('R4', 'Nhân viên thường (không có AI_REVIEW:USE) gọi API -> 403', problems)) pass++;
  }

  console.log('\n══════════════════════════════════════');
  console.log(`Đạt ${pass} / ${total}`);
})().catch(e => { console.error(e); process.exit(1); });

async function phase2(staff) {
  let pass = 0, total = 0;
  const p = await periodWith(staff.id, true);
  const head = await me('head');
  let setId = null;

  // R5 — bộ tiêu chí: máy bóc, người xác nhận
  total++;
  {
    const problems = [];
    let extra = null;
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(path.join(FIXTURES, 'quy-che-danh-gia-mau.docx'))]), 'quy-che-danh-gia-mau.docx');
    const token = await loginAs('director');
    const started = Date.now();
    const r = await fetch(BASE + '/ai/criteria-sets?title=' + encodeURIComponent('Quy chế mẫu (bộ đo)'),
      { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form });
    const json = await r.json().catch(() => null);
    if (r.status !== 200) problems.push(`HTTP ${r.status}: ${json && json.message}`);
    else {
      const set = json.data;
      setId = set.id;
      const items = set.items || [];
      const verified = items.filter(i => i.excerptVerified).length;
      if (set.status !== 'DRAFT') problems.push('bản mới không phải DRAFT');
      if (items.length < 3) problems.push(`chỉ bóc được ${items.length} tiêu chí, mong ≥ 3`);
      if (verified < Math.ceil(items.length / 2)) problems.push(`chỉ ${verified}/${items.length} đoạn gốc khớp tài liệu`);
      const c = await call('director', 'POST', `/ai/criteria-sets/${set.id}/confirm`);
      if (c.status !== 200 || c.json.data.status !== 'CONFIRMED') problems.push('xác nhận hỏng: HTTP ' + c.status);
      extra = `${items.length} tiêu chí (${verified} đoạn gốc khớp) · v${c.json && c.json.data && c.json.data.version} · ${((Date.now() - started) / 1000).toFixed(0)}s`
        + '\n       → ' + items.map(i => `${i.name}${i.weight != null ? ' ' + i.weight + '%' : ''}`).join(' | ');
    }
    if (report('R5', 'Giám đốc tải quy chế -> AI bóc bản nháp có đoạn gốc -> xác nhận', problems, extra)) pass++;
  }

  // R9 — tắt riêng đơn vị của nhân viên
  total++;
  {
    const problems = [];
    const unitId = sql(`select org_unit_id from user_role_org_units where user_id='${staff.id}' limit 1`);
    const put = await call('director', 'PUT', `/ai/submission-reviews/unit-settings/${unitId}`,
      { enabled: false, weightTarget: 60, weightQuality: 30, weightOnTime: 10 });
    if (put.status !== 200) problems.push('lưu cấu hình đơn vị: HTTP ' + put.status);
    const denied = await call('head', 'POST', '/ai/submission-reviews', { kpiPeriodId: p.id, userId: staff.id });
    if (denied.status !== 403) problems.push('đơn vị tắt mà vẫn HTTP ' + denied.status + ', mong 403');
    const del = await call('director', 'DELETE', `/ai/submission-reviews/unit-settings/${unitId}`);
    if (del.status !== 200) problems.push('bỏ cấu hình đơn vị: HTTP ' + del.status);
    if (report('R9', 'Đơn vị tắt riêng -> 403; bỏ cấu hình -> theo lại công ty', problems,
      `→ ${(denied.json && denied.json.message) || ''}`)) pass++;
  }

  // R6 — đọc minh chứng thật (Word + ảnh), tệp không đọc được phải có lý do
  total++;
  {
    const problems = [];
    let extra = null;
    const srv = await serveFixtures();
    const subId = sql(`select s.id from kpi_submissions s join kpi_criteria k on k.id=s.kpi_criteria_id `
      + `where s.submitted_by='${staff.id}' and k.kpi_period_id='${p.id}' and s.deleted_at is null order by s.created_at limit 1`);
    const files = [
      ['bao-cao-thang.docx', `http://localhost:${FIXTURE_PORT}/bao-cao-thang.docx`],
      ['bien-ban-nghiem-thu.png', `http://localhost:${FIXTURE_PORT}/bien-ban-nghiem-thu.png`],
      ['quay-man-hinh.mp4', `http://localhost:${FIXTURE_PORT}/quay-man-hinh.mp4`],
      ['ngoai-kho.docx', 'http://169.254.169.254/latest/meta-data.docx'],
    ];
    const ids = [];
    try {
      for (const [name, url] of files) {
        ids.push(sql(`insert into submission_attachments (submission_id, file_name, file_url, uploaded_by) `
          + `values ('${subId}', '${name}', '${url}', '${staff.id}') returning id`).split(/\r?\n/)[0].trim());
      }
      const started = Date.now();
      const { review, error } = await runReview(staff.id, p.id, true);
      if (error) problems.push(error);
      else {
        if (review.status !== 'DONE') problems.push('trạng thái ' + review.status + ' — ' + review.errorMessage);
        if (review.filesTotal !== 4) problems.push(`tổng tệp ${review.filesTotal}, mong 4`);
        if (review.filesRead !== 2) problems.push(`đọc được ${review.filesRead}, mong 2 (Word + ảnh)`);
        const un = (review.unreadableFiles || []).join(' | ');
        if (!/mp4/.test(un)) problems.push('tệp .mp4 không có trong danh sách không đọc được');
        if (!/ngoai-kho\.docx: tệp không nằm trong kho/.test(un)) problems.push('tệp ngoài kho không bị chặn đúng lý do');
        if (review.criteriaSetVersion == null) problems.push('lượt không ghi phiên bản bộ tiêu chí');
        const text = JSON.stringify(review.items.map(i => [i.summary, i.qualityComment, i.evidenceQuotes, i.strengths]));
        const usedFiles = /14 đầu việc|nghiệm thu|23 lỗi/i.test(text);
        extra = `${((Date.now() - started) / 1000).toFixed(0)}s · đọc ${review.filesRead}/${review.filesTotal} · bộ tiêu chí v${review.criteriaSetVersion}`
          + ` · nhận xét ${usedFiles ? 'CÓ' : 'KHÔNG'} dùng nội dung tệp\n       → không đọc được: ${un}`;
        if (!usedFiles) problems.push('nhận xét không dùng tới nội dung tệp đã đọc');
      }
    } finally {
      if (ids.length) sql(`delete from submission_attachments where id in (${ids.map(i => `'${i}'`).join(',')})`);
      srv.close();
    }
    if (report('R6', 'Đọc minh chứng Word + ảnh; .mp4 và tệp ngoài kho có lý do', problems, extra)) pass++;
  }

  // R7 — chạy theo lô cả đơn vị của trưởng phòng
  total++;
  {
    const problems = [];
    const unitId = sql(`select org_unit_id from user_role_org_units where user_id='${head.id}' limit 1`);
    const r = await call('head', 'POST', `/ai/submission-reviews/batch?kpiPeriodId=${p.id}&orgUnitId=${unitId}`);
    if (r.status !== 200) problems.push('HTTP ' + r.status + ': ' + (r.json && r.json.message));
    const b = (r.json && r.json.data) || {};
    if (r.status === 200 && b.queued + b.reused < 1) problems.push('không xếp hàng / dùng lại ai (mong ≥ 1: nhân viên vừa chạy)');
    if (report('R7', 'Trưởng phòng chạy AI theo lô cả đơn vị', problems,
      `→ xếp hàng ${b.queued} · dùng lại ${b.reused} · bỏ qua ${b.skipped}`)) pass++;
  }

  // R8 — báo cáo lệch AI – quản lý
  total++;
  {
    const problems = [];
    const r = await call('director', 'GET', `/ai/submission-reviews/report?kpiPeriodId=${p.id}`);
    if (r.status !== 200) problems.push('HTTP ' + r.status);
    const rep = (r.json && r.json.data) || { rows: [] };
    if (!rep.rows.some(x => x.userId === staff.id)) problems.push('báo cáo không có dòng của nhân viên vừa chạy');
    if (report('R8', 'Giám đốc xem báo cáo lệch AI – quản lý', problems,
      `→ ${rep.rows.length} người · so được ${rep.compared} · sai số TB ${rep.meanAbsoluteError ?? '—'} · trong ±5: ${rep.withinFivePercent ?? '—'}%`)) pass++;
  }

  // Dọn bộ tiêu chí mẫu: bộ đo không được đổi cách AI chấm của tổ chức demo.
  if (setId && !args.includes('--keep-criteria')) {
    // Chờ lô R7 chạy xong: lượt đang chạy ghi mã bộ tiêu chí lúc hoàn tất, xoá bộ trước đó là lượt hỏng.
    for (let i = 0; i < 90 && sql(`select count(*) from ai_submission_reviews where status in ('QUEUED','RUNNING')`) !== '0'; i++) {
      await new Promise(res => setTimeout(res, 3000));
    }
    sql(`update ai_submission_reviews set criteria_set_id = null where criteria_set_id = '${setId}'`);
    sql(`delete from ai_criteria_sets where id = '${setId}'`);
    // Bộ cả tổ chức bị lưu trữ vì bộ mẫu -> trả lại trạng thái đang dùng.
    sql(`update ai_criteria_sets set status = 'CONFIRMED' where id = (select id from ai_criteria_sets where status = 'ARCHIVED' `
      + `and org_unit_id is null order by confirmed_at desc nulls last limit 1) `
      + `and not exists (select 1 from ai_criteria_sets where status = 'CONFIRMED' and org_unit_id is null)`);
  }
  return { pass, total };
}

/**
 * Nghiệm thu "AI có đáng tin không" (tài liệu mục 8): trên ≥ 100 người đã được quản lý chấm, sai số trung bình
 * ≤ 8 điểm và ≥ 70 % lệch trong ±5 điểm. Đọc báo cáo lệch AI – quản lý của MỘT đợt đã chốt.
 *   --acceptance "Tháng 6/2026"        chỉ đọc kết quả AI đã có (không tốn token)
 *   --acceptance "Tháng 6/2026" --run  chạy AI theo lô cho cả tổ chức trước (TỐN token: ~5 lời gọi / người)
 */
async function acceptance() {
  const i = args.indexOf('--acceptance');
  const name = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
  const periods = (await call('director', 'GET', '/kpi-periods?size=200')).json.data;
  const list = Array.isArray(periods) ? periods : periods.content || [];
  const p = name ? list.find(x => x.name === name) : list[0];
  if (!p) throw new Error('Không tìm thấy đợt ' + (name || '(mới nhất)'));

  if (args.includes('--run')) {
    const director = await me('director');
    const root = sql(`select ou.id from org_units ou join org_hierarchy_levels l on l.id = ou.org_hierarchy_level_id `
      + `where l.organization_id = '${director.memberships[0].organizationId}' and ou.parent_id is null and ou.deleted_at is null limit 1`);
    const r = await call('director', 'POST', `/ai/submission-reviews/batch?kpiPeriodId=${p.id}&orgUnitId=${root}`);
    if (r.status !== 200) throw new Error('Chạy lô hỏng: HTTP ' + r.status + ' ' + (r.json && r.json.message));
    const b = r.json.data;
    console.log(`Chạy lô đợt ${p.name}: xếp hàng ${b.queued} · dùng lại ${b.reused} · bỏ qua ${b.skipped}`);
    for (let k = 0; k < 600 && sql(`select count(*) from ai_submission_reviews where status in ('QUEUED','RUNNING')`) !== '0'; k++) {
      await new Promise(res => setTimeout(res, 5000));
    }
  }

  const rep = (await call('director', 'GET', `/ai/submission-reviews/report?kpiPeriodId=${p.id}`)).json.data;
  const n = rep.compared;
  const okN = n >= 100;
  const okMae = rep.meanAbsoluteError != null && rep.meanAbsoluteError <= 8;
  const okWithin = rep.withinFivePercent != null && rep.withinFivePercent >= 70;
  console.log(`Đợt ${p.name}: ${rep.rows.length} lượt AI · so được ${n} người`);
  console.log(`  ${okN ? ' OK ' : 'THIẾU'} mẫu ≥ 100 người đã chấm (có ${n})`);
  console.log(`  ${okMae ? ' OK ' : 'HỎNG'} sai số trung bình ≤ 8 điểm (${rep.meanAbsoluteError ?? '—'})`);
  console.log(`  ${okWithin ? ' OK ' : 'HỎNG'} ≥ 70 % lệch trong ±5 điểm (${rep.withinFivePercent ?? '—'} %)`);
  console.log(`  độ lệch trung bình ${rep.meanBias ?? '—'} (dương = AI rộng tay hơn)`);
  for (const u of rep.units) console.log(`    · ${u.unitName}: ${u.compared} người · sai số ${u.meanAbsoluteError} · lệch ${u.meanBias}`);
  const worst = rep.rows.filter(x => x.difference != null).slice(0, 5);
  if (worst.length) console.log('  Lệch nhiều nhất: ' + worst.map(x => `${x.userName} (AI ${x.aiScore} / QL ${x.managerScore})`).join(' · '));
  console.log(okN && okMae && okWithin ? '\nĐẠT nghiệm thu' : okN ? '\nCHƯA ĐẠT nghiệm thu' : '\nCHƯA ĐỦ MẪU để kết luận');
}
