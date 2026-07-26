import { useMutation, useQueryClient } from '@tanstack/react-query'
import { organizationApi, type UpdateOrganizationRequest } from '../api/organizationApi'
import { invalidateOrgDerived } from '@/lib/queryClient'

export function useUpdateOrganization(id: string | undefined) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateOrganizationRequest) => organizationApi.update(id!, data),
    onSuccess: () => {
      // Invalidate org + toàn bộ nhóm query thống kê (nếu không, trang Thống kê giữ cache cũ do staleTime 5').
      invalidateOrgDerived(qc)
    },
  })
}
