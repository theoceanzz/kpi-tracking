import { useQuery } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { useApiAllowed } from '@/hooks/useApiAllowed'

export function useMyKpi({ enabled = true, ...params }: { page?: number; size?: number; kpiPeriodId?: string; sortBy?: string; sortDir?: string; userId?: string; objectiveId?: string; keyResultId?: string; enabled?: boolean } = {}) {
  // /kpi-criteria/my cần KPI:VIEW_MY — tài khoản không giao chỉ tiêu cho chính mình (vd giám đốc) không có.
  const allowed = useApiAllowed('GET', '/kpi-criteria/my')
  return useQuery({
    queryKey: ['kpi-criteria', 'my', params],
    queryFn: () => kpiApi.getMy(params),
    enabled: enabled && allowed,
  })
}
