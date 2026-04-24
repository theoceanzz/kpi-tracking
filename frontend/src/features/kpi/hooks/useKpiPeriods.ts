import { useQuery } from '@tanstack/react-query'
import { kpiPeriodApi } from '../api/kpiPeriodApi'

interface UseKpiPeriodsOptions {
  page?: number
  size?: number
  organizationId?: string
}

export const useKpiPeriods = (options: UseKpiPeriodsOptions = {}) => {
  return useQuery({
    queryKey: ['kpiPeriods', options],
    queryFn: () => kpiPeriodApi.getAll(options),
  })
}
