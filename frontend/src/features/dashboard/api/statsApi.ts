import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import type { OverviewStats, DepartmentStats, MyKpiProgress } from '@/types/stats'

export const statsApi = {
  getOverview: () =>
    axiosInstance.get<ApiResponse<OverviewStats>>('/stats/overview').then((r) => r.data.data),

  getDepartmentStats: () =>
    axiosInstance.get<ApiResponse<DepartmentStats[]>>('/stats/departments').then((r) => r.data.data),

  getMyProgress: () =>
    axiosInstance.get<ApiResponse<MyKpiProgress>>('/stats/my-progress').then((r) => r.data.data),
}
