import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiCycleApi } from '../api/kpiCycleApi'
import type { KpiCyclePayload } from '@/types/kpi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { useTranslation } from 'react-i18next'

interface UseKpiCyclesOptions {
  page?: number
  size?: number
  sortBy?: string
  direction?: string
  keyword?: string
  cycleType?: string
  startDate?: string
  endDate?: string
  organizationId?: string
  enabled?: boolean
}

export const useKpiCycles = (options: UseKpiCyclesOptions = {}) => {
  const { t } = useTranslation('kpi')
  const qc = useQueryClient()
  const { enabled = true, ...params } = options

  const query = useQuery({
    queryKey: ['kpiCycles', params],
    queryFn: () => kpiCycleApi.getAll(params),
    enabled,
  })

  const createMutation = useMutation({
    mutationFn: (data: KpiCyclePayload) => kpiCycleApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kpiCycles'] })
      qc.invalidateQueries({ queryKey: ['kpiPeriods'] })
      toast.success(t('useKpiCycles.newEvaluationCycleCreated'))
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useKpiCycles.failedToCreateEvaluationCycle'))),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: KpiCyclePayload }) => kpiCycleApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kpiCycles'] })
      qc.invalidateQueries({ queryKey: ['kpiPeriods'] })
      toast.success(t('useKpiCycles.evaluationCycleUpdated'))
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useKpiCycles.failedToUpdateEvaluationCycle'))),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => kpiCycleApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kpiCycles'] })
      qc.invalidateQueries({ queryKey: ['kpiPeriods'] })
      toast.success(t('useKpiCycles.evaluationCycleDeleted'))
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useKpiCycles.failedToDeleteEvaluationCycle'))),
  })

  return {
    ...query,
    createCycle: createMutation.mutateAsync,
    updateCycle: updateMutation.mutateAsync,
    deleteCycle: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}
