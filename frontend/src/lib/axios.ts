import axios from 'axios'
import { ENV } from '@/config/env'
import { useAuthStore } from '@/store/authStore'

const axiosInstance = axios.create({
  baseURL: ENV.API_BASE_URL,
  timeout: 100000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  withXSRFToken: true,
  xsrfCookieName: 'kg_csrf',
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
