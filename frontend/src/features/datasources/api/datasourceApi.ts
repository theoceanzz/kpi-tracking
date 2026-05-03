import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import type {
  Datasource, DsColumn, DsRow,
  CreateDatasourceRequest, UpdateDatasourceRequest,
  UpsertColumnRequest, UpsertRowRequest
} from '@/types/datasource'

export const datasourceApi = {
  // Datasources
  getAll: (params: { page?: number; size?: number; orgUnitId?: string } = {}) =>
    axiosInstance.get<ApiResponse<PageResponse<Datasource>>>('/datasources', { params }).then(r => r.data.data),

  getById: (id: string) =>
    axiosInstance.get<ApiResponse<Datasource>>(`/datasources/${id}`).then(r => r.data.data),

  create: (data: CreateDatasourceRequest) =>
    axiosInstance.post<ApiResponse<Datasource>>('/datasources', data).then(r => r.data.data),

  update: (id: string, data: UpdateDatasourceRequest) =>
    axiosInstance.put<ApiResponse<Datasource>>(`/datasources/${id}`, data).then(r => r.data.data),

  delete: (id: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/datasources/${id}`).then(r => r.data),

  // Columns
  getColumns: (datasourceId: string) =>
    axiosInstance.get<ApiResponse<DsColumn[]>>(`/datasources/${datasourceId}/columns`).then(r => r.data.data),

  addColumn: (datasourceId: string, data: UpsertColumnRequest) =>
    axiosInstance.post<ApiResponse<DsColumn>>(`/datasources/${datasourceId}/columns`, data).then(r => r.data.data),

  updateColumn: (columnId: string, data: UpsertColumnRequest) =>
    axiosInstance.put<ApiResponse<DsColumn>>(`/datasources/columns/${columnId}`, data).then(r => r.data.data),

  deleteColumn: (columnId: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/datasources/columns/${columnId}`).then(r => r.data),

  // Rows
  getRows: (datasourceId: string, params: { page?: number; size?: number } = {}) =>
    axiosInstance.get<ApiResponse<PageResponse<DsRow>>>(`/datasources/${datasourceId}/rows`, { params }).then(r => r.data.data),

  addRow: (datasourceId: string, data?: UpsertRowRequest) =>
    axiosInstance.post<ApiResponse<DsRow>>(`/datasources/${datasourceId}/rows`, data || {}).then(r => r.data.data),

  updateRow: (rowId: string, data: UpsertRowRequest) =>
    axiosInstance.put<ApiResponse<DsRow>>(`/datasources/rows/${rowId}`, data).then(r => r.data.data),

  deleteRow: (rowId: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/datasources/rows/${rowId}`).then(r => r.data),

  // Data query for charts
  queryData: (datasourceId: string) =>
    axiosInstance.get<ApiResponse<Record<string, unknown>[]>>(`/datasources/${datasourceId}/data`).then(r => r.data.data),
}
