import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../api/statsApi'

export function useEmployeeStats(page = 0, size = 5) {
  return useQuery({
    queryKey: ['stats', 'employees', page, size],
    queryFn: () => statsApi.getEmployeeStats(page, size),
  })
}
