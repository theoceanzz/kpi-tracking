import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import type { ApprovalOutcome, KpiApprovalChain } from '@/types/approvalChain'
import type { ApprovalInboxItem } from '../types'

/** Hộp "Chờ tôi duyệt" chung và duyệt đề xuất theo quy trình (BE: /api/v1/approvals). */
export const approvalInboxApi = {
  inbox: () =>
    axiosInstance.get<ApiResponse<ApprovalInboxItem[]>>('/approvals/inbox').then((r) => r.data.data),

  /** "Quy trình của tôi": đề xuất người gọi đã gửi đi duyệt; `active` = còn đang chạy. */
  mine: (active: boolean, page: number, size = 20) =>
    axiosInstance
      .get<ApiResponse<PageResponse<ApprovalInboxItem>>>('/approvals/mine', { params: { active, page, size } })
      .then((r) => r.data.data),

  detail: (flowId: string) =>
    axiosInstance
      .get<ApiResponse<{ item: ApprovalInboxItem; chain: KpiApprovalChain }>>(`/approvals/flows/${flowId}`)
      .then((r) => r.data.data),

  approve: (flowId: string, body: { expectedStepId?: string | null; comment?: string }) =>
    axiosInstance.post<ApiResponse<ApprovalOutcome>>(`/approvals/flows/${flowId}/approve`, body).then((r) => r.data.data),

  reject: (flowId: string, body: { expectedStepId?: string | null; comment: string }) =>
    axiosInstance.post<ApiResponse<null>>(`/approvals/flows/${flowId}/reject`, body).then((r) => r.data.data),
}
