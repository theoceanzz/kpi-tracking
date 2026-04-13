// Matches BE: OverviewStatsResponse
export interface OverviewStats {
  totalUsers: number
  totalDepartments: number
  totalKpiCriteria: number
  approvedKpi: number
  pendingKpi: number
  totalSubmissions: number
  pendingSubmissions: number
  approvedSubmissions: number
  rejectedSubmissions: number
  totalEvaluations: number
}

// Matches BE: DeptKpiStatsResponse
export interface DepartmentStats {
  departmentId: string
  departmentName: string
  totalKpi: number
  approvedKpi: number
  pendingKpi: number
  rejectedKpi: number
}

// Matches BE: MyKpiProgressResponse
export interface MyKpiProgress {
  totalAssignedKpi: number
  totalSubmissions: number
  approvedSubmissions: number
  pendingSubmissions: number
  rejectedSubmissions: number
  averageScore: number | null
}
