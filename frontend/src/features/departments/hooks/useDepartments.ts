import { useQuery } from '@tanstack/react-query'
import { departmentApi } from '../api/departmentApi'

export function useDepartments(page = 0, size = 20) {
  return useQuery({
    queryKey: ['departments', page, size],
    queryFn: () => departmentApi.getAll(page, size),
  })
}
