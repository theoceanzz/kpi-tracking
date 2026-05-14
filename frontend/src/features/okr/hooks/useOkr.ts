import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { okrApi } from '../api/okr.api'
import { ObjectiveRequest, KeyResultRequest } from '../types'
import { toast } from 'sonner'

export function useObjectives(organizationId?: string) {
  return useQuery({
    queryKey: ['objectives', organizationId],
    queryFn: () => okrApi.getObjectivesByOrganization(organizationId!),
    enabled: !!organizationId
  })
}

export function useOkrMutations() {
  const queryClient = useQueryClient()

  const createObjectiveMutation = useMutation({
    mutationFn: ({ organizationId, data }: { organizationId: string, data: ObjectiveRequest }) => 
      okrApi.createObjective(organizationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] })
      toast.success('Tạo mục tiêu thành công')
    }
  })

  const updateObjectiveMutation = useMutation({
    mutationFn: ({ objectiveId, data }: { objectiveId: string, data: ObjectiveRequest }) => 
      okrApi.updateObjective(objectiveId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] })
      toast.success('Cập nhật mục tiêu thành công')
    }
  })

  const deleteObjectiveMutation = useMutation({
    mutationFn: (objectiveId: string) => okrApi.deleteObjective(objectiveId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] })
      toast.success('Xóa mục tiêu thành công')
    }
  })

  const createKeyResultMutation = useMutation({
    mutationFn: (data: KeyResultRequest) => okrApi.createKeyResult(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] })
      toast.success('Tạo kết quả then chốt thành công')
    }
  })

  const updateKeyResultMutation = useMutation({
    mutationFn: ({ keyResultId, data }: { keyResultId: string, data: KeyResultRequest }) => 
      okrApi.updateKeyResult(keyResultId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] })
      toast.success('Cập nhật kết quả then chốt thành công')
    }
  })

  const deleteKeyResultMutation = useMutation({
    mutationFn: (keyResultId: string) => okrApi.deleteKeyResult(keyResultId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] })
      toast.success('Xóa kết quả then chốt thành công')
    }
  })

  const importOkrsMutation = useMutation({
    mutationFn: ({ organizationId, file }: { organizationId: string, file: File }) => 
      okrApi.importOkrs(organizationId, file),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] })
      toast.success(`Import thành công ${data.successfulImports}/${data.totalRows} dòng`)
      if (data.errors && data.errors.length > 0) {
        console.error('Import errors:', data.errors)
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Import thất bại')
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
