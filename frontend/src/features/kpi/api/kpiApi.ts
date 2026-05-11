import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import type { KpiCriteria, CreateKpiRequest, UpdateKpiRequest, RejectKpiRequest, ImportKpiResult } from '@/types/kpi'
import type { KpiStatus } from '@/types/kpi'

export const kpiApi = {
  getAll: (params: { page?: number; size?: number; status?: KpiStatus; orgUnitId?: string; organizationId?: string; createdById?: string; kpiPeriodId?: string; keyword?: string; startDate?: string; endDate?: string; sortBy?: string; sortDir?: string }) =>
    axiosInstance.get<ApiResponse<PageResponse<KpiCriteria>>>('/kpi-criteria', { params }).then((r) => r.data.data),

  getById: (id: string) =>
    axiosInstance.get<ApiResponse<KpiCriteria>>(`/kpi-criteria/${id}`).then((r) => r.data.data),

  getMy: (params: { page?: number; size?: number; kpiPeriodId?: string; startDate?: string; endDate?: string; sortBy?: string; sortDir?: string; userId?: string }) =>
    axiosInstance.get<ApiResponse<PageResponse<KpiCriteria>>>('/kpi-criteria/my', { params }).then((r) => r.data.data),

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

  importFile: (file: File, kpiPeriodId?: string, orgUnitId?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    
    let url = '/kpi-criteria/import'
    const params = new URLSearchParams()
    if (kpiPeriodId) params.append('kpiPeriodId', kpiPeriodId)
    if (orgUnitId) params.append('orgUnitId', orgUnitId)
    if (params.toString()) url += `?${params.toString()}`

    return axiosInstance.post<ApiResponse<ImportKpiResult>>(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data.data)
  },

  getAiSuggestions: (orgUnitId?: string, context?: string) =>
    axiosInstance.post<ApiResponse<any[]>>('/ai/suggest-kpi', { orgUnitId, context }).then((r) => r.data.data),

  getTotalWeight: (orgUnitId?: string, kpiPeriodId?: string, userId?: string) =>
    axiosInstance.get<ApiResponse<number>>('/kpi-criteria/total-weight', { params: { orgUnitId, kpiPeriodId, userId } }).then(r => r.data.data),
}
