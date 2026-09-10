import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'

export function useSubmitKpi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => kpiApi.submit(id),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] }); 
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success('Đã gửi duyệt') 
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Gửi duyệt thất bại')),
  })
}
