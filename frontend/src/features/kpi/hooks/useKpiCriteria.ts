import { useQuery } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { KpiStatus } from '@/types/kpi'
import type { PageResponse } from '@/types/api'
import type { KpiCriteria, KpiType } from '@/types/kpi'

export function useKpiCriteria(params: { 
  page?: number; 
  size?: number; 
  status?: KpiStatus; 
  orgUnitId?: string; 
  organizationId?: string; 
  createdById?: string; 
  kpiPeriodId?: string; 
  keyword?: string; 
  startDate?: string;
  endDate?: string;
  sortBy?: string; 
  sortDir?: string;
  objectiveId?: string;
  keyResultId?: string;
  assigneeId?: string;
  approvalMode?: boolean;
  kpiNature?: 'PARENT_CHILD' | 'STANDALONE';
  isBonusKpi?: boolean;
  isReverseKpi?: boolean;
  kpiType?: KpiType;
} = {}, options: any = {}) {
  return useQuery<PageResponse<KpiCriteria>>({
    queryKey: ['kpi-criteria', 'all', params],
    queryFn: () => kpiApi.getAll(params),
    ...options
  })
}
