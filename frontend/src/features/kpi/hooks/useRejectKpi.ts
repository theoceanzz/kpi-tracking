import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import type { RejectKpiRequest } from '@/types/kpi'

export function useRejectKpi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectKpiRequest }) => kpiApi.reject(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kpi-criteria'] }); toast.success('Đã từ chối chỉ tiêu') },
    onError: () => toast.error('Từ chối thất bại'),
  })
}
