import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adjustmentApi } from '../api/adjustmentApi'
import type { AdjustmentStatus } from '@/types/adjustment'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'

export function useKpiAdjustments(params: { 
  page?: number; 
  size?: number; 
  status?: AdjustmentStatus; 
  orgUnitId?: string;
  kpiPeriodId?: string;
  objectiveId?: string;
  keyResultId?: string;
} = {}, options: { enabled?: boolean } = {}) {
  return useQuery({ 
    queryKey: ['kpi-adjustments', params], 
    queryFn: () => adjustmentApi.getAll(params),
    ...options
  })
}

export function useBulkReviewAdjustments() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adjustmentApi.bulkReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-adjustments'] })
      toast.success('Đã xử lý hàng loạt thành công')
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Xử lý hàng loạt thất bại'))
    }
  })
}
