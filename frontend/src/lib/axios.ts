import axios from 'axios'
import { ENV } from '@/config/env'
import { useAuthStore } from '@/store/authStore'

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

axiosInstance.interceptors.request.use((config) => {
  dropStaleHostOnlyCsrfCookie()
  return config
})

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}> = []

const processQueue = (error: unknown) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(null)
    }
  })
  failedQueue = []
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Các endpoint chưa có phiên nên 401 ở đây không được kích hoạt luồng refresh.
    // /auth/refresh-token nằm trong danh sách để một lần refresh hỏng không tự gọi lại chính nó.
    const isLoginEndpoint =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/refresh-token') ||
      originalRequest.url?.includes('/auth/lark') ||
      originalRequest.url?.includes('/public/')

    if (error.response?.status === 401 && !originalRequest._retry && !isLoginEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(() => axiosInstance(originalRequest))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // Không cần body: refresh token đi kèm trong cookie kg_rt.
        // Cookie mới do backend ghi đè qua Set-Cookie, phía client không phải lưu gì.
        await axiosInstance.post('/auth/refresh-token')

        processQueue(null)

        return axiosInstance(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError)
        // Chỉ dọn state cục bộ: gọi /auth/logout lúc này cũng vô nghĩa vì phiên đã hỏng.
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default axiosInstance
