import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { permissionApi } from '../api/permission.api'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { useTranslation } from 'react-i18next'

export function useAllPermissions() {
  return useQuery({
    queryKey: ['permissions', 'all'],
    queryFn: () => permissionApi.listAllPermissions()
  })
}

export function useRolePermissions(roleId: string | undefined) {
  return useQuery({
    queryKey: ['permissions', 'role', roleId],
    queryFn: () => (roleId ? permissionApi.getRolePermissions(roleId) : Promise.resolve([])),
    enabled: !!roleId
  })
}

export function useUpdateRolePermissions() {
  const { t } = useTranslation('organization')
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) =>
      permissionApi.assignPermissionsToRole(roleId, permissionIds),
    onSuccess: (_, { roleId }) => {
      queryClient.invalidateQueries({ queryKey: ['permissions', 'role', roleId] })
      toast.success(t('useRolePermissions.permissionsUpdatedSuccessfully'))
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, t('useRolePermissions.anErrorOccurredWhileUpdatingPermissions')))
    }
  })
}
