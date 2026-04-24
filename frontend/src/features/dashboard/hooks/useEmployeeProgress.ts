import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../api/statsApi'

export function useEmployeeProgress(userId: string, page = 0, size = 5) {
  return useQuery({
    queryKey: ['stats', 'employee-progress', userId, page, size],
    queryFn: () => statsApi.getEmployeeProgress(userId, page, size),
    enabled: !!userId,
  })
}
