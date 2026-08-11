import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { useAuthSuccess } from './useAuthSuccess'
import type { LoginFormData } from '../schemas/authSchema'

export function useLogin() {
  const onAuthSuccess = useAuthSuccess()

  return useMutation({
    mutationFn: (data: LoginFormData) => authApi.login(data),
    onSuccess: onAuthSuccess,
    onError: () => {
      // toast.error('Email hoặc mật khẩu không đúng') // Removed to use UI alert instead
    },
  })
}
