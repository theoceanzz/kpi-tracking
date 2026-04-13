// Matches BE: EvaluationResponse
export interface Evaluation {
  id: string
  userId: string
  userName: string
  kpiCriteriaId: string
  kpiCriteriaName: string
  evaluatorId: string | null
  evaluatorName: string | null
  score: number | null
  comment: string | null
  periodStart: string | null
  periodEnd: string | null
  createdAt: string
  updatedAt: string
}

// Matches BE: CreateEvaluationRequest
export interface CreateEvaluationRequest {
  userId: string
  kpiCriteriaId: string
  score: number
  comment?: string
  periodStart?: string
  periodEnd?: string
}
