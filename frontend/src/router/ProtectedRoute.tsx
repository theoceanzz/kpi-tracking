import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { needsOrganization } from '@/lib/session'

/** Trang vẫn mở được khi chưa có tổ chức — không trang nào trong đó gọi API theo tổ chức. */
const NO_ORG_ALLOWED = ['/no-organization', '/force-password-change']

export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const { pathname } = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Chưa thuộc tổ chức nào: không render AppLayout (header, chuông, các trang) vì tất cả đều gọi
  // API theo orgId — người dùng sẽ chỉ thấy một loạt 403.
  if (needsOrganization(user) && !NO_ORG_ALLOWED.includes(pathname)) {
    return <Navigate to="/no-organization" replace />
  }

  return <Outlet />
}
