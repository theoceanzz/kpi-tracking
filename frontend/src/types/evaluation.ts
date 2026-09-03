import type { PerspectiveScoreResponse, BscScoringMode } from '@/features/bsc/types'

// Matches BE: EvaluationResponse
export interface Evaluation {
  id: string
  userId: string
  userName: string
  userAvatarUrl: string | null
  kpiPeriodId: string
  kpiPeriodName: string
  evaluatorId: string | null
  evaluatorName: string | null
  orgUnitId: string | null
  orgUnitName: string | null
  score: number | null
  comment: string | null
  systemScore: number | null
  behaviorScore?: number | null
  kpiCompletionPercent?: number | null
  matrixRating?: number | null
  periodStart?: string | null
  periodEnd?: string | null
  createdAt: string
  updatedAt: string
  evaluatorRole: 'SELF' | 'MANAGER' | 'DIRECTOR' | 'TEAM_LEADER' | 'DEPT_HEAD' | 'DEPT_DEPUTY' | 'TEAM_DEPUTY' | 'REGIONAL_DIRECTOR' | 'CEO'
  evaluatorRoleLevel?: number
  evaluatorRoleName?: string
  orgUnitLevel?: number
  userLevel?: number
  userRank?: number
  userRoleName?: string
  // ── BSC ──
  bscScore?: number | null
  bscScoringMode?: BscScoringMode | null
  /** Điểm chính thức: = bscScore khi OFFICIAL, ngược lại = systemScore */
  officialScore?: number | null
  bscPerspectives?: PerspectiveScoreResponse[] | null
}

// Matches BE: CreateEvaluationRequest
export interface CreateEvaluationRequest {
  userId: string
  kpiPeriodId: string
  score: number
  comment?: string
}

// Matches BE: EvaluationScorePreview
export interface EvaluationScorePreview {
  systemScore: number | null
  behaviorScore: number | null
  kpiCompletionPercent: number | null
  matrixRating: number | null
  /** Điểm KPI thưởng đã quy về thang điểm — cộng THÊM lên trên thang điểm. */
  bonusScore?: number | null
  /** Trần điểm được phép lưu = thang điểm + bonusScore (backend chặn theo con số này). */
  maxAllowedScore?: number | null
  // ── BSC ──
  bscScore?: number | null
  bscScoringMode?: BscScoringMode | null
  officialScore?: number | null
  bscPerspectives?: PerspectiveScoreResponse[] | null
  bscCoveragePercent?: number | null
  bscUnassignedKpis?: string[] | null
}

// Frontend-only: evaluation layer type for UI display
export type EvaluationLayer = 'self' | 'head' | 'director'
