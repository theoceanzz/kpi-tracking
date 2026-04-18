import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import type { UserRole } from '@/types/auth'

interface RoleRouteProps {
  allowedRoles: UserRole[]
}

export default function RoleRoute({ allowedRoles }: RoleRouteProps) {
  const user = useAuthStore((s) => s.user)

  if (!user || !user.roles?.some(r => allowedRoles.includes(r as any))) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
