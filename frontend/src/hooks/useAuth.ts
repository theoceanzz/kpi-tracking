import { useAuthStore } from '@/store/authStore'
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/features/auth/api/authApi'

export function useAuth() {
  const { user, isAuthenticated, setAuth, setUser, logout: storeLogout } = useAuthStore()
  const navigate = useNavigate()

  // Phải gọi server: chỉ backend mới xoá được cookie HttpOnly và thu hồi refresh token.
  // Lỗi mạng không được chặn việc đăng xuất phía client nên nuốt lỗi ở đây.
  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // bỏ qua: dù server không phản hồi, vẫn phải dọn phiên cục bộ
    }
    storeLogout()
    navigate('/login')
  }, [storeLogout, navigate])

  const refreshUser = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const userData = await authApi.getMe()
      setUser(userData)
    } catch (err) {
      if ((err as any)?.response?.status === 401) {
        logout()
      }
    }
  }, [isAuthenticated, setUser, logout])

  return { user, isAuthenticated, setAuth, logout, refreshUser }
}
