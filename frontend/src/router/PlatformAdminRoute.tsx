import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import ErrorPage from '@/features/errors/pages/ErrorPage'

export default function PlatformAdminRoute() {
  const { user, isAuthenticated } = useAuthStore()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (!user.isPlatformAdmin) {
    return <ErrorPage code="403" />
  }

  return <Outlet />
}
