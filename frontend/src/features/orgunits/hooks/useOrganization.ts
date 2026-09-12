import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { organizationApi, UpdateOrganizationRequest } from '../api/organizationApi'
import { invalidateOrgDerived } from '@/lib/queryClient'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'

export function useOrganization(id?: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['organization', id],
    queryFn: () => organizationApi.getById(id!),
    enabled: !!id
  })

  const updateMutation = useMutation({
    mutationFn: (data: UpdateOrganizationRequest) => organizationApi.update(id!, data),
    onSuccess: () => {
      invalidateOrgDerived(queryClient)
      toast.success('Cập nhật thông tin công ty thành công')
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Có lỗi xảy ra khi cập nhật'))
    }
  })

  return {
    ...query,
    updateOrganization: updateMutation.mutate,
    isUpdating: updateMutation.isPending
  }
}
