import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../api/statsApi'

export function useOrgUnitStats() {
  return useQuery({
    queryKey: ['stats', 'org-units'],
    queryFn: () => statsApi.getOrgUnitStats(),
    staleTime: 5 * 60 * 1000,
  })
}
