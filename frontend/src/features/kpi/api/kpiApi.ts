import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import type { KpiCriteria, CreateKpiRequest, UpdateKpiRequest, RejectKpiRequest } from '@/types/kpi'
import type { KpiStatus } from '@/types/kpi'

export const kpiApi = {
  getAll: (params: { page?: number; size?: number; status?: KpiStatus; departmentId?: string }) =>
    axiosInstance.get<ApiResponse<PageResponse<KpiCriteria>>>('/kpi-criteria', { params }).then((r) => r.data.data),

  getById: (id: string) =>
    axiosInstance.get<ApiResponse<KpiCriteria>>(`/kpi-criteria/${id}`).then((r) => r.data.data),

  getMy: (page = 0, size = 20) =>
    axiosInstance.get<ApiResponse<PageResponse<KpiCriteria>>>('/kpi-criteria/my', { params: { page, size } }).then((r) => r.data.data),

  create: (data: CreateKpiRequest) =>
    axiosInstance.post<ApiResponse<KpiCriteria>>('/kpi-criteria', data).then((r) => r.data.data),

  update: (id: string, data: UpdateKpiRequest) =>
    axiosInstance.put<ApiResponse<KpiCriteria>>(`/kpi-criteria/${id}`, data).then((r) => r.data.data),

  delete: (id: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/kpi-criteria/${id}`).then((r) => r.data),

  submit: (id: string) =>
    axiosInstance.post<ApiResponse<KpiCriteria>>(`/kpi-criteria/${id}/submit`).then((r) => r.data.data),

  approve: (id: string) =>
    axiosInstance.post<ApiResponse<KpiCriteria>>(`/kpi-criteria/${id}/approve`).then((r) => r.data.data),

  reject: (id: string, data: RejectKpiRequest) =>
    axiosInstance.post<ApiResponse<KpiCriteria>>(`/kpi-criteria/${id}/reject`, data).then((r) => r.data.data),
}
