import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiPeriodApi } from '../api/kpiPeriodApi'
import type { KpiPeriod } from '@/types/kpi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { useTranslation } from 'react-i18next'

interface UseKpiPeriodsOptions {
  page?: number
  size?: number
  sortBy?: string
  direction?: string
  keyword?: string
  periodType?: string
  startDate?: string
  endDate?: string
  organizationId?: string
}

export const useKpiPeriods = (options: UseKpiPeriodsOptions = {}) => {
  const { t } = useTranslation('kpi')
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['kpiPeriods', options],
    queryFn: () => kpiPeriodApi.getAll(options),
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<KpiPeriod>) => kpiPeriodApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kpiPeriods'] })
      qc.invalidateQueries({ queryKey: ['kpiCycles'] })
      toast.success(t('useKpiPeriods.newKpiPeriodCreated'))
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useKpiPeriods.failedToCreateKpiPeriod'))),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<KpiPeriod> }) => kpiPeriodApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kpiPeriods'] })
      qc.invalidateQueries({ queryKey: ['kpiCycles'] })
      toast.success(t('useKpiPeriods.kpiPeriodUpdated'))
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useKpiPeriods.failedToUpdateKpiPeriod'))),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => kpiPeriodApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kpiPeriods'] })
      qc.invalidateQueries({ queryKey: ['kpiCycles'] })
      toast.success(t('useKpiPeriods.kpiPeriodDeleted'))
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useKpiPeriods.failedToDeleteKpiPeriod'))),
  })

  return {
    ...query,
    createPeriod: createMutation.mutateAsync,
    updatePeriod: updateMutation.mutateAsync,
    deletePeriod: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}
