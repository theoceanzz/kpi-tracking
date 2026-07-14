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
