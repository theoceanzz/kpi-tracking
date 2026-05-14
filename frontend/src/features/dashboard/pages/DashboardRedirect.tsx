import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useHasPermission } from '@/components/auth/PermissionGate'

/**
 * Redirects the user to the appropriate dashboard based on their permissions.
 * PBAC: We check permissions instead of hardcoded role names.
 */
export default function DashboardRedirect() {
  const { user } = useAuthStore()
  const { hasPermission } = useHasPermission()

  if (!user) return <Navigate to="/login" replace />

  // Priority check for dashboard access
  // 1. Director Dashboard (Users with managerial/admin permissions)
  if (hasPermission(['ORG:CREATE', 'ROLE:VIEW'])) {
    return <Navigate to="/dashboard/director" replace />
  }

  // 2. Head/Deputy Dashboard (Users with review/approve permissions)
  if (hasPermission(['KPI:APPROVE_CRITERIA', 'KPI:APPROVE_ADJUSTMENT', 'SUBMISSION:REVIEW', 'USER:VIEW_LIST'])) {
    return <Navigate to="/dashboard/head" replace />
  }

  // 3. Default to Staff Dashboard
  return <Navigate to="/dashboard/staff" replace />
}
