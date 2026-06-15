import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'

export function useBulkSubmitKpi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => kpiApi.bulkSubmit(ids),
    onSuccess: (data) => { 
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] }); 
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success(`Đã gửi duyệt ${Array.isArray(data) ? data.length : 0} chỉ tiêu`);
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || 'Gửi duyệt thất bại';
      toast.error(msg);
    },
  })
}
