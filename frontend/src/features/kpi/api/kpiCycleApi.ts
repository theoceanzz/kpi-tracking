import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import type { KpiCycle, KpiCyclePayload } from '@/types/kpi'
import type { CycleLockPreview, KpiCycleEvent } from '../types/cycleLock'

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

  // ── Khoá kỳ ──
  lockPreview: (id: string) =>
    axiosInstance.get<ApiResponse<CycleLockPreview>>(`/kpi-cycles/${id}/lock-preview`).then((r) => r.data.data),

  events: (id: string) =>
    axiosInstance.get<ApiResponse<KpiCycleEvent[]>>(`/kpi-cycles/${id}/events`).then((r) => r.data.data),
}
