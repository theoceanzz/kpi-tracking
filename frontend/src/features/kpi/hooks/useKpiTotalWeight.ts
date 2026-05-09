import { useQuery } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'

export function useKpiTotalWeight(orgUnitId?: string, kpiPeriodId?: string, userId?: string) {
  return useQuery({
    queryKey: ['kpi-criteria', 'total-weight', orgUnitId, kpiPeriodId, userId],
    queryFn: () => kpiApi.getTotalWeight(orgUnitId, kpiPeriodId, userId),
    enabled: !!orgUnitId || !!userId,
  })
}
