// Matches BE: OverviewStatsResponse
export interface OverviewStats {
  totalUsers: number
  totalOrgUnits: number
  totalKpiCriteria: number
  approvedKpi: number
  pendingKpi: number
  rejectedKpi: number
  draftKpi: number
  totalSubmissions: number
  pendingSubmissions: number
  approvedSubmissions: number
  rejectedSubmissions: number
  totalEvaluations: number
}

// Matches BE: DeptKpiStatsResponse
export interface OrgUnitStats {
  orgUnitId: string
  orgUnitName: string
  parentOrgUnitId?: string
  memberCount: number
  totalKpi: number
  approvedKpi: number
  pendingKpi: number
  rejectedKpi: number
  totalSubmissions: number
  approvedSubmissions: number
  pendingSubmissions: number
  rejectedSubmissions: number
}

// Matches BE: EmployeeKpiStatsResponse
export interface EmployeeKpiStats {
  userId: string
  fullName: string
  email: string
  role: string
  orgUnitName: string
  assignedKpi: number
  totalSubmissions: number
  approvedSubmissions: number
  pendingSubmissions: number
  rejectedSubmissions: number
  lateSubmissions: number
  averageScore: number | null
}

export interface KpiTask {
  id: string
  name: string
  periodName: string
  deadline: string | null
  status: 'NOT_STARTED' | 'PENDING' | 'OVERDUE' | 'APPROVED'
  submissionCount: number
  expectedSubmissions: number
}

// Matches BE: MyKpiProgressResponse
export interface MyKpiProgress {
  totalAssignedKpi: number
  totalSubmissions: number
  approvedSubmissions: number
  pendingSubmissions: number
  rejectedSubmissions: number
  lateSubmissions: number
  averageScore: number | null
  tasks: {
    content: KpiTask[]
    page: number
    size: number
    totalElements: number
    totalPages: number
    last: boolean
  }
}
