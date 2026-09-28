import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { roleApi, CreateRoleRequest, UpdateRoleRequest } from '../api/role.api'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { useTranslation } from 'react-i18next'

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => roleApi.listRoles()
  })
}

export function useCreateRole() {
  const { t } = useTranslation('organization')
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateRoleRequest) => roleApi.createRole(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success(t('useRoles.newRoleAddedSuccessfully'))
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, t('useRoles.anErrorOccurredWhileAddingThe')))
    }
  })
}

export function useUpdateRole() {
  const { t } = useTranslation('organization')
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ roleId, payload }: { roleId: string; payload: UpdateRoleRequest }) => 
      roleApi.updateRole(roleId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['org-unit-members'] })
      queryClient.invalidateQueries({ queryKey: ['organization-users'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['evaluations'] })
      queryClient.invalidateQueries({ queryKey: ['submissions'] })
      queryClient.invalidateQueries({ queryKey: ['auth-user'] }) // Refresh current user roles if needed
      toast.success(t('useRoles.roleUpdatedSuccessfully'))
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, t('useRoles.anErrorOccurredWhileUpdatingThe')))
    }
  })
}

export function useDeleteRole() {
  const { t } = useTranslation('organization')
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (roleId: string) => roleApi.deleteRole(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['org-unit-members'] })
      queryClient.invalidateQueries({ queryKey: ['organization-users'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['evaluations'] })
      queryClient.invalidateQueries({ queryKey: ['submissions'] })
      queryClient.invalidateQueries({ queryKey: ['auth-user'] })
      toast.success(t('useRoles.roleDeletedSuccessfully'))
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, t('useRoles.couldNotDeleteTheRole')))
    }
  })
}
