import { useAuthStore } from '@/store/authStore'
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { queryClient } from '@/lib/queryClient'

export function useAuth() {
  const { user, isAuthenticated, setAuth, logout: storeLogout } = useAuthStore()
  const navigate = useNavigate()

  const logout = useCallback(() => {
    storeLogout()
    queryClient.clear()
    navigate('/login')
  }, [storeLogout, navigate])

  return { user, isAuthenticated, setAuth, logout }
}
