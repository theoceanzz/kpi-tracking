import { useQuery } from '@tanstack/react-query'
import { userApi } from '../api/userApi'
import type { PageParams } from '@/types/api'

export function useUsers(params: PageParams & { keyword?: string } = {}) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => userApi.getAll(params),
  })
}
