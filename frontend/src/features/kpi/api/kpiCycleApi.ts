import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import type { KpiCycle, KpiCyclePayload } from '@/types/kpi'

export const kpiCycleApi = {
  getAll: (params: {
    page?: number
    size?: number
    sortBy?: string
    direction?: string
    keyword?: string
    cycleType?: string
    startDate?: string
    endDate?: string
    organizationId?: string
  }) =>
    axiosInstance.get<ApiResponse<PageResponse<KpiCycle>>>('/kpi-cycles', { params }).then((r) => r.data.data),

  create: (data: KpiCyclePayload) =>
    axiosInstance.post<ApiResponse<KpiCycle>>('/kpi-cycles', data).then((r) => r.data.data),

  update: (id: string, data: KpiCyclePayload) =>
    axiosInstance.put<ApiResponse<KpiCycle>>(`/kpi-cycles/${id}`, data).then((r) => r.data.data),

  delete: (id: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/kpi-cycles/${id}`).then((r) => r.data.data),
}
