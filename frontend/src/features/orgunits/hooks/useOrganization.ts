import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { organizationApi, UpdateOrganizationRequest } from '../api/organizationApi'
import { invalidateOrgDerived } from '@/lib/queryClient'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { useTranslation } from 'react-i18next'

export function useOrganization(id?: string) {
  const { t } = useTranslation('orgunits')
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
      toast.success(t('useOrganization.companyInformationUpdatedSuccessfully'))
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, t('useOrganization.anErrorOccurredWhileUpdating')))
    }
  })

  return {
    ...query,
    updateOrganization: updateMutation.mutate,
    isUpdating: updateMutation.isPending
  }
}
