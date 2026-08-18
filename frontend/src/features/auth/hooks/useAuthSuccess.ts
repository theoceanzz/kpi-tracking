import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import type { AuthResponse } from '@/types/auth'

/**
 * Lưu phiên đăng nhập và điều hướng sau khi xác thực thành công.
 * Dùng chung cho đăng nhập bằng mật khẩu và đăng nhập bằng Lark.
 */
export function useAuthSuccess() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  return useCallback(
    (data: AuthResponse) => {
      // Token đã được backend đặt vào cookie HttpOnly, ở đây chỉ lưu hồ sơ người dùng.
      setAuth(data.user)

      if (data.user.requirePasswordChange) {
        toast.info('Bạn cần đổi mật khẩu trong lần đăng nhập đầu tiên để bảo mật tài khoản.')
        navigate('/force-password-change')
      } else if (data.user.isPlatformAdmin) {
        toast.success('Đăng nhập thành công!')
        navigate('/admin')
      } else {
        toast.success('Đăng nhập thành công!')
        navigate('/dashboard')
      }
    },
    [setAuth, navigate]
  )
}
