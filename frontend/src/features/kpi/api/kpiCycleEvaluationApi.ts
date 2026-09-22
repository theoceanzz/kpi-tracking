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

  /**
   * `matrixRating` chỉ gửi khi muốn đặt/bỏ hạng hiệu chỉnh — có key là backend đụng tới, không có
   * key thì giữ nguyên hạng đã hiệu chỉnh trước đó.
   */
  saveUserScore: (
    cycleId: string,
    userId: string,
    data: { finalScore: number | null; qualScore: number | null; comment: string; matrixRating?: number | null },
  ) =>
    axiosInstance
      .put<ApiResponse<CycleUserEvaluation>>(`/kpi-cycles/${cycleId}/evaluation/users/${userId}`, data)
      .then((r) => r.data.data),

  getUnitSummary: (cycleId: string, orgUnitId: string) =>
    axiosInstance
      .get<ApiResponse<CycleUnitEvaluation>>(`/kpi-cycles/${cycleId}/evaluation/units/${orgUnitId}`)
      .then((r) => r.data.data),

  /** Chấm tay điểm cả đơn vị (ghi đè TB thành viên); score = null để bỏ ghi đè. */
  saveUnitScore: (cycleId: string, orgUnitId: string, data: { score: number | null; reason: string }) =>
    axiosInstance
      .put<ApiResponse<CycleUnitEvaluation>>(`/kpi-cycles/${cycleId}/evaluation/units/${orgUnitId}/score`, data)
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

  /** Lùi một bước trạng thái; `cascade` mở luôn các đơn vị con đang khoá kết quả. */
  reopenUnit: (cycleId: string, orgUnitId: string, cascade = false) =>
    axiosInstance
      .post<ApiResponse<CycleUnitEvaluation>>(
        `/kpi-cycles/${cycleId}/evaluation/units/${orgUnitId}/reopen`, null, { params: { cascade } })
      .then((r) => r.data.data),

  /** Bước 1: chốt dữ liệu kỳ — đóng đầu vào, chụp điểm nền, sang bước hiệu chỉnh. */
  startCalibration: (cycleId: string, orgUnitId: string) =>
    axiosInstance
      .post<ApiResponse<CycleUnitEvaluation>>(`/kpi-cycles/${cycleId}/evaluation/units/${orgUnitId}/calibrate`)
      .then((r) => r.data.data),

  /** Bước 3: phân bố vs khung + đề xuất nắn điểm. */
  getCalibration: (cycleId: string, orgUnitId: string) =>
    axiosInstance
      .get<ApiResponse<CalibrationPlan>>(`/kpi-cycles/${cycleId}/evaluation/units/${orgUnitId}/calibration`)
      .then((r) => r.data.data),

  /** Gửi kết quả đánh giá kỳ qua email cho các nhân viên được chọn. */
  sendEvaluation: (cycleId: string, orgUnitId: string, userIds: string[]) =>
    axiosInstance
      .post<ApiResponse<SendEvaluationResult>>(
        `/kpi-cycles/${cycleId}/evaluation/units/${orgUnitId}/send`, { userIds })
      .then((r) => r.data.data),
}

/** Khớp BE: UnitClassificationService.QuotaSlot. */
export interface QuotaSlot {
  level: string
  color: string
  targetPercent: number
  minPercent: number
  maxPercent: number
  minCount: number
  maxCount: number
  currentCount: number
  currentPercent: number
  over: boolean
  under: boolean
}

/** Khớp BE: UnitClassificationService.CalibrationSuggestion. */
export interface CalibrationSuggestion {
  userId: string
  userName: string
  orgUnitName: string | null
  fromLevel: string
  fromColor: string
  toLevel: string
  toColor: string
  currentScore: number | null
  /** Chế độ thang điểm: điểm chốt kỳ gợi ý. */
  suggestedScore: number | null
  currentRating: number | null
  /** Chế độ ma trận: hạng gợi ý. */
  suggestedRating: number | null
  direction: 'DOWN' | 'UP'
  /** true = gỡ mức vượt trần (khung chặn sẽ không cho khoá nếu bỏ qua); false = lấp sàn, tuỳ chọn. */
  required: boolean
  reason: string
}

/** Khớp BE: UnitClassificationService.CalibrationPlan. */
export interface CalibrationPlan {
  configured: boolean
  mode: 'warn' | 'block' | null
  profileName: string | null
  headcount: number
  evaluated: number
  slots: QuotaSlot[]
  withinFrame: boolean
  blocked: boolean
  suggestions: CalibrationSuggestion[]
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
