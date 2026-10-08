import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Building2, Loader2, LogOut, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { authApi } from '@/features/auth/api/authApi'
import { useAuthStore } from '@/store/authStore'
import { useAuth } from '@/hooks/useAuth'
import { needsOrganization } from '@/lib/session'

/**
 * Đăng nhập được nhưng tài khoản chưa thuộc tổ chức nào. Trang này cố ý đứng ngoài AppLayout và
 * không gọi API theo tổ chức nào — trước đây người dùng vào thẳng app và mọi request bị 403.
 */
export default function NoOrganizationPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const { logout } = useAuth()
  const [checking, setChecking] = useState(false)

  if (user && !needsOrganization(user)) return <Navigate to="/dashboard" replace />

  // Quản trị viên vừa thêm tài khoản vào đơn vị: đọc lại hồ sơ, có tổ chức thì tự chuyển vào app.
  const recheck = async () => {
    setChecking(true)
    try {
      const me = await authApi.getMe()
      setUser(me)
      if (needsOrganization(me)) toast.info(t('NoOrganizationPage.stillNoOrganization'))
    } catch {
      toast.error(t('NoOrganizationPage.couldNotCheck'))
    } finally {
      setChecking(false)
    }
  }

  const registerNew = async () => {
    await logout()
    navigate('/register')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-muted)] p-4">
      <div className="w-full max-w-md rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-card bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          <Building2 size={28} aria-hidden="true" />
        </div>
        <h1 className="text-page-title mt-5">{t('NoOrganizationPage.title')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          {t('NoOrganizationPage.description', { email: user?.email ?? '' })}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={recheck} disabled={checking}>
            {checking ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            {t('NoOrganizationPage.checkAgain')}
          </Button>
          <Button variant="outline" onClick={registerNew}>{t('NoOrganizationPage.registerNewOrganization')}</Button>
          <Button variant="ghost" onClick={logout}>
            <LogOut aria-hidden="true" /> {t('NoOrganizationPage.signOut')}
          </Button>
        </div>
      </div>
    </div>
  )
}
