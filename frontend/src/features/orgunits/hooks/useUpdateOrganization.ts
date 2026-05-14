import { useMutation, useQueryClient } from '@tanstack/react-query'
import { organizationApi, type UpdateOrganizationRequest } from '../api/organizationApi'

export function useUpdateOrganization(id: string | undefined) {
  const qc = useQueryClient()
  
  return useMutation({
    mutationFn: (data: UpdateOrganizationRequest) => organizationApi.update(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organization', id] })
      qc.invalidateQueries({ queryKey: ['hierarchyLevels', id] })
      qc.invalidateQueries({ queryKey: ['hierarchy-levels', id] })
      qc.invalidateQueries({ queryKey: ['orgUnits'] })
      qc.invalidateQueries({ queryKey: ['organization-users'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['roles'] })
    },
  })
}
