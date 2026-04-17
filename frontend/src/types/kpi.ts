export type KpiStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'
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
  departmentId: string | null
  departmentName: string | null
  assignedToId: string | null
  assignedToName: string | null
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
  departmentId?: string
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
  departmentId?: string
  assignedToId?: string
  assignedToIds?: string[]
  startDate?: string
  endDate?: string
}

// Matches BE: RejectKpiRequest
export interface RejectKpiRequest {
  reason: string
}
