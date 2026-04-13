import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export default function DashboardRedirect() {
  const user = useAuthStore((s) => s.user)

  if (!user) return <Navigate to="/login" replace />

  switch (user.role) {
    case 'DIRECTOR':
      return <Navigate to="/dashboard/director" replace />
    case 'HEAD':
    case 'DEPUTY_HEAD':
      return <Navigate to="/dashboard/head" replace />
    case 'STAFF':
      return <Navigate to="/dashboard/staff" replace />
    default:
      return <Navigate to="/login" replace />
  }
}
