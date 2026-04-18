import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { getHighestRole } from '@/lib/utils'

export default function DashboardRedirect() {
  const user = useAuthStore((s) => s.user)

  if (!user) return <Navigate to="/login" replace />

  const highestRole = getHighestRole(user)

  switch (highestRole) {
    case 'DIRECTOR':
      return <Navigate to="/dashboard/director" replace />
    case 'HEAD':
    case 'DEPUTY':
      return <Navigate to="/dashboard/head" replace />
    case 'STAFF':
      return <Navigate to="/dashboard/staff" replace />
    default:
      return <Navigate to="/login" replace />
  }
}
