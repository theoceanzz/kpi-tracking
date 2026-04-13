import { useAuthStore } from '@/store/authStore'
import type { UserRole } from '@/types/auth'

export function usePermission() {
  const user = useAuthStore((s) => s.user)

  const hasRole = (...roles: UserRole[]): boolean => {
    return user ? roles.includes(user.role) : false
  }

  const isDirector = user?.role === 'DIRECTOR'
  const isHead = user?.role === 'HEAD'
  const isDeputyHead = user?.role === 'DEPUTY_HEAD'
  const isStaff = user?.role === 'STAFF'

  const canApprove = isDirector || isHead
  const canManage = isDirector
  const canCreateKpi = isHead || isDeputyHead
  const canSubmit = isStaff

  return { hasRole, isDirector, isHead, isDeputyHead, isStaff, canApprove, canManage, canCreateKpi, canSubmit }
}
