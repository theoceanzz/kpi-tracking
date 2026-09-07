import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiCycleApi } from '../api/kpiCycleApi'
import type { KpiCyclePayload } from '@/types/kpi'
import { toast } from 'sonner'

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
      toast.success('Đã tạo kỳ đánh giá mới')
    },
    onError: () => toast.error('Tạo kỳ đánh giá thất bại'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: KpiCyclePayload }) => kpiCycleApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kpiCycles'] })
      qc.invalidateQueries({ queryKey: ['kpiPeriods'] })
      toast.success('Đã cập nhật kỳ đánh giá')
    },
    onError: () => toast.error('Cập nhật kỳ đánh giá thất bại'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => kpiCycleApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kpiCycles'] })
      qc.invalidateQueries({ queryKey: ['kpiPeriods'] })
      toast.success('Đã xoá kỳ đánh giá')
    },
    onError: () => toast.error('Xoá kỳ đánh giá thất bại'),
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
