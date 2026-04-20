import React from 'react'
import { useAuthStore } from '@/store/authStore'

interface PermissionGateProps {
  permission: string | string[]
  requireAll?: boolean
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Custom hook to check user permissions.
 * All access control is now based on permissions, not roles.
 */
export function useHasPermission() {
  const { user, isAuthenticated } = useAuthStore()

  const hasPermission = (permission: string | string[], requireAll = false): boolean => {
    if (!isAuthenticated || !user) return false
    if (!user.permissions) return false

    const permissionsToCheck = Array.isArray(permission) ? permission : [permission]
    
    if (requireAll) {
      return permissionsToCheck.every(p => user.permissions.includes(p))
    }
    return permissionsToCheck.some(p => user.permissions.includes(p))
  }

  return { hasPermission, user, isAuthenticated }
}

/**
 * Component to wrap elements that require specific permissions.
 * Usage: <PermissionGate permission="KPI:CREATE">...</PermissionGate>
 * Usage: <PermissionGate permission={["KPI:CREATE", "KPI:UPDATE"]}>...</PermissionGate>
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({ 
  permission, 
  requireAll = false, 
  children, 
  fallback = null 
}) => {
  const { hasPermission } = useHasPermission()

  if (!hasPermission(permission, requireAll)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
