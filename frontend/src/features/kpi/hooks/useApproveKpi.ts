import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'

export function useApproveKpi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => kpiApi.approve(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kpi-criteria'] }); toast.success('Đã duyệt chỉ tiêu') },
    onError: () => toast.error('Duyệt thất bại'),
  })
}
