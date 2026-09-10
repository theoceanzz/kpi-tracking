import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'

export function useBulkSubmitKpi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => kpiApi.bulkSubmit(ids),
    onSuccess: (data) => { 
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] }); 
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success(`Đã gửi duyệt ${Array.isArray(data) ? data.length : 0} chỉ tiêu`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Gửi duyệt thất bại')),
  })
}
