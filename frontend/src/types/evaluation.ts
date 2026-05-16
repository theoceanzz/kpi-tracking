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
  systemScore: number | null
  createdAt: string
  updatedAt: string
  evaluatorRole: 'SELF' | 'MANAGER' | 'DIRECTOR' | 'TEAM_LEADER' | 'DEPT_HEAD' | 'DEPT_DEPUTY' | 'TEAM_DEPUTY' | 'REGIONAL_DIRECTOR' | 'CEO'
  evaluatorRoleLevel?: number
  evaluatorRoleName?: string
  orgUnitLevel?: number
  userLevel?: number
  userRank?: number
  userRoleName?: string
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
