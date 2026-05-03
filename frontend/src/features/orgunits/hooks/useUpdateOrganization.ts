import { useMutation, useQueryClient } from '@tanstack/react-query'
import { organizationApi, type UpdateOrganizationRequest } from '../api/organizationApi'

export function useUpdateOrganization(id: string | undefined) {
  const qc = useQueryClient()
  
  return useMutation({
    mutationFn: (data: UpdateOrganizationRequest) => organizationApi.update(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations', id] })
      qc.invalidateQueries({ queryKey: ['organization-users'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}
