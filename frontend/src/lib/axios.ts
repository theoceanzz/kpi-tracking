import axios from 'axios'
import { ENV } from '@/config/env'
import { resetSession, useAuthStore } from '@/store/authStore'
import { useLanguageStore } from '@/store/languageStore'
import { missingPermission, PermissionPrecheckError, requestPath } from '@/lib/apiPermissions'

export const XSRF_COOKIE_NAME = 'kg_csrf'

const axiosInstance = axios.create({
  baseURL: ENV.API_BASE_URL,
  timeout: 100000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  withXSRFToken: true,
  xsrfCookieName: XSRF_COOKIE_NAME,
})

/**
 * Dọn cookie kg_csrf host-only còn sót lại từ cấu hình cũ.
 *
 * Prod chạy SPA ở keygo.vn còn API ở api.keygo.vn; cookie CSRF hiện được cấp với Domain=keygo.vn
 * để cả hai bên cùng thấy. Nhưng trình duyệt của người dùng lâu năm vẫn giữ một bản host-only của
 * keygo.vn (thời API còn chung domain / do handshake /ws cấp qua nginx). Hai cookie cùng tên là
 * hai cookie khác nhau: document.cookie ở keygo.vn liệt kê bản cũ trước nên axios gửi giá trị cũ
 * trong X-XSRF-TOKEN, trong khi api.keygo.vn chỉ nhận được bản Domain → CsrfFilter trả 403 trước
 * khi đọc body. Với multipart lớn, phản hồi sớm đó không về tới XHR và người dùng chỉ thấy upload
 * treo ở vài chục % rồi "quá lâu".
 *
 * Backend không tự chữa được: DuplicateAuthCookieFilter chỉ xoá được cookie host-only của host mà
 * nó đang trả lời (api.keygo.vn); cookie host-only của keygo.vn chỉ JS chạy trên keygo.vn xoá được.
 * Lệnh xoá không kèm Domain nên chỉ chạm tới bản host-only; ở dev (một host, một cookie) không có
 * bản trùng nên không làm gì — không được xoá khi chỉ có một, vì đó chính là cookie đang dùng.
 */
function dropStaleHostOnlyCsrfCookie() {
  try {
    const count = document.cookie
      .split(';')
      .filter((c) => c.trim().startsWith(`${XSRF_COOKIE_NAME}=`)).length
    if (count > 1) {
      const secure = window.location.protocol === 'https:' ? '; Secure' : ''
      document.cookie = `${XSRF_COOKIE_NAME}=; Max-Age=0; Path=/${secure}`
    }
  } catch {
    // document.cookie bị chặn (chế độ riêng tư khắt khe) — bỏ qua, backend vẫn báo lỗi rõ.
  }
}

/**
 * Kiểm quyền TRƯỚC khi gửi (bảng sinh từ @PreAuthorize backend — src/lib/apiPermissions.ts):
 *   block — không gửi, trả lỗi giống 403 + console.error chỉ rõ endpoint/quyền thiếu (mặc định khi dev/test:
 *           màn nào gọi API vượt quyền thì lập trình viên thấy NGAY lúc viết, không đợi người dùng gặp);
 *   warn  — vẫn gửi, chỉ console.warn (mặc định trên prod: backend vẫn là nơi quyết định, bảng có lệch
 *           cũng không làm hỏng tính năng);
 *   off   — tắt.
 * Đổi bằng VITE_API_PERMISSION_GUARD.
 */
const PERMISSION_GUARD: 'block' | 'warn' | 'off' =
  (import.meta.env.VITE_API_PERMISSION_GUARD as 'block' | 'warn' | 'off' | undefined)
  ?? (import.meta.env.PROD ? 'warn' : 'block')

axiosInstance.interceptors.request.use((config) => {
  if (PERMISSION_GUARD !== 'off') {
    const user = useAuthStore.getState().user
    const method = config.method ?? 'get'
    const path = requestPath(config.url, config.baseURL)
    const denied = missingPermission(method, path, user)
    if (denied) {
      const err = new PermissionPrecheckError(method, path, denied.reason)
      if (PERMISSION_GUARD === 'block') {
        console.error(`${err.message} (rule from ${denied.rule.source})`)
        throw err
      }
      console.warn(err.message)
    }
  }
  dropStaleHostOnlyCsrfCookie()
  // Backend dịch lỗi và nội dung theo header này (docs/I18N_DESIGN.md §6).
  config.headers.set('Accept-Language', useLanguageStore.getState().language)
  return config
})

/** Một tab vừa làm mới phiên trong khoảng này thì tab khác KHÔNG gọi nữa — cookie dùng chung, đã mới rồi. */
const RECENT_REFRESH_MS = 5_000
const LAST_REFRESH_KEY = 'kg-last-session-refresh'
let refreshInFlight: Promise<void> | null = null

const readLastRefresh = () => {
  try { return Number(localStorage.getItem(LAST_REFRESH_KEY) ?? 0) } catch { return 0 }
}
const markRefreshed = () => {
  try { localStorage.setItem(LAST_REFRESH_KEY, String(Date.now())) } catch { /* trình duyệt chặn bộ nhớ */ }
}

/**
 * Làm mới phiên — MỘT request một lúc trong tab (các lời gọi đồng thời dùng chung một promise) và giữa các tab
 * (khoá Web Locks: tab sau chờ tab trước xong; tab trước vừa làm mới trong {@link RECENT_REFRESH_MS} thì tab sau
 * không gọi nữa vì cookie dùng chung đã mới). Backend còn có ân hạn cho token vừa xoay (V40) nên lọt qua cũng
 * không văng ra. Dùng chung cho interceptor 401 và kết nối lại WebSocket.
 */
export function refreshSession(): Promise<void> {
  if (refreshInFlight) return refreshInFlight
  const run = async () => {
    if (Date.now() - readLastRefresh() < RECENT_REFRESH_MS) return
    // Không cần body: refresh token đi kèm trong cookie kg_rt; cookie mới do backend ghi qua Set-Cookie.
    await axiosInstance.post('/auth/refresh-token')
    markRefreshed()
  }
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  refreshInFlight = (locks?.request ? locks.request('kg-session-refresh', run) : run())
    .then(() => undefined)
    .finally(() => { refreshInFlight = null })
  return refreshInFlight
}

/** Làm mới bị server TỪ CHỐI (4xx: phiên hết / bị thu hồi) — khác lỗi mạng, không nên đá người dùng ra. */
const sessionOver = (error: unknown) => {
  const status = (error as { response?: { status?: number } } | null)?.response?.status
  return status != null && status >= 400 && status < 500
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Bị chặn ở bước kiểm quyền trước khi gửi: không có request nào để làm mới phiên hay gửi lại.
    if (error instanceof PermissionPrecheckError) return Promise.reject(error)
    const originalRequest = error.config

    // Các endpoint chưa có phiên nên 401 ở đây không được kích hoạt luồng refresh.
    // /auth/refresh-token nằm trong danh sách để một lần refresh hỏng không tự gọi lại chính nó.
    const isLoginEndpoint =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/refresh-token') ||
      originalRequest.url?.includes('/auth/lark') ||
      originalRequest.url?.includes('/public/')

    if (error.response?.status === 401 && !originalRequest._retry && !isLoginEndpoint) {
      originalRequest._retry = true
      try {
        await refreshSession()
        return axiosInstance(originalRequest)
      } catch (refreshError) {
        // Chỉ khi phiên hết THẬT mới đá ra; lỗi mạng lúc làm mới thì trả lỗi cho chỗ gọi, không đăng xuất oan.
        if (sessionOver(refreshError)) {
          // Chỉ dọn state cục bộ: gọi /auth/logout lúc này cũng vô nghĩa vì phiên đã hỏng.
          resetSession()
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default axiosInstance
