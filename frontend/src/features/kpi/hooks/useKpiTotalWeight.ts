import { useQuery } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'

export function useKpiTotalWeight(orgUnitId?: string, kpiPeriodId?: string) {
  return useQuery({
    queryKey: ['kpi-criteria', 'total-weight', orgUnitId, kpiPeriodId],
    queryFn: () => kpiApi.getTotalWeight(orgUnitId!, kpiPeriodId),
    enabled: !!orgUnitId,
  })
}
