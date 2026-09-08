import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import type { UpdateWorkflowConfigRequest, WorkflowConfig } from '../types'

/**
 * Không endpoint nào nhận organizationId: backend suy tổ chức từ chính người đang đăng nhập.
 * (sidebar-settings làm ngược lại và vì thế đọc/ghi được cấu hình của tổ chức khác.)
 */
export const workflowApi = {
  getConfig: () =>
    axiosInstance.get<ApiResponse<WorkflowConfig>>('/kpi-workflow/config').then((r) => r.data.data),

  updateConfig: (data: UpdateWorkflowConfigRequest) =>
    axiosInstance.put<ApiResponse<WorkflowConfig>>('/kpi-workflow/config', data).then((r) => r.data.data),

  /** Kiểm mà không lưu — để hiện cảnh báo ngay trong lúc người dùng chỉnh. */
  validateConfig: (data: UpdateWorkflowConfigRequest) =>
    axiosInstance.post<ApiResponse<string[]>>('/kpi-workflow/config/validate', data).then((r) => r.data.data),

  resetConfig: () =>
    axiosInstance.post<ApiResponse<WorkflowConfig>>('/kpi-workflow/config/reset').then((r) => r.data.data),
}
