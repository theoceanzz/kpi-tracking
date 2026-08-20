import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../api/statsApi'

import { useAuthStore } from '@/store/authStore'

/**
 * Thống kê KPI theo từng nhân sự. Endpoint đòi quyền USER:VIEW hoặc USER:VIEW_LIST —
 * caller không có quyền (nhân viên thường) phải truyền `enabled: false`.
 */
export function useEmployeeStats(page = 0, size = 5, orgUnitId?: string, options?: { enabled?: boolean }) {
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId

  return useQuery({
    queryKey: ['stats', 'employees', page, size, organizationId, orgUnitId],
    queryFn: () => statsApi.getEmployeeStats(page, size, organizationId, orgUnitId),
    enabled: !!organizationId && (options?.enabled ?? true)
  })
}
