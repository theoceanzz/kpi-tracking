export type KpiStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'INACTIVE' | 'EDIT' | 'EDITED' | 'REPLACED'
export type KpiFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUALLY' | 'YEARLY' | 'UNLIMITED'
export type KpiParentRelationType = 'DELEGATION' | 'DECOMPOSITION'
export type KpiType = 'QUANTITATIVE' | 'QUALITATIVE'

export interface KpiPeriod {
  id: string
  name: string
  periodType: KpiFrequency
  startDate: string | null
  endDate: string | null
  notificationDate: string | null
  organizationId: string
  cycleId?: string | null
  cycleName?: string | null
}

export type CycleEvaluationMode = 'QUANTITATIVE' | 'QUALITATIVE' | 'BOTH'
export type CycleUnitEvalStatus = 'DRAFT' | 'FINALIZED'

// Kỳ đánh giá tổng hợp — gom nhiều đợt (KpiPeriod). Matches BE: KpiCycleResponse
export interface KpiCycle {
  id: string
  name: string
  cycleType: KpiFrequency
  startDate: string | null
  endDate: string | null
  description: string | null
  evaluationMode: CycleEvaluationMode
  organizationId: string
  periodCount: number
}

// Đánh giá kỳ của 1 nhân viên (TB các đợt). Matches BE: CycleUserEvaluationResponse
export interface CyclePeriodBreakdown {
  periodId: string
  periodName: string
  selfScore: number | null
  managerScore: number | null
  /** Điểm định lượng thuần (system_score). */
  quantScore: number | null
  /** Mức định tính thuần (behavior_score, thang 0-5). */
  qualScore: number | null
  /** Xếp loại ma trận hiệu suất (1-5), null nếu thiếu 1 trong 2 trục. */
  matrixRating: number | null
  /** % hoàn thành định lượng của đợt. */
  completionPercent: number | null
}
export interface CycleUserEvaluation {
  userId: string
  userName: string
  orgUnitId: string | null
  orgUnitName: string | null
  mode: CycleEvaluationMode
  selfScore: number | null
  managerScore: number | null
  /** Điểm chốt kỳ: đã nhập tay nếu có, mặc định = managerScore. */
  finalScore: number | null
  finalScoreOverridden: boolean
  /** Mức định tính chấm ở cấp kỳ (0-5) — trục hàng ma trận. */
  qualScore: number | null
  /** Xếp loại 1-5 suy ra từ ma trận hiệu suất. */
  matrixRating: number | null
  /** TB % hoàn thành định lượng các đợt — trục cột ma trận. */
  avgCompletionPercent: number | null
  comment: string | null
  evaluatedByName: string | null
  evaluatedAt: string | null
  /** Bị khoá do đơn vị (hoặc đơn vị cha) đã chốt ⇒ chỉ xem. */
  locked: boolean
  lockedByUnitName: string | null
  periodBreakdown: CyclePeriodBreakdown[]
}

// Đánh giá tổng hợp phòng ban theo kỳ. Matches BE: CycleUnitEvaluationResponse
export interface CycleUnitEvaluation {
  cycleId: string
  cycleName: string
  orgUnitId: string
  orgUnitName: string
  mode: CycleEvaluationMode
  selfScore: number | null
  managerScore: number | null
  /** TB mức định tính (0-5) và TB xếp loại ma trận (1-5) của thành viên. */
  qualScore: number | null
  matrixRating: number | null
  memberCount: number
  /** true khi các con số là snapshot lúc chốt, không phải tính lại. */
  fromSnapshot: boolean
  status: CycleUnitEvalStatus
  comment: string | null
  finalizedByName: string | null
  finalizedAt: string | null
  members: CycleUserEvaluation[]
}

// Matches BE: KpiCriteriaResponse
export interface KpiCriteria {
  id: string
  kpiType: KpiType
  name: string
  description: string | null
  weight: number | null
  targetValue: number | null
  unit: string | null
  frequency: KpiFrequency
  status: KpiStatus
  orgUnitId: string | null
  orgUnitIds: string[] | null
  orgUnitName: string | null
  assigneeIds: string[]
  assigneeNames: string[]
  assignees: import('./auth').UserInfo[]
  createdById: string | null
  createdByName: string | null
  approvedById: string | null
  approvedByName: string | null
  rejectReason: string | null
  submittedAt: string | null
  approvedAt: string | null
  minimumValue: number | null
  isReverseKpi: boolean
  isBonusKpi: boolean
  deadline: string | null
  effectiveDeadline: string | null
  kpiPeriodId: string
  kpiPeriod: KpiPeriod
  submissionCount: number
  expectedSubmissions: number
  keyResultId: string | null
  keyResultName: string | null
  keyResultCode: string | null
  objectiveId: string | null
  objectiveName: string | null
  objectiveCode: string | null
  perspectiveId: string | null
  perspectiveName: string | null
  perspectiveColor: string | null
  effectivePerspectiveId: string | null
  effectivePerspectiveName: string | null
  effectivePerspectiveColor: string | null
  parentId: string | null
  parentName: string | null
  parentRelationType: KpiParentRelationType | null
  createdAt: string
  updatedAt: string
  hasChildren?: boolean
  delegatedToNames?: string[]
  delegatedToIds?: string[]
  childrenWeightTotal?: number
  replacedById?: string | null
  replacedByName?: string | null
  replacementReason?: string | null
}

// Matches BE: CreateKpiCriteriaRequest
export interface CreateKpiRequest {
  kpiType?: KpiType
  name: string
  description?: string
  weight?: number
  targetValue?: number
  unit?: string
  frequency: KpiFrequency
  orgUnitId?: string
  orgUnitIds?: string[]
  assignedToId?: string
  assignedToIds?: string[]
  minimumValue?: number
  isReverseKpi?: boolean
  isBonusKpi?: boolean
  deadline?: string | null
  kpiPeriodId: string
  keyResultId?: string | null
  parentId?: string | null
  parentRelationType?: KpiParentRelationType | null
  perspectiveId?: string | null
}

// Matches BE: UpdateKpiCriteriaRequest
export interface UpdateKpiRequest {
  kpiType?: KpiType
  name?: string
  description?: string
  weight?: number
  targetValue?: number
  unit?: string
  frequency?: KpiFrequency
  orgUnitId?: string
  orgUnitIds?: string[]
  assignedToId?: string
  assignedToIds?: string[]
  minimumValue?: number
  isReverseKpi?: boolean
  isBonusKpi?: boolean
  deadline?: string | null
  kpiPeriodId?: string
  keyResultId?: string | null
  parentId?: string | null
  parentRelationType?: KpiParentRelationType | null
  perspectiveId?: string | null
}

// Matches BE: RejectKpiRequest
export interface RejectKpiRequest {
  reason: string
}
// Matches BE: ImportKpiResponse
export interface ImportKpiResult {
  totalRows: number
  successfulImports: number
  errors: string[]
}

// Matches BE: ReplaceKpiRequest
export interface ReplaceKpiRequest {
  replacementReason?: string
  kpiType?: KpiType
  name: string
  description?: string
  weight?: number
  targetValue?: number
  minimumValue?: number
  unit?: string
  frequency: KpiFrequency
  assignedToIds?: string[]
  isReverseKpi?: boolean
  isBonusKpi?: boolean
  deadline?: string | null
  keyResultId?: string | null
  perspectiveId?: string | null
}

// Matches BE: BatchUpdateWeightRequest
export interface WeightUpdateItem {
  kpiId: string
  weight: number
}

export interface BatchUpdateWeightRequest {
  updates: WeightUpdateItem[]
}
