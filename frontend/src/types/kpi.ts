export type KpiStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
export type KpiFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

// Matches BE: KpiCriteriaResponse
export interface KpiCriteria {
  id: string
  name: string
  description: string | null
  weight: number | null
  targetValue: number | null
  unit: string | null
  frequency: KpiFrequency
  status: KpiStatus
  orgUnitId: string | null
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
  startDate: string | null
  endDate: string | null
  createdAt: string
  updatedAt: string
}

// Matches BE: CreateKpiCriteriaRequest
export interface CreateKpiRequest {
  name: string
  description?: string
  weight?: number
  targetValue?: number
  unit?: string
  frequency: KpiFrequency
  orgUnitId?: string
  assignedToId?: string
  assignedToIds?: string[]
  startDate?: string
  endDate?: string
}

// Matches BE: UpdateKpiCriteriaRequest
export interface UpdateKpiRequest {
  name?: string
  description?: string
  weight?: number
  targetValue?: number
  unit?: string
  frequency?: KpiFrequency
  orgUnitId?: string
  assignedToId?: string
  assignedToIds?: string[]
  startDate?: string
  endDate?: string
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
