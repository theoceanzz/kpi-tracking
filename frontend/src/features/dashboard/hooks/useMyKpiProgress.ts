import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../api/statsApi'

export function useMyKpiProgress(page = 0, size = 5) {
  return useQuery({
    queryKey: ['stats', 'my-progress', page, size],
    queryFn: () => statsApi.getMyProgress(page, size),
  })
}
