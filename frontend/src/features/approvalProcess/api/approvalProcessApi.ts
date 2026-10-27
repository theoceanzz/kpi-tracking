import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import type {
  ApprovalProcess,
  ApprovalProcessCatalog,
  ApprovalProcessListParams,
  ApprovalProcessRequest,
} from '../types'

/** Không endpoint nào nhận organizationId: backend suy tổ chức từ người đang đăng nhập. */
export const approvalProcessApi = {
  list: (params: ApprovalProcessListParams) =>
    axiosInstance
      .get<ApiResponse<PageResponse<ApprovalProcess>>>('/approval-processes', { params })
      .then((r) => r.data.data),

  get: (id: string) =>
    axiosInstance.get<ApiResponse<ApprovalProcess>>(`/approval-processes/${id}`).then((r) => r.data.data),

  catalog: () =>
    axiosInstance.get<ApiResponse<ApprovalProcessCatalog>>('/approval-processes/catalog').then((r) => r.data.data),

  create: (data: ApprovalProcessRequest) =>
    axiosInstance.post<ApiResponse<ApprovalProcess>>('/approval-processes', data).then((r) => r.data.data),

  update: (id: string, data: ApprovalProcessRequest) =>
    axiosInstance.put<ApiResponse<ApprovalProcess>>(`/approval-processes/${id}`, data).then((r) => r.data.data),

  setActive: (id: string, active: boolean) =>
    axiosInstance
      .patch<ApiResponse<ApprovalProcess>>(`/approval-processes/${id}/active`, { active })
      .then((r) => r.data.data),

  remove: (ids: string[]) =>
    axiosInstance.post<ApiResponse<number>>('/approval-processes/bulk-delete', { ids }).then((r) => r.data.data),
}
