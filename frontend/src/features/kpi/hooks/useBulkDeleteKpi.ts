import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'

export function useBulkDeleteKpi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => kpiApi.bulkDelete(ids),
    onSuccess: (deleted) => {
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success(`Đã xoá ${deleted ?? 0} chỉ tiêu`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Xoá chỉ tiêu thất bại')),
  })
}
