import { useQuery } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'

export function useMyKpi(params: { page?: number; size?: number; kpiPeriodId?: string; sortBy?: string; sortDir?: string; userId?: string } = {}) {
  return useQuery({
    queryKey: ['kpi-criteria', 'my', params],
    queryFn: () => kpiApi.getMy(params),
  })
}
