import { useQuery } from '@tanstack/react-query'
import { organizationApi } from '../api/organizationApi'

export function useOrganization(id: string | undefined) {
  return useQuery({
    queryKey: ['organizations', id],
    queryFn: () => organizationApi.getById(id!),
    enabled: !!id
  })
}
