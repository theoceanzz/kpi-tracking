import { useAuthStore } from '@/store/authStore'
import type { UserRole } from '@/types/auth'

export function usePermission() {
  const user = useAuthStore((s) => s.user)

  const hasRole = (...roles: UserRole[]): boolean => {
    if (!user || !user.roles) return false
    return roles.some(role => user.roles.includes(role))
  }

  const isDirector = hasRole('DIRECTOR')
  const isHead = hasRole('HEAD')
  const isDeputy = hasRole('DEPUTY')
  const isStaff = hasRole('STAFF')

  const canApprove = isDirector || isHead
  const canManage = isDirector
  const canCreateKpi = isHead || isDeputy
  const canSubmit = isStaff

  return { 
    hasRole, 
    isDirector, 
    isHead, 
    isDeputy, 
    isStaff, 
    canApprove, 
    canManage, 
    canCreateKpi, 
    canSubmit,
    userRoles: user?.roles || []
  }
}
