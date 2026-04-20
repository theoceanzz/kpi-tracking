import { Navigate, Outlet } from 'react-router-dom'
import { useHasPermission } from '@/components/auth/PermissionGate'

interface PermissionRouteProps {
  permission: string | string[]
  requireAll?: boolean
  redirectTo?: string
}

/**
 * Route protection based on permissions instead of roles.
 * Usage: <PermissionRoute permission="USER:VIEW" />
 */
export default function PermissionRoute({ 
  permission, 
  requireAll = false,
  redirectTo = "/dashboard"
}: PermissionRouteProps) {
  const { hasPermission, isAuthenticated, user } = useHasPermission()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (!hasPermission(permission, requireAll)) {
    return <Navigate to={redirectTo} replace />
  }

  return <Outlet />
}
