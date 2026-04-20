import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import type { OverviewStats, OrgUnitStats, EmployeeKpiStats, MyKpiProgress } from '@/types/stats'

export const statsApi = {
  getOverview: () =>
    axiosInstance.get<ApiResponse<OverviewStats>>('/stats/overview').then((r) => r.data.data),

  getOrgUnitStats: () =>
    axiosInstance.get<ApiResponse<OrgUnitStats[]>>('/stats/org-units').then((r) => r.data.data),

  getEmployeeStats: () =>
    axiosInstance.get<ApiResponse<EmployeeKpiStats[]>>('/stats/employees').then((r) => r.data.data),

  getMyProgress: () =>
    axiosInstance.get<ApiResponse<MyKpiProgress>>('/stats/my-progress').then((r) => r.data.data),
}
