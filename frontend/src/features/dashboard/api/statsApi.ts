import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import type { OverviewStats, OrgUnitStats, EmployeeKpiStats, MyKpiProgress } from '@/types/stats'

export const statsApi = {
  getOverview: () =>
    axiosInstance.get<ApiResponse<OverviewStats>>('/stats/overview').then((r) => r.data.data),

  getOrgUnitStats: () =>
    axiosInstance.get<ApiResponse<OrgUnitStats[]>>('/stats/org-units').then((r) => r.data.data),

  getEmployeeStats: (page = 0, size = 5) =>
    axiosInstance.get<ApiResponse<PageResponse<EmployeeKpiStats>>>(`/stats/employees?page=${page}&size=${size}`).then((r) => r.data.data),

  getMyProgress: (page = 0, size = 5) =>
    axiosInstance.get<ApiResponse<MyKpiProgress>>(`/stats/my-progress?page=${page}&size=${size}`).then((r) => r.data.data),

  getEmployeeProgress: (userId: string, page = 0, size = 5) =>
    axiosInstance.get<ApiResponse<MyKpiProgress>>(`/stats/employee-progress/${userId}?page=${page}&size=${size}`).then((r) => r.data.data),
}
