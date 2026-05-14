import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userApi } from '../api/userApi'
import type { PageParams } from '@/types/api'
import type { UpdateUserRequest } from '@/types/user'
import { toast } from 'sonner'

export function useUsers(params: PageParams & { keyword?: string; orgUnitId?: string; organizationId?: string; role?: string; sortBy?: string; direction?: string } = {}) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => userApi.getAll(params),
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserRequest }) => userApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['org-unit-members'] })
      queryClient.invalidateQueries({ queryKey: ['organization-users'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Cập nhật người dùng thành công')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Cập nhật thất bại')
    }
  })
}
