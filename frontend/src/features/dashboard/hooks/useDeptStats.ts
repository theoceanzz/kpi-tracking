import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../api/statsApi'

export function useDeptStats() {
  return useQuery({
    queryKey: ['stats', 'departments'],
    queryFn: () => statsApi.getDepartmentStats(),
  })
}
