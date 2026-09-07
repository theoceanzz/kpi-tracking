import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'

export function useBulkDeleteKpi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => kpiApi.bulkDelete(ids),
    onSuccess: (deleted) => {
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success(`Đã xoá ${deleted ?? 0} chỉ tiêu`);
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || 'Xoá thất bại';
      toast.error(msg);
    },
  })
}
