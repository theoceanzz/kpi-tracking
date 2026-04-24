import { useQuery } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import type { KpiStatus } from '@/types/kpi'

export function useKpiCriteria(params: { page?: number; size?: number; status?: KpiStatus; orgUnitId?: string; createdById?: string; kpiPeriodId?: string; sortBy?: string; sortDir?: string } = {}, options: { enabled?: boolean } = {}) {
  return useQuery({ 
    queryKey: ['kpi-criteria', params], 
    queryFn: () => kpiApi.getAll(params),
    ...options
  })
}
