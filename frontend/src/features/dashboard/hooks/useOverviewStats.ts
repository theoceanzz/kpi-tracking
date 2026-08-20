import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../api/statsApi'

import { useAuthStore } from '@/store/authStore'

/**
 * Tổng quan KPI của tổ chức (hoặc một đơn vị nếu truyền `orgUnitId`).
 * Endpoint đòi quyền DASHBOARD:VIEW — caller không có quyền phải truyền `enabled: false`.
 */
export function useOverviewStats(orgUnitId?: string, options?: { enabled?: boolean }) {
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId

  return useQuery({
    queryKey: ['stats', 'overview', organizationId, orgUnitId],
    queryFn: () => statsApi.getOverview(organizationId, orgUnitId),
    enabled: !!organizationId && (options?.enabled ?? true)
  })
}
