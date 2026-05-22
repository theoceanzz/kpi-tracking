import { Navigate, Outlet } from 'react-router-dom'
import { useHasPermission } from '@/components/auth/PermissionGate'
import ErrorPage from '@/features/errors/pages/ErrorPage'

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
}: PermissionRouteProps) {
  const { hasPermission, isAuthenticated, user } = useHasPermission()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (!hasPermission(permission, requireAll)) {
    return <ErrorPage code="403" />
  }

  return <Outlet />
}
