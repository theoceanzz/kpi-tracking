import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import type { CycleUserEvaluation, CycleUnitEvaluation, CycleApprovalStep, SendEvaluationResult } from '@/types/kpi'

export const kpiCycleEvaluationApi = {
  /** Trạng thái chốt kỳ của mọi đơn vị trong phạm vi — thay cho việc gọi từng đơn vị một. */
  listUnitStatuses: (cycleId: string) =>
    axiosInstance
      .get<ApiResponse<CycleUnitStatus[]>>(`/kpi-cycles/${cycleId}/evaluation/units`)
      .then(r => r.data.data),

  /** Bảng xếp hạng chốt kỳ của mọi nhân sự trong phạm vi. */
  listUserRankings: (cycleId: string) =>
    axiosInstance
      .get<ApiResponse<CycleUserRank[]>>(`/kpi-cycles/${cycleId}/evaluation/users`)
      .then(r => r.data.data),

  getUserEval: (cycleId: string, userId: string) =>
    axiosInstance
      .get<ApiResponse<CycleUserEvaluation>>(`/kpi-cycles/${cycleId}/evaluation/users/${userId}`)
      .then((r) => r.data.data),

  saveUserScore: (
    cycleId: string,
    userId: string,
    data: { finalScore: number | null; qualScore: number | null; comment: string },
  ) =>
    axiosInstance
      .put<ApiResponse<CycleUserEvaluation>>(`/kpi-cycles/${cycleId}/evaluation/users/${userId}`, data)
      .then((r) => r.data.data),

  getUnitSummary: (cycleId: string, orgUnitId: string) =>
    axiosInstance
      .get<ApiResponse<CycleUnitEvaluation>>(`/kpi-cycles/${cycleId}/evaluation/units/${orgUnitId}`)
      .then((r) => r.data.data),

  /** Chuỗi duyệt từ đơn vị đang xem lên tới gốc, kèm lịch sử chốt/mở khoá. */
  getApprovalChain: (cycleId: string, orgUnitId: string) =>
    axiosInstance
      .get<ApiResponse<CycleApprovalStep[]>>(`/kpi-cycles/${cycleId}/evaluation/units/${orgUnitId}/chain`)
      .then((r) => r.data.data),

  finalizeUnit: (cycleId: string, orgUnitId: string, comment: string) =>
    axiosInstance
      .post<ApiResponse<CycleUnitEvaluation>>(`/kpi-cycles/${cycleId}/evaluation/units/${orgUnitId}/finalize`, { comment })
      .then((r) => r.data.data),

  reopenUnit: (cycleId: string, orgUnitId: string) =>
    axiosInstance
      .post<ApiResponse<CycleUnitEvaluation>>(`/kpi-cycles/${cycleId}/evaluation/units/${orgUnitId}/reopen`)
      .then((r) => r.data.data),

  /** Gửi kết quả đánh giá kỳ qua email cho các nhân viên được chọn. */
  sendEvaluation: (cycleId: string, orgUnitId: string, userIds: string[]) =>
    axiosInstance
      .post<ApiResponse<SendEvaluationResult>>(
        `/kpi-cycles/${cycleId}/evaluation/units/${orgUnitId}/send`, { userIds })
      .then((r) => r.data.data),
}

/** Khớp BE: CycleUnitStatusResponse. */
export interface CycleUnitStatus {
  orgUnitId: string
  orgUnitName: string
  levelOrder: number | null
  status: 'DRAFT' | 'FINALIZED' | string
  memberCount: number
  managerScore: number | null
  qualScore: number | null
  matrixRating: number | null
  /** Xếp loại đơn vị đã chốt trong kỳ — null khi đơn vị chưa chốt. */
  classification: string | null
  classificationColor: string | null
  finalizedByName: string | null
  finalizedAt: string | null
}

/** Khớp BE: CycleUserRankResponse. */
export interface CycleUserRank {
  userId: string
  userName: string
  userAvatarUrl: string | null
  orgUnitName: string | null
  finalScore: number | null
  qualScore: number | null
  matrixRating: number | null
  /** null khi chưa có điểm — người này chưa được chấm, không phải hạng chót. */
  rank: number | null
}
