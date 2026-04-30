import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import type {
  Report, ReportDatasource, ReportWidget,
  CreateReportRequest, UpdateReportRequest,
  AddReportDatasourceRequest, UpsertWidgetRequest
} from '@/types/datasource'

export const reportApi = {
  // Reports
  getAll: (params: { page?: number; size?: number; orgUnitId?: string } = {}) =>
    axiosInstance.get<ApiResponse<PageResponse<Report>>>('/reports', { params }).then(r => r.data.data),

  getById: (id: string) =>
    axiosInstance.get<ApiResponse<Report>>(`/reports/${id}`).then(r => r.data.data),

  create: (data: CreateReportRequest) =>
    axiosInstance.post<ApiResponse<Report>>('/reports', data).then(r => r.data.data),

  update: (id: string, data: UpdateReportRequest) =>
    axiosInstance.put<ApiResponse<Report>>(`/reports/${id}`, data).then(r => r.data.data),

  delete: (id: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/reports/${id}`).then(r => r.data),

  // Report Datasources
  addDatasource: (reportId: string, data: AddReportDatasourceRequest) =>
    axiosInstance.post<ApiResponse<ReportDatasource>>(`/reports/${reportId}/datasources`, data).then(r => r.data.data),

  removeDatasource: (reportDatasourceId: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/reports/datasources/${reportDatasourceId}`).then(r => r.data),

  // Widgets
  addWidget: (reportId: string, data: UpsertWidgetRequest) =>
    axiosInstance.post<ApiResponse<ReportWidget>>(`/reports/${reportId}/widgets`, data).then(r => r.data.data),

  updateWidget: (widgetId: string, data: UpsertWidgetRequest) =>
    axiosInstance.put<ApiResponse<ReportWidget>>(`/reports/widgets/${widgetId}`, data).then(r => r.data.data),

  deleteWidget: (widgetId: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/reports/widgets/${widgetId}`).then(r => r.data),
}
