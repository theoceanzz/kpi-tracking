// Matches BE: EvaluationResponse
export interface Evaluation {
  id: string
  userId: string
  userName: string
  kpiPeriodId: string
  kpiPeriodName: string
  evaluatorId: string | null
  evaluatorName: string | null
  orgUnitId: string | null
  orgUnitName: string | null
  score: number | null
  comment: string | null
  createdAt: string
  updatedAt: string
}

// Matches BE: CreateEvaluationRequest
export interface CreateEvaluationRequest {
  userId: string
  kpiPeriodId: string
  score: number
  comment?: string
}

// Frontend-only: evaluation layer type for UI display
export type EvaluationLayer = 'self' | 'head' | 'director'
