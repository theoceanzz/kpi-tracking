import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiPeriodApi } from '../api/kpiPeriodApi'
import type { KpiPeriod } from '@/types/kpi'
import { toast } from 'sonner'

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
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['kpiPeriods', options],
    queryFn: () => kpiPeriodApi.getAll(options),
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<KpiPeriod>) => kpiPeriodApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kpiPeriods'] })
      toast.success('Đã tạo đợt KPI mới')
    },
    onError: () => toast.error('Tạo đợt KPI thất bại'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<KpiPeriod> }) => kpiPeriodApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kpiPeriods'] })
      toast.success('Đã cập nhật đợt KPI')
    },
    onError: () => toast.error('Cập nhật đợt KPI thất bại'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => kpiPeriodApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kpiPeriods'] })
      toast.success('Đã xoá đợt KPI')
    },
    onError: () => toast.error('Xoá đợt KPI thất bại'),
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
