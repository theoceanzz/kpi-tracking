import { useQuery } from '@tanstack/react-query'
import { adjustmentApi } from '../api/adjustmentApi'

export function useMyAdjustments(params: { 
  page?: number; 
  size?: number; 
} = {}) {
  return useQuery({ 
    queryKey: ['my-kpi-adjustments', params], 
    queryFn: () => adjustmentApi.getMy(params)
  })
}
