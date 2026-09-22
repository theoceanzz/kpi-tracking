import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userApi } from '../api/userApi'
import type { PageParams } from '@/types/api'
import type { UpdateUserRequest } from '@/types/user'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'

/**
 * Danh sách người dùng. `enabled` để hoãn gọi API cho tới khi thực sự cần — modal luôn được mount
 * (chỉ ẩn bằng `open`) nên không có nó thì mỗi lần vào trang là một lượt tải danh sách nhân sự.
 */
export function useUsers(
  params: PageParams & { keyword?: string; orgUnitIds?: string[]; organizationId?: string; role?: string; sortBy?: string; direction?: string; includeInactive?: boolean } = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => userApi.getAll(params),
    enabled: options.enabled ?? true,
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
      toast.error(getApiErrorMessage(error, 'Cập nhật thất bại'))
    }
  })
}
