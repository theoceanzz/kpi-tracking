import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../api/statsApi'

export function useMyKpiProgress() {
  return useQuery({
    queryKey: ['stats', 'my-progress'],
    queryFn: () => statsApi.getMyProgress(),
  })
}
