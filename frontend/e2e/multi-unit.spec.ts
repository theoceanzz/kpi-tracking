import { execFileSync } from 'node:child_process'
import { expect, test, type Page } from '@playwright/test'

/**
 * Hai luồng đơn vị chính / kiêm nhiệm (CLAUDE.md "Đơn vị chính", "% công sức") trên app THẬT:
 * staff@demo.com (Team Backend) được gán kiêm nhiệm Team Content và nhận thêm một KPI 100% ở đó
 * trong đợt "Tháng 9x" (đã kết thúc ⇒ quản lý chấm được ngay). Đi qua:
 *   1. người phòng khác chưa xem được điểm của staff (score-preview 403), gán kiêm nhiệm xong thì xem được;
 *   2. màn Thành viên của Team Content hiện nhãn "Kiêm nhiệm";
 *   3. form Sửa người dùng: "Đơn vị chính", danh sách kiêm nhiệm, nhập % công sức 70/30 rồi lưu;
 *   4. trưởng Team Content: nút "Chấm" của staff bị khoá với lý do "Do trưởng đơn vị chính … chấm";
 *   5. trưởng Team Backend mở phiếu chấm: khung "% công sức" 70/30 (KHÔNG lưu phiếu);
 *   6. không màn nào trả 403 hay bị bộ kiểm quyền chặn.
 * Dữ liệu dựng thêm được xoá ở afterAll (kể cả khi test hỏng).
 *
 * Chạy: E2E_PASSWORD=<mật khẩu tài khoản mẫu> npx playwright test e2e/multi-unit.spec.ts
 * Cần app + backend + DB dev đang chạy và `psql` (đường dẫn qua E2E_PSQL, mặc định PG16 trên Windows).
 */
const PASSWORD = process.env.E2E_PASSWORD ?? ''
const PSQL = process.env.E2E_PSQL ?? 'C:/Program Files/PostgreSQL/16/bin/psql.exe'
const DB = { user: process.env.E2E_DB_USER ?? 'postgres', password: process.env.E2E_DB_PASSWORD ?? '123456', name: process.env.E2E_DB_NAME ?? 'kpitracking' }

const STAFF = 'staff@demo.com'
const DIRECTOR = 'director@demo.com'
const BACKEND_HEAD = 'teamlead@demo.com'
const CONTENT_HEAD = 'cont.teamlead@demo.com'
const CONTENT_STAFF = 'cont.staff@demo.com'
const TEAM_BACKEND = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
const TEAM_CONTENT = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
const KPI_NAME = 'E2E kiêm nhiệm Team Content'
const PERIOD_NAME = 'Tháng 9x'

function sql(query: string): string {
  // Câu SQL đi qua stdin: tham số dòng lệnh trên Windows đổi sang bảng mã ANSI, làm hỏng chữ tiếng Việt.
  return execFileSync(PSQL, ['-U', DB.user, '-d', DB.name, '-At', '-v', 'ON_ERROR_STOP=1', '-f', '-'], {
    env: { ...process.env, PGPASSWORD: DB.password, PGCLIENTENCODING: 'UTF8' }, encoding: 'utf8', input: query,
  }).trim()
}

/** Gỡ mọi thứ kịch bản này dựng (chạy cả trước lẫn sau, để lần chạy hỏng trước không làm bẩn lần sau). */
function cleanUp() {
  sql(`
    DELETE FROM kpi_criteria_assignees WHERE kpi_criteria_id IN (SELECT id FROM kpi_criteria WHERE name = '${KPI_NAME}');
    DELETE FROM quantitative_kpi_details WHERE kpi_criteria_id IN (SELECT id FROM kpi_criteria WHERE name = '${KPI_NAME}');
    DELETE FROM kpi_criteria WHERE name = '${KPI_NAME}';
    DELETE FROM user_unit_effort_shares WHERE user_id = (SELECT id FROM users WHERE email = '${STAFF}');
    DELETE FROM user_period_effort_shares WHERE user_id = (SELECT id FROM users WHERE email = '${STAFF}');
    DELETE FROM user_role_org_units WHERE org_unit_id = '${TEAM_CONTENT}' AND user_id = (SELECT id FROM users WHERE email = '${STAFF}');
    UPDATE users SET primary_org_unit_id = '${TEAM_BACKEND}' WHERE email = '${STAFF}';`)
}

interface ApiResult { status: number; json: { data?: unknown } | null }

/** Gọi API trong phiên đang đăng nhập (cookie + CSRF như axios của app). */
async function api(page: Page, method: string, path: string, body?: unknown): Promise<ApiResult> {
  return page.evaluate(async ({ method, path, body }) => {
    const csrf = document.cookie.split('; ').find(c => c.startsWith('kg_csrf='))?.split('=')[1]
    const r = await fetch('/api/v1' + path, {
      method, credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-XSRF-TOKEN': decodeURIComponent(csrf) } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await r.text()
    let json = null
    try { json = JSON.parse(text) } catch { /* không phải JSON */ }
    return { status: r.status, json }
  }, { method, path, body })
}

function watch(page: Page) {
  const offences: string[] = []
  const expected = new Set<string>()
  page.on('response', r => {
    if (r.status() === 403 && r.url().includes('/api/')) {
      const key = `${r.request().method()} ${new URL(r.url()).pathname}`
      if (!expected.has(key)) offences.push(`403 ${key}`)
    }
  })
  page.on('console', m => {
    if (m.type() === 'error' && m.text().includes('[permission precheck]')) offences.push(m.text())
  })
  /** 403 do chính kịch bản cố ý gọi (kiểm chặn quyền) — không tính là lỗi màn hình. */
  return { offences, allow403: (key: string) => expected.add(key) }
}

async function dismissTours(page: Page) {
  for (let i = 0; i < 5; i++) {
    const overlay = page.locator('#react-joyride-portal, .react-joyride__overlay, [data-test-id="overlay"]')
    if (!(await overlay.count())) return
    const skip = page.locator('button[data-action="skip"], button[data-action="close"], button[aria-label="Close"]').first()
    if (await skip.isVisible().catch(() => false)) await skip.click({ timeout: 2_000 }).catch(() => {})
    else await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
  }
}

async function login(page: Page, email: string) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/login')
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(PASSWORD)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30_000 })
  await page.waitForTimeout(800)
  await dismissTours(page)
}

async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1_500)
  await dismissTours(page)
}

/** Chọn một mục của Select (Radix) theo nhãn aria của ô chọn. */
async function choose(page: Page, triggerLabel: string, option: string) {
  await page.getByRole('combobox', { name: triggerLabel }).click()
  // Đợt đã qua bị thu gọn sau nút "Xem N đợt đã qua" (ScopeSelectItems).
  const option_ = page.getByRole('option', { name: option }).first()
  if (!(await option_.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: /Xem \d+ .* đã qua/ }).click()
  }
  await option_.click()
  await page.waitForTimeout(1_200)
}

let staffId = ''
let staffName = ''
let periodId = ''

test.describe.serial('đơn vị chính + kiêm nhiệm trên app thật', () => {
  test.skip(!PASSWORD, 'Đặt E2E_PASSWORD (mật khẩu tài khoản mẫu) để chạy')

  test.beforeAll(() => {
    cleanUp()
    staffId = sql(`SELECT id FROM users WHERE email = '${STAFF}'`)
    // Tìm dòng theo họ tên: email "cont.staff@demo.com" cũng chứa chuỗi "staff@demo.com".
    staffName = sql(`SELECT full_name FROM users WHERE email = '${STAFF}'`)
    periodId = sql(`SELECT id FROM kpi_periods WHERE name = '${PERIOD_NAME}' AND deleted_at IS NULL LIMIT 1`)
    expect(staffId).not.toBe('')
    expect(periodId).not.toBe('')
  })

  test.afterAll(() => cleanUp())

  test('1. người phòng khác chưa xem được điểm của staff', async ({ page }) => {
    const w = watch(page)
    w.allow403('GET /api/v1/evaluations/score-preview')
    await login(page, CONTENT_STAFF)
    const r = await api(page, 'GET', `/evaluations/score-preview?kpiPeriodId=${periodId}&userId=${staffId}`)
    expect(r.status).toBe(403)
    expect(w.offences).toEqual([])
  })

  test('2. giám đốc gán kiêm nhiệm Team Content ⇒ màn Thành viên hiện nhãn "Kiêm nhiệm"', async ({ page }) => {
    const w = watch(page)
    await login(page, DIRECTOR)
    const roles = await api(page, 'GET', `/user-roles/user/${staffId}`)
    const staffRole = (roles.json?.data as { orgUnitId: string; roleId: string }[]).find(r => r.orgUnitId === TEAM_BACKEND)!.roleId
    const assigned = await api(page, 'POST', '/user-roles/assign', { userId: staffId, roleId: staffRole, orgUnitId: TEAM_CONTENT })
    expect([200, 201]).toContain(assigned.status)
    // KPI 100% ở Team Content cho đợt Tháng 9x (Team Backend đã có KPI của staff).
    sql(`
      WITH k AS (
        INSERT INTO kpi_criteria (org_unit_id, kpi_period_id, name, kpi_type, weight, frequency, origin, is_bonus_kpi, status, created_by, created_at, updated_at)
        SELECT '${TEAM_CONTENT}', '${periodId}', '${KPI_NAME}', 'QUANTITATIVE', 100, frequency, origin, false, 'APPROVED',
               (SELECT id FROM users WHERE email = '${DIRECTOR}'), now(), now()
          FROM kpi_criteria WHERE kpi_period_id = '${periodId}' LIMIT 1
        RETURNING id)
      INSERT INTO quantitative_kpi_details (kpi_criteria_id, target_value, is_reverse_kpi) SELECT id, 100, false FROM k;
      INSERT INTO kpi_criteria_assignees (kpi_criteria_id, user_id)
        SELECT id, '${staffId}' FROM kpi_criteria WHERE name = '${KPI_NAME}';`)

    await open(page, `/org-units/${TEAM_CONTENT}`)
    const row = page.locator('tr', { hasText: staffName })
    await expect(row).toBeVisible({ timeout: 15_000 })
    await expect(row.getByText('Kiêm nhiệm', { exact: true })).toBeVisible()
    // Đơn vị chính không đổi.
    expect(sql(`SELECT primary_org_unit_id FROM users WHERE id = '${staffId}'`)).toBe(TEAM_BACKEND)
    expect(w.offences).toEqual([])
  })

  test('3. form Sửa người dùng: đơn vị chính, kiêm nhiệm, % công sức 70/30', async ({ page }) => {
    const w = watch(page)
    await login(page, DIRECTOR)
    await open(page, '/company?section=users')
    // Trang mặc định lọc đúng đơn vị gốc — chọn đơn vị chính của staff như người dùng bấm.
    await page.locator('[data-tour="users.unit-filter"]').click()
    await page.getByRole('option', { name: /Team Backend/ }).first().click()
    await page.waitForTimeout(1_500)
    await dismissTours(page)
    const row = page.locator('tr', { hasText: staffName })
    await row.locator('[data-tour="users.row-menu"]').click()
    await page.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }).locator('visible=true').first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Đơn vị chính', { exact: true })).toBeVisible()
    await expect(dialog.locator('p', { hasText: 'Còn kiêm nhiệm ở:' })).toContainText('Team Content')
    await expect(dialog.getByText('% công sức khi tính điểm KPI')).toBeVisible()
    const backend = dialog.getByLabel('% công sức ở Team Backend')
    const content = dialog.getByLabel('% công sức ở Team Content')
    await expect(backend).toHaveValue('50')
    await expect(content).toHaveValue('50')

    // Tổng sai thì không lưu.
    await backend.fill('80')
    await content.fill('30')
    await dialog.getByRole('button', { name: 'Cập nhật' }).click()
    await expect(dialog.getByText('Tổng % công sức phải bằng 100% (đang là 110%)')).toBeVisible()

    await backend.fill('70')
    await page.getByRole('button', { name: 'Cập nhật' }).click()
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 15_000 })

    const user = await api(page, 'GET', `/users/${staffId}`)
    const shares = (user.json?.data as { effortShares: { orgUnitId: string; sharePercent: number; configured: boolean }[] }).effortShares
    expect(shares.map(s => [s.orgUnitId, s.sharePercent, s.configured])).toEqual([[TEAM_BACKEND, 70, true], [TEAM_CONTENT, 30, true]])
    // Lưu form (không đổi đơn vị) không được làm mất vai trò ở Team Content.
    expect(sql(`SELECT count(*) FROM user_role_org_units WHERE user_id = '${staffId}' AND org_unit_id = '${TEAM_CONTENT}'`)).toBe('1')

    // Mở lại: ô nhập giữ 70 / 30.
    await row.locator('[data-tour="users.row-menu"]').click()
    await page.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }).locator('visible=true').first().click()
    await expect(page.getByRole('dialog').getByLabel('% công sức ở Team Backend')).toHaveValue('70')
    await expect(page.getByRole('dialog').getByLabel('% công sức ở Team Content')).toHaveValue('30')
    await page.keyboard.press('Escape')
    expect(w.offences).toEqual([])
  })

  test('4. trưởng Team Content: nút "Chấm" của staff bị khoá, xem được điểm', async ({ page }) => {
    const w = watch(page)
    await login(page, CONTENT_HEAD)
    await open(page, '/performance?section=submissions-org-unit')
    await choose(page, 'Đợt đánh giá', PERIOD_NAME)
    const row = page.locator('tr', { hasText: staffName })
    await expect(row.first()).toBeVisible({ timeout: 15_000 })
    await expect(row.first().getByText('Do trưởng đơn vị chính (Team Backend) chấm')).toBeVisible()
    await expect(row.first().getByRole('button', { name: 'Chấm' })).toBeDisabled()

    const preview = await api(page, 'GET', `/evaluations/score-preview?kpiPeriodId=${periodId}&userId=${staffId}`)
    expect(preview.status).toBe(200)
    expect(w.offences).toEqual([])
  })

  test('5. trưởng Team Backend mở phiếu chấm: khung % công sức 70/30', async ({ page }) => {
    const w = watch(page)
    await login(page, BACKEND_HEAD)
    await open(page, '/performance?section=submissions-org-unit')
    await choose(page, 'Đợt đánh giá', PERIOD_NAME)
    const row = page.locator('tr', { hasText: staffName }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.getByRole('button', { name: 'Chấm' }).click()

    const dialog = page.getByRole('dialog')
    const note = dialog.getByRole('note')
    await expect(note.getByText('Người này kiêm nhiệm — điểm KPI chia theo % công sức')).toBeVisible({ timeout: 15_000 })
    await expect(note.getByText(/Team Backend: 70%/)).toBeVisible()
    await expect(note.getByText(/Team Content: 30%/)).toBeVisible()

    const preview = await api(page, 'GET', `/evaluations/score-preview?kpiPeriodId=${periodId}&userId=${staffId}`)
    const data = preview.json?.data as { effortShares: { sharePercent: number }[]; kpiWeightFactors: Record<string, number> }
    expect(data.effortShares.map(b => b.sharePercent)).toEqual([70, 30])
    // Demo: KPI Team Backend của đợt đều ĐỊNH TÍNH ⇒ trục định lượng chỉ có nhánh Team Content nên được
    // chuẩn hoá về 100% (hệ số = 100 / trọng số 100 = 1); trục "Hành vi" thuộc trọn Team Backend.
    const contentKpi = sql(`SELECT id FROM kpi_criteria WHERE name = '${KPI_NAME}'`)
    expect(data.kpiWeightFactors[contentKpi]).toBeCloseTo(1, 6)
    const backendQual = sql(`SELECT k.id FROM kpi_criteria k JOIN kpi_criteria_assignees a ON a.kpi_criteria_id = k.id
      WHERE a.user_id = '${staffId}' AND k.kpi_period_id = '${periodId}' AND k.org_unit_id = '${TEAM_BACKEND}'
        AND k.kpi_type = 'QUALITATIVE' AND k.weight > 0 AND k.deleted_at IS NULL LIMIT 1`)
    if (backendQual) expect(data.kpiWeightFactors[backendQual]).toBeGreaterThan(0)
    // Không lưu phiếu: đóng lại để không sinh đánh giá thật (và không chụp % cho đợt).
    await page.keyboard.press('Escape')
    expect(sql(`SELECT count(*) FROM user_period_effort_shares WHERE user_id = '${staffId}'`)).toBe('0')
    expect(w.offences).toEqual([])
  })
})
