import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../api/statsApi'

export function useOverviewStats() {
  return useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: () => statsApi.getOverview(),
  })
}
