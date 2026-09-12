import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'

export function useApproveKpi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => kpiApi.approve(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kpi-criteria'] }); toast.success('Đã duyệt chỉ tiêu') },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Duyệt chỉ tiêu thất bại')),
  })
}
