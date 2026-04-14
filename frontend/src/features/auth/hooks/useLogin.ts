import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { LoginFormData } from '../schemas/authSchema'

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (data: LoginFormData) => authApi.login(data),
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken)
      toast.success('Đăng nhập thành công!')
      navigate('/dashboard')
    },
    onError: () => {
      // toast.error('Email hoặc mật khẩu không đúng') // Removed to use UI alert instead
    },
  })
}
