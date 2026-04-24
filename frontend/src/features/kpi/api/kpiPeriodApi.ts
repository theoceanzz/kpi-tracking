import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import type { KpiPeriod } from '@/types/kpi'

export const kpiPeriodApi = {
  getAll: (params: { page?: number; size?: number; organizationId?: string }) =>
    axiosInstance.get<ApiResponse<PageResponse<KpiPeriod>>>('/kpi-periods', { params }).then((r) => r.data.data),
}
