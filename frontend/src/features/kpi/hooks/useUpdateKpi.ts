import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import type { UpdateKpiRequest } from '@/types/kpi'

export function useUpdateKpi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateKpiRequest }) => kpiApi.update(id, data),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] }); 
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success('Cập nhật chỉ tiêu thành công') 
    },
    onError: () => toast.error('Cập nhật thất bại'),
  })
}
