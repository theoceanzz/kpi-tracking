import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import type { CreateKpiRequest } from '@/types/kpi'

export function useCreateKpi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateKpiRequest) => kpiApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kpi-criteria'] }); toast.success('Tạo chỉ tiêu KPI thành công') },
    onError: () => toast.error('Tạo chỉ tiêu thất bại'),
  })
}
