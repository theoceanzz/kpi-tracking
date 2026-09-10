import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import type { CreateKpiRequest } from '@/types/kpi'

export function useCreateKpi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateKpiRequest) => kpiApi.create(data),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] }); 
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success('Tạo chỉ tiêu KPI thành công') 
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Tạo chỉ tiêu thất bại')),
  })
}
