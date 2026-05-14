import { useAuthStore } from '@/store/authStore'
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { queryClient } from '@/lib/queryClient'
import { authApi } from '@/features/auth/api/authApi'

export function useAuth() {
  const { user, isAuthenticated, setAuth, setUser, logout: storeLogout } = useAuthStore()
  const navigate = useNavigate()

  const logout = useCallback(() => {
    storeLogout()
    queryClient.clear()
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
