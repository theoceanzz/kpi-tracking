import { useMutation, useQueryClient } from '@tanstack/react-query'
import { organizationApi, type UpdateOrganizationRequest } from '../api/organizationApi'
import { toast } from 'sonner'

export function useUpdateOrganization(id: string | undefined) {
  const qc = useQueryClient()
  
  return useMutation({
    mutationFn: (data: UpdateOrganizationRequest) => organizationApi.update(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations', id] })
      toast.success('Cập nhật thông tin công ty thành công')
    },
    onError: () => {
      toast.error('Cập nhật thất bại')
    }
  })
}
