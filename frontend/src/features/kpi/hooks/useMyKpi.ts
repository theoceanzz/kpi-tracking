import { useQuery } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'

export function useMyKpi({ enabled = true, ...params }: { page?: number; size?: number; kpiPeriodId?: string; sortBy?: string; sortDir?: string; userId?: string; objectiveId?: string; keyResultId?: string; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['kpi-criteria', 'my', params],
    queryFn: () => kpiApi.getMy(params),
    enabled,
  })
}
