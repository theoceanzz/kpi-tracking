import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../api/statsApi'

import { useAuthStore } from '@/store/authStore'

export function useEmployeeStats(page = 0, size = 5, orgUnitId?: string) {
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId

  return useQuery({
    queryKey: ['stats', 'employees', page, size, organizationId, orgUnitId],
    queryFn: () => statsApi.getEmployeeStats(page, size, organizationId, orgUnitId),
    enabled: !!organizationId
  })
}
