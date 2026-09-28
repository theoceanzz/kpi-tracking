export type AdjustmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface KpiAdjustmentRequest {
  id: string
  kpiCriteriaId: string
  kpiCriteriaName: string
  kpiType?: import('./kpi').KpiType
  perspectiveName?: string | null
  perspectiveColor?: string | null
  categoryWeightPercent?: number | null
  currentTargetValue: number
  currentWeight: number
  currentMinimumValue: number | null
  requestedTargetValue: number | null
  requestedWeight: number | null
  requestedMinimumValue: number | null
  deactivationRequest: boolean
  compensationPercentage: number | null
  reason: string
  status: AdjustmentStatus
  /** Đơn vị của KPI bị điều chỉnh — dùng để gom danh sách theo Đơn vị → Người → Yêu cầu. */
  orgUnitId: string | null
  orgUnitName: string | null
  requesterId: string
  requesterName: string
  reviewerId: string | null
  reviewerName: string | null
  reviewerNote: string | null
  createdAt: string
  updatedAt: string
  /** % bù trừ do bước trung gian gợi ý (yêu cầu dừng KPI). */
  suggestedCompensationPercent?: number | null
  /** Vị trí trong chuỗi duyệt, tính cho người đang xem. */
  approval?: import('./approvalChain').ApprovalSummary | null
}

export interface CreateAdjustmentRequest {
  kpiCriteriaId: string
  requestedTargetValue?: number
  requestedWeight?: number
  requestedMinimumValue?: number
  deactivationRequest: boolean
  reason: string
}

export interface ReviewAdjustmentRequest {
  status: AdjustmentStatus
  reviewerNote?: string
  compensationPercentage?: number
  expectedStepId?: string | null
}
