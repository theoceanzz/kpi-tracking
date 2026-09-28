import { useMutation, useQueryClient } from '@tanstack/react-query'
import { userApi } from '../api/userApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import type { CreateUserRequest } from '@/types/user'
import { useTranslation } from 'react-i18next'

export function useCreateUser() {
  const { t } = useTranslation('users')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateUserRequest) => userApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['organization-users'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      toast.success(t('useCreateUser.personCreatedSuccessfully'))
    },
    onError: (error: any) => {
      const errorMessage = getApiErrorMessage(error, t('useCreateUser.failedToCreatePerson'))
      toast.error(errorMessage)
    },
  })
}
