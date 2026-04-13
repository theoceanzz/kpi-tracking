import { useQuery } from '@tanstack/react-query'
import { departmentApi } from '../api/departmentApi'

export function useDepartmentMembers(departmentId: string) {
  return useQuery({
    queryKey: ['departments', departmentId, 'members'],
    queryFn: () => departmentApi.getMembers(departmentId),
    enabled: !!departmentId,
  })
}
