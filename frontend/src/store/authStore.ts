import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserInfo } from '@/types/auth'
import { queryClient } from '@/lib/queryClient'

/**
 * Store này KHÔNG giữ token. Access/refresh token nằm trong cookie HttpOnly do backend cấp,
 * JavaScript không đọc được — đó là điểm mấu chốt để XSS không lấy được phiên đăng nhập.
 *
 * Phần lưu ở localStorage chỉ còn hồ sơ người dùng và cờ đã đăng nhập, đủ để render ngay
 * khi tải trang. Tính hợp lệ thật sự do cookie quyết định; useAuth.refreshUser() đối chiếu
 * lại với /auth/me và tự đăng xuất nếu server trả 401.
 */
interface AuthState {
  user: UserInfo | null
  isAuthenticated: boolean
  setAuth: (user: UserInfo) => void
  setUser: (user: UserInfo) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      setAuth: (user) => set({ user, isAuthenticated: true }),

      setUser: (user) => set({ user }),

      logout: () => {
        queryClient.clear()
        set({ user: null, isAuthenticated: false })
      },
    }),
    {
      name: 'auth-storage',
      // v0 lưu cả accessToken lẫn refreshToken. Nâng version buộc mọi bản lưu cũ bị bỏ đi
      // ở lần tải trang đầu tiên sau khi triển khai, xoá token còn sót trong localStorage.
      // Người dùng đang đăng nhập phải đăng nhập lại một lần — đúng như mong đợi vì cookie
      // phiên chưa tồn tại.
      version: 1,
      migrate: () => ({ user: null, isAuthenticated: false }),
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)
