import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../api/statsApi'

export function useEmployeeStats() {
  return useQuery({
    queryKey: ['stats', 'employees'],
    queryFn: () => statsApi.getEmployeeStats(),
  })
}
