import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../api/statsApi'
import { useAuthStore } from '@/store/authStore'

/**
 * Thống kê KPI theo đơn vị — toàn tổ chức, không nhận orgUnitId.
 * Endpoint đòi quyền ORG:VIEW, nên caller không có quyền phải truyền `enabled: false`
 * để tránh bắn request chắc chắn 403.
 */
export function useOrgUnitStats(options?: { enabled?: boolean }) {
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId

  return useQuery({
    queryKey: ['stats', 'orgUnits', organizationId],
    queryFn: () => statsApi.getOrgUnitStats(organizationId),
    enabled: !!organizationId && (options?.enabled ?? true),
    staleTime: 0,
  })
}
