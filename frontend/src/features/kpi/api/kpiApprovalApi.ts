import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import type { KpiCriteria } from '@/types/kpi'
import type { BulkApproveResult, KpiApprovalChain } from '@/types/approvalChain'

/** Chuỗi duyệt KPI theo phân cấp (BE: /api/v1/kpi-approvals). */
export const kpiApprovalApi = {
  /** Chỉ tiêu đang chờ ĐÚNG người gọi ở bước hiện tại. */
  inbox: (params: { kpiPeriodId?: string; orgUnitId?: string } = {}) =>
    axiosInstance.get<ApiResponse<KpiCriteria[]>>('/kpi-approvals/inbox', { params }).then((r) => r.data.data),

  inboxCount: () =>
    axiosInstance
      .get<ApiResponse<{ criteria: number; adjustments: number }>>('/kpi-approvals/inbox/count')
      .then((r) => r.data.data),

  chain: (kpiId: string) =>
    axiosInstance.get<ApiResponse<KpiApprovalChain>>(`/kpi-approvals/kpi/${kpiId}`).then((r) => r.data.data),

  bulkApprove: (items: { kpiId: string; expectedStepId?: string | null }[], comment?: string) =>
    axiosInstance
      .post<ApiResponse<BulkApproveResult[]>>('/kpi-approvals/bulk-approve', { items, comment })
      .then((r) => r.data.data),

  reassign: (stepId: string, approverId: string, reason: string) =>
    axiosInstance
      .post<ApiResponse<KpiApprovalChain>>(`/kpi-approvals/steps/${stepId}/reassign`, { approverId, reason })
      .then((r) => r.data.data),
}
