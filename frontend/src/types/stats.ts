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
  departmentName: string
  assignedKpi: number
  totalSubmissions: number
  approvedSubmissions: number
  pendingSubmissions: number
  rejectedSubmissions: number
  averageScore: number | null
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
