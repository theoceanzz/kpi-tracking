import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../api/statsApi'
import { useAuthStore } from '@/store/authStore'

export function useOrgUnitStats() {
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId

  return useQuery({
    queryKey: ['stats', 'orgUnits', organizationId],
    queryFn: () => statsApi.getOrgUnitStats(organizationId),
    enabled: !!organizationId,
    staleTime: 0,
  })
}
