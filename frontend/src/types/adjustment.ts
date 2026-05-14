export type AdjustmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface KpiAdjustmentRequest {
  id: string
  kpiCriteriaId: string
  kpiCriteriaName: string
  currentTargetValue: number
  currentWeight: number
  currentMinimumValue: number | null
  requestedTargetValue: number | null
  requestedWeight: number | null
  requestedMinimumValue: number | null
  deactivationRequest: boolean
  reason: string
  status: AdjustmentStatus
  requesterId: string
  requesterName: string
  reviewerId: string | null
  reviewerName: string | null
  reviewerNote: string | null
  createdAt: string
  updatedAt: string
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
}
