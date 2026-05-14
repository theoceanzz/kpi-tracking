import { useAuthStore } from '@/store/authStore'

/**
 * Permission-based access control hook.
 * All access control is now based on permissions from the `permissions` array, not role names.
 */
export function usePermission() {
  const user = useAuthStore((s) => s.user)

  const hasPermission = (permission: string): boolean => {
    if (!user || !user.permissions) return false
    return user.permissions.includes(permission)
  }

  const hasAnyPermission = (...permissions: string[]): boolean => {
    if (!user || !user.permissions) return false
    return permissions.some(p => user.permissions.includes(p))
  }

  // Computed permission checks for common use cases
  const canApprove = hasAnyPermission('KPI:APPROVE_CRITERIA', 'KPI:APPROVE_ADJUSTMENT')
  const canManage = hasPermission('ORG:VIEW') && hasPermission('USER:VIEW')
  const canCreateKpi = hasPermission('KPI:CREATE')
  const canSubmit = hasPermission('SUBMISSION:CREATE')
  const canViewDashboard = hasPermission('DASHBOARD:VIEW')
  const canCreateEvaluation = hasPermission('EVALUATION:CREATE')
  const canReviewSubmission = hasPermission('SUBMISSION:REVIEW')

  return { 
    hasPermission, 
    hasAnyPermission,
    canApprove, 
    canManage, 
    canCreateKpi, 
    canSubmit,
    canViewDashboard,
    canCreateEvaluation,
    canReviewSubmission,
    permissions: user?.permissions || []
  }
}
