import { useQuery } from '@tanstack/react-query'
import { orgUnitApi } from '../api/orgUnitApi'
import { useAuthStore } from '@/store/authStore'

export function useOrgUnitTree() {
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId

  return useQuery({
    queryKey: ['orgUnits', 'tree', organizationId],
    queryFn: () => {
      if (!organizationId) throw new Error('No organization ID found')
      return orgUnitApi.getTree(organizationId)
    },
    enabled: !!organizationId,
    staleTime: 0,
  })
}

export function useOrgUnitSubtree(unitId: string | null) {
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId

  return useQuery({
    queryKey: ['orgUnits', 'subtree', organizationId, unitId],
    queryFn: () => {
      if (!organizationId) throw new Error('No organization ID found')
      return orgUnitApi.getSubtree(organizationId, unitId!)
    },
    enabled: !!organizationId && !!unitId,
    staleTime: 0,
  })
}
