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
      toast.success('Tạo nhân sự thành công')
    },
    onError: () => toast.error('Tạo nhân sự thất bại'),
  })
}
