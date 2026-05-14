import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../api/statsApi'

import { useAuthStore } from '@/store/authStore'

export function useOverviewStats(orgUnitId?: string) {
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId

  return useQuery({
    queryKey: ['stats', 'overview', organizationId, orgUnitId],
    queryFn: () => statsApi.getOverview(organizationId, orgUnitId),
    enabled: !!organizationId
  })
}
