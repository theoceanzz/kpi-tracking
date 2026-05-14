import { useMutation, useQueryClient } from '@tanstack/react-query'
import { userApi } from '../api/userApi'
import { toast } from 'sonner'
import type { CreateUserRequest } from '@/types/user'

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateUserRequest) => userApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['organization-users'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Tạo nhân sự thành công')
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || 'Tạo nhân sự thất bại'
      toast.error(errorMessage)
    },
  })
}
