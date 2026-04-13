import { useQuery } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'

export function useMyKpi(page = 0, size = 20) {
  return useQuery({
    queryKey: ['kpi-criteria', 'my', page, size],
    queryFn: () => kpiApi.getMy(page, size),
  })
}
