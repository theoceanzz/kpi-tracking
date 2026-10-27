import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import type { WorkflowConfig } from '../types'

/**
 * Không endpoint nào nhận organizationId: backend suy tổ chức từ chính người đang đăng nhập.
 * (sidebar-settings làm ngược lại và vì thế đọc/ghi được cấu hình của tổ chức khác.)
 */
export const workflowApi = {
  getConfig: () =>
    axiosInstance.get<ApiResponse<WorkflowConfig>>('/kpi-workflow/config').then((r) => r.data.data),

  // Backend còn PUT/validate/reset, nhưng màn cấu hình luồng đã bỏ nên frontend chỉ đọc.
}
