import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'

export function useDeleteKpi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => kpiApi.delete(id),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] }); 
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success('Đã xóa chỉ tiêu') 
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Xoá chỉ tiêu thất bại')),
  })
}
