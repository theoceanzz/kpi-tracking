import { useQuery } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import type { KpiStatus } from '@/types/kpi'

export function useKpiCriteria(params: { page?: number; size?: number; status?: KpiStatus; departmentId?: string } = {}) {
  return useQuery({ queryKey: ['kpi-criteria', params], queryFn: () => kpiApi.getAll(params) })
}
