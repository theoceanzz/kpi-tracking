import { useQuery } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'

export function useKpiTotalWeight(orgUnitId?: string, kpiPeriodId?: string, userId?: string, sameBranch?: boolean) {
  return useQuery({
    queryKey: ['kpi-criteria', 'total-weight', orgUnitId, kpiPeriodId, userId, !!sameBranch],
    queryFn: () => kpiApi.getTotalWeight(orgUnitId, kpiPeriodId, userId, sameBranch),
    enabled: !!orgUnitId || !!userId,
  })
}
