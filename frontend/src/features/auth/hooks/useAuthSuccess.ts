import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import type { AuthResponse } from '@/types/auth'
import { needsOrganization } from '@/lib/session'
import { useTranslation } from 'react-i18next'

/**
 * Lưu phiên đăng nhập và điều hướng sau khi xác thực thành công.
 * Dùng chung cho đăng nhập bằng mật khẩu và đăng nhập bằng Lark.
 */
export function useAuthSuccess() {
  const { t } = useTranslation('auth')
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  return useCallback(
    (data: AuthResponse) => {
      // Token đã được backend đặt vào cookie HttpOnly, ở đây chỉ lưu hồ sơ người dùng.
      setAuth(data.user)

      if (data.user.requirePasswordChange) {
        toast.info(t('useAuthSuccess.youNeedToChangeYourPassword'))
        navigate('/force-password-change')
      } else if (needsOrganization(data.user)) {
        // Không vào /dashboard: mọi trang trong app gọi API theo tổ chức và sẽ 403 hàng loạt.
        navigate('/no-organization')
      } else if (data.user.isPlatformAdmin) {
        toast.success(t('useAuthSuccess.signedInSuccessfully'))
        navigate('/admin')
      } else {
        toast.success(t('useAuthSuccess.signedInSuccessfully'))
        navigate('/dashboard')
      }
    },
    [setAuth, navigate, t]
  )
}
