export enum BscPerspectiveStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export interface PerspectiveResponse {
  id: string
  code: string
  name: string
  description?: string
  color?: string
  icon?: string
  displayOrder: number
  status: BscPerspectiveStatus
}

export interface PerspectiveRequest {
  code: string
  name: string
  description?: string
  color?: string
  icon?: string
  displayOrder?: number
  status?: BscPerspectiveStatus
}

export interface ImportBscResponse {
  totalRows: number
  successfulImports: number
  errors: string[]
}

export enum BscScorecardStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum BscScoringMode {
  SHADOW = 'SHADOW',
  OFFICIAL = 'OFFICIAL',
}

export enum BscEmptyPerspectivePolicy {
  RENORMALIZE = 'RENORMALIZE',
  ZERO_FILL = 'ZERO_FILL',
}

export interface ScorecardPerspectiveResponse {
  id: string
  perspectiveId: string
  code: string
  name: string
  color?: string
  weightPercentage: number
  displayOrder: number
}

export interface ScorecardResponse {
  id: string
  name: string
  vision?: string
  kpiPeriodId: string
  kpiPeriodName?: string
  status: BscScorecardStatus
  scoringMode: BscScoringMode
  emptyPerspectivePolicy: BscEmptyPerspectivePolicy
  perspectives: ScorecardPerspectiveResponse[]
  totalWeight: number
  createdAt?: string
  updatedAt?: string
}

export interface ScorecardPerspectiveWeightRequest {
  perspectiveId: string
  weightPercentage: number
  displayOrder?: number
  reason?: string
}

export interface ScorecardRequest {
  name: string
  vision?: string
  kpiPeriodId: string
  status?: BscScorecardStatus
  scoringMode?: BscScoringMode
  emptyPerspectivePolicy?: BscEmptyPerspectivePolicy
  perspectives?: ScorecardPerspectiveWeightRequest[]
}

export interface PerspectiveScoreResponse {
  perspectiveId: string
  code: string
  name: string
  color?: string
  weightPercentage: number
  kpiCount: number
  achievementPercent?: number | null
  weightedScore?: number | null
}

export interface BscDashboardResponse {
  scorecardId: string
  name: string
  vision?: string
  kpiPeriodId: string
  kpiPeriodName?: string
  scoringMode: BscScoringMode
  overallScore?: number | null
  perspectives: PerspectiveScoreResponse[]
}

// ── Strategy Map (GĐ4b) ──────────────────────────────────────
export interface SmKpiNode {
  id: string
  name: string
  perspectiveMismatch: boolean
  perspectiveId?: string | null
}
export interface SmKeyResultNode {
  id: string
  code?: string
  name: string
  kpis: SmKpiNode[]
}
export interface SmObjectiveNode {
  id: string
  code?: string
  name: string
  keyResults: SmKeyResultNode[]
}
export interface SmPerspectiveLane {
  perspectiveId: string
  code: string
  name: string
  color?: string
  displayOrder: number
  objectives: SmObjectiveNode[]
}
export interface SmRelationEdge {
  id: string
  sourceObjectiveId: string
  targetObjectiveId: string
  label?: string
}
export interface StrategyMapResponse {
  perspectives: SmPerspectiveLane[]
  directKpis: SmKpiNode[]
  relations: SmRelationEdge[]
}

export interface ObjectiveRelationRequest {
  sourceObjectiveId: string
  targetObjectiveId: string
  label?: string
}
export interface ObjectiveRelationResponse {
  id: string
  sourceObjectiveId: string
  sourceObjectiveName: string
  targetObjectiveId: string
  targetObjectiveName: string
  label?: string
}
