import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import type { OverviewStats, OrgUnitStats, EmployeeKpiStats, MyKpiProgress, AnalyticsMyStats, DrillDownResponse, AnalyticsDetailRow, AnalyticsSummary } from '@/types/stats'

export const statsApi = {
  getOverview: () =>
    axiosInstance.get<ApiResponse<OverviewStats>>('/stats/overview').then((r) => r.data.data),

  getOrgUnitStats: () =>
    axiosInstance.get<ApiResponse<OrgUnitStats[]>>('/stats/org-units').then((r) => r.data.data),

  getEmployeeStats: () =>
    axiosInstance.get<ApiResponse<EmployeeKpiStats[]>>('/stats/employees').then((r) => r.data.data),

  getMyProgress: () =>
    axiosInstance.get<ApiResponse<MyKpiProgress>>('/stats/my-progress').then((r) => r.data.data),

  // Analytics
  getMyAnalytics: (from?: string, to?: string) =>
    axiosInstance.get<ApiResponse<AnalyticsMyStats>>('/stats/my-analytics', { params: { from, to } }).then((r) => r.data.data),

  getDrillDown: (orgUnitId?: string) =>
    axiosInstance.get<ApiResponse<DrillDownResponse>>('/stats/drill-down', { params: { orgUnitId } }).then((r) => r.data.data),

  getDetailTable: (params: { orgUnitId?: string; search?: string; page?: number; size?: number }) =>
    axiosInstance.get<ApiResponse<PageResponse<AnalyticsDetailRow>>>('/stats/detail-table', { params }).then((r) => r.data.data),

  getSummary: (orgUnitId?: string, rankingUnitId?: string, direction?: string) =>
    axiosInstance.get<ApiResponse<AnalyticsSummary>>('/stats/summary', { params: { orgUnitId, rankingUnitId, direction } }).then((r) => r.data.data),

  getSummaryTrend: (orgUnitId?: string, period: string = '5_MONTHS') =>
    axiosInstance.get<ApiResponse<any[]>>('/stats/summary/trend', { params: { orgUnitId, period } }).then((r) => r.data.data),

  getSummaryComparison: (orgUnitId?: string, period: string = 'MONTH') =>
    axiosInstance.get<ApiResponse<any>>('/stats/summary/unit-comparison', { params: { orgUnitId, period } }).then((r) => r.data.data),

  getSummaryRisks: (orgUnitId?: string, period: string = 'MONTH') =>
    axiosInstance.get<ApiResponse<any>>('/stats/summary/risks', { params: { orgUnitId, period } }).then((r) => r.data.data),

  getSummaryRankings: (orgUnitId?: string, rankingUnitId?: string, period: string = 'MONTH') =>
    axiosInstance.get<ApiResponse<any>>('/stats/summary/rankings', { params: { orgUnitId, rankingUnitId, period } }).then((r) => r.data.data),
}
