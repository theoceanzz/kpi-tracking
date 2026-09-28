import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { okrApi } from '../api/okr.api'
import { ObjectiveRequest, KeyResultRequest } from '../types'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { useTranslation } from 'react-i18next'

export function useObjectives(organizationId?: string) {
  return useQuery({
    queryKey: ['objectives', organizationId],
    queryFn: () => okrApi.getObjectivesByOrganization(organizationId!),
    enabled: !!organizationId
  })
}

export function useOkrMutations() {
  const { t } = useTranslation('okr')
  const queryClient = useQueryClient()

  const createObjectiveMutation = useMutation({
    mutationFn: ({ organizationId, data }: { organizationId: string, data: ObjectiveRequest }) =>
      okrApi.createObjective(organizationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] })
      toast.success(t('useOkr.objectiveCreatedSuccessfully'))
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, t('useOkr.failedToCreateObjective')))
    }
  })

  const updateObjectiveMutation = useMutation({
    mutationFn: ({ objectiveId, data }: { objectiveId: string, data: ObjectiveRequest }) =>
      okrApi.updateObjective(objectiveId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] })
      toast.success(t('useOkr.objectiveUpdatedSuccessfully'))
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, t('useOkr.failedToUpdateObjective')))
    }
  })

  const deleteObjectiveMutation = useMutation({
    mutationFn: (objectiveId: string) => okrApi.deleteObjective(objectiveId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] })
      toast.success(t('useOkr.objectiveDeletedSuccessfully'))
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, t('useOkr.failedToDeleteObjective')))
    }
  })

  const createKeyResultMutation = useMutation({
    mutationFn: (data: KeyResultRequest) => okrApi.createKeyResult(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] })
      toast.success(t('useOkr.keyResultCreatedSuccessfully'))
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, t('useOkr.failedToCreateKeyResult')))
    }
  })

  const updateKeyResultMutation = useMutation({
    mutationFn: ({ keyResultId, data }: { keyResultId: string, data: KeyResultRequest }) =>
      okrApi.updateKeyResult(keyResultId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] })
      toast.success(t('useOkr.keyResultUpdatedSuccessfully'))
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, t('useOkr.failedToUpdateKeyResult')))
    }
  })

  const deleteKeyResultMutation = useMutation({
    mutationFn: (keyResultId: string) => okrApi.deleteKeyResult(keyResultId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] })
      toast.success(t('useOkr.keyResultDeletedSuccessfully'))
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, t('useOkr.failedToDeleteKeyResult')))
    }
  })

  const importOkrsMutation = useMutation({
    mutationFn: ({ organizationId, file }: { organizationId: string, file: File }) => 
      okrApi.importOkrs(organizationId, file),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] })
      toast.success(t('useOkr.importedRowsSuccessfully', { successfulImports: data.successfulImports, totalRows: data.totalRows }))
      if (data.errors && data.errors.length > 0) {
        console.error('Import errors:', data.errors)
      }
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, t('useOkr.importFailed')))
    }
  })

  return {
    createObjective: createObjectiveMutation,
    updateObjective: updateObjectiveMutation,
    deleteObjective: deleteObjectiveMutation,
    createKeyResult: createKeyResultMutation,
    updateKeyResult: updateKeyResultMutation,
    deleteKeyResult: deleteKeyResultMutation,
    importOkrs: importOkrsMutation
  }
}
