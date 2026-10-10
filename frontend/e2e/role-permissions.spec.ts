import { expect, test, type Page } from '@playwright/test'

/**
 * Lớp 2 chống lỗi "màn gọi API vượt quyền" (lỗi prod 2026-10-06): đăng nhập từng VAI TRÒ, đi qua các màn
 * họ dùng, và đòi KHÔNG có:
 *   - response 403 nào từ /api/;
 *   - lời gọi nào bị bộ kiểm quyền phía frontend chặn (`[permission precheck]` — dev chạy chế độ block
 *     nên lời gọi vượt quyền bị chặn trước khi tới backend và in console.error).
 * Thêm kịch bản đổi tài khoản trong CÙNG công ty (giám đốc → đăng xuất → nhân viên).
 *
 * Chạy: E2E_PASSWORD=<mật khẩu tài khoản mẫu> npm run e2e   (app + backend + DB dev phải đang chạy).
 * Mật khẩu KHÔNG ghi trong repo (SECURITY_AUDIT C3). Tài khoản đổi được qua E2E_DIRECTOR / E2E_HEAD / E2E_STAFF.
 */
const PASSWORD = process.env.E2E_PASSWORD ?? ''
const ACCOUNTS = {
  director: process.env.E2E_DIRECTOR ?? 'director@demo.com',
  head: process.env.E2E_HEAD ?? 'head@demo.com',
  staff: process.env.E2E_STAFF ?? 'staff@demo.com',
}

/** Màn mọi vai trò đều dùng ("của tôi" + chung). */
const COMMON_PAGES = [
  '/dashboard', '/me', '/my-kpi', '/my-tasks', '/tasks', '/submissions', '/submissions/new',
  '/evaluations', '/my-adjustments', '/notifications', '/profile', '/documents', '/kpi-setup',
]
/** Màn quản lý — vai trò có quyền thì vào được; không có thì bị PermissionRoute đẩy đi, cũng không được 403. */
const MANAGER_PAGES = [
  '/kpi-criteria', '/kpi-criteria/pending', '/kpi-adjustments/pending', '/submissions/org-unit',
  '/kpi-cycles/evaluation', '/org-structure', '/analytics', '/performance',
]

interface Offence { page: string; what: string }

/** Ghi lại mọi 403 và mọi lời gọi bị chặn trước, gắn với màn đang mở. */
function watch(page: Page) {
  const offences: Offence[] = []
  let current = '(login)'
  // Đếm request /api/ đang bay: kết nối realtime giữ mạng không bao giờ "idle" nên không dùng networkidle.
  let inflight = 0
  const isApi = (url: string) => url.includes('/api/')
  page.on('request', r => { if (isApi(r.url())) inflight++ })
  page.on('requestfinished', r => { if (isApi(r.url())) inflight-- })
  page.on('requestfailed', r => { if (isApi(r.url())) inflight-- })
  page.on('response', r => {
    if (r.status() === 403 && r.url().includes('/api/')) {
      offences.push({ page: current, what: `403 ${r.request().method()} ${new URL(r.url()).pathname}` })
    }
  })
  page.on('console', m => {
    if (m.type() === 'error' && m.text().includes('[permission precheck]')) {
      offences.push({ page: current, what: m.text() })
    }
  })
  return {
    offences,
    at: (p: string) => { current = p },
    /** Đợi tới khi không còn request /api/ nào trong ~700ms (trần 12s). */
    settle: async () => {
      const until = Date.now() + 12_000
      let quietSince = Date.now()
      while (Date.now() < until) {
        if (inflight > 0) quietSince = Date.now()
        else if (Date.now() - quietSince > 700) return
        await page.waitForTimeout(100)
      }
    },
  }
}

/**
 * Tài khoản mẫu chưa xem bài hướng dẫn nào nên tour (Joyride) tự bật và phủ lớp mờ chặn mọi cú bấm.
 * Đóng nó như người dùng bấm "Bỏ qua" — được ghi nhận là đã xem nên màn sau không bật lại.
 */
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
  await page.goto('/login')
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(PASSWORD)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30_000 })
}

async function logout(page: Page) {
  await page.goto('/dashboard')
  await page.waitForTimeout(800)
  await dismissTours(page)
  await page.getByTestId('user-menu').click()
  await page.getByTestId('sign-out').click()
  await page.waitForURL(u => u.pathname.startsWith('/login'), { timeout: 30_000 })
}

async function visit(page: Page, w: ReturnType<typeof watch>, path: string) {
  w.at(path)
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await w.settle()
  await dismissTours(page)
  await w.settle()
}

const report = (o: Offence[]) => o.map(x => `  [${x.page}] ${x.what}`).join('\n')

test.describe('không màn nào gọi API vượt quyền của người dùng', () => {
  test.skip(!PASSWORD, 'Đặt E2E_PASSWORD (mật khẩu tài khoản mẫu) để chạy')

  for (const [role, email] of Object.entries(ACCOUNTS)) {
    test(`${role} (${email}): không 403, không lời gọi bị chặn`, async ({ page }) => {
      const w = watch(page)
      await login(page, email)
      for (const path of [...COMMON_PAGES, ...MANAGER_PAGES]) await visit(page, w, path)
      expect(w.offences, `Lời gọi vượt quyền:\n${report(w.offences)}`).toEqual([])
    })
  }

  test('cùng công ty: giám đốc → đăng xuất → nhân viên — không 403, hồ sơ đúng người mới', async ({ page }) => {
    const w = watch(page)
    await login(page, ACCOUNTS.director)
    for (const path of ['/dashboard', '/evaluations', '/org-structure']) await visit(page, w, path)
    await logout(page)

    await login(page, ACCOUNTS.staff)
    for (const path of ['/dashboard', '/my-kpi', '/evaluations', '/submissions']) await visit(page, w, path)

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('auth-storage') ?? '{}')?.state?.user?.email)
    expect(stored).toBe(ACCOUNTS.staff)
    expect(w.offences, `Lời gọi vượt quyền sau khi đổi tài khoản:\n${report(w.offences)}`).toEqual([])
  })
})
