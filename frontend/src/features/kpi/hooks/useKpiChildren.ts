import { useQuery } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'

export function useKpiChildren(kpiId?: string) {
  return useQuery({
    queryKey: ['kpi-criteria', kpiId, 'children'],
    queryFn: () => kpiApi.getChildren(kpiId!),
    enabled: !!kpiId,
  })
}
