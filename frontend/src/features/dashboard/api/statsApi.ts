import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import type { OverviewStats, OrgUnitStats, EmployeeKpiStats, MyKpiProgress, AnalyticsMyStats, DrillDownResponse, AnalyticsDetailRow, AnalyticsSummary, MetricValueResponse, CompletedCountResponse, CountResponse, ComboChartResponse, ObjectiveDetailedDto, PagedObjectiveDetailedResponse, OrgUnitFilterDto, TopEntitiesDashboardResponse, ScopedMetrics, TopScopedEntitiesResponse, ExportDetailedPerformanceResponse } from '@/types/stats'

export const statsApi = {
  getOverview: (organizationId?: string, orgUnitId?: string) =>
    axiosInstance.get<ApiResponse<OverviewStats>>('/stats/overview', { params: { organizationId, orgUnitId } }).then((r) => r.data.data),

  getOrgUnitStats: (organizationId?: string) =>
    axiosInstance.get<ApiResponse<OrgUnitStats[]>>('/stats/org-units', { params: { organizationId } }).then((r) => r.data.data),

  getEmployeeStats: (page = 0, size = 5, organizationId?: string, orgUnitId?: string) =>
    axiosInstance.get<ApiResponse<PageResponse<EmployeeKpiStats>>>(`/stats/employees`, { params: { page, size, organizationId, orgUnitId } }).then((r) => r.data.data),

  getMyProgress: (page = 0, size = 5) =>
    axiosInstance.get<ApiResponse<MyKpiProgress>>(`/stats/my-progress?page=${page}&size=${size}`).then((r) => r.data.data),

  getEmployeeProgress: (userId: string, page = 0, size = 5) =>
    axiosInstance.get<ApiResponse<MyKpiProgress>>(`/stats/employee-progress/${userId}?page=${page}&size=${size}`).then((r) => r.data.data),

  // Analytics
  getMyAnalytics: (from?: string, to?: string) =>
    axiosInstance.get<ApiResponse<AnalyticsMyStats>>('/stats/my-analytics', { params: { from, to } }).then((r) => r.data.data),

  getDrillDown: (orgUnitId?: string, from?: string, to?: string) =>
    axiosInstance.get<ApiResponse<DrillDownResponse>>('/stats/drill-down', { params: { orgUnitId, from, to } }).then((r) => r.data.data),

  getDetailTable: (params: { orgUnitId?: string; search?: string; page?: number; size?: number }) =>
    axiosInstance.get<ApiResponse<PageResponse<AnalyticsDetailRow>>>('/stats/detail-table', { params }).then((r) => r.data.data),

  getSummary: (orgUnitId?: string, rankingUnitId?: string, direction?: string) =>
    axiosInstance.get<ApiResponse<AnalyticsSummary>>('/stats/summary', { params: { orgUnitId, rankingUnitId, direction } }).then((r) => r.data.data),

  getSummaryTrend: (orgUnitId?: string, period: string = '5_MONTHS') =>
    axiosInstance.get<ApiResponse<any[]>>('/stats/summary/trend', { params: { orgUnitId, period } }).then((r) => r.data.data),

  getSummaryComparison: (orgUnitId?: string, from?: string, to?: string, onlyApproved?: boolean) =>
    axiosInstance.get<ApiResponse<any>>('/stats/summary/unit-comparison', { params: { orgUnitId, from, to, onlyApproved } }).then((r) => r.data.data),

  getSummaryRisks: (orgUnitId?: string, period: string = 'MONTH') =>
    axiosInstance.get<ApiResponse<any>>('/stats/summary/risks', { params: { orgUnitId, period } }).then((r) => r.data.data),

  getSummaryRankings: (orgUnitId?: string, rankingUnitId?: string, from?: string, to?: string, onlyApproved?: boolean) =>
    axiosInstance.get<ApiResponse<any>>('/stats/summary/rankings', { params: { orgUnitId, rankingUnitId, from, to, onlyApproved } }).then((r) => r.data.data),

  // Subordinate Analytics
  getSubordinateCompletion: (from?: string, to?: string, onlyApproved?: boolean) =>
    axiosInstance.get<ApiResponse<MetricValueResponse>>('/stats/subordinates/metrics/completion', { params: { from, to, onlyApproved } }).then((r) => r.data.data),

  getSubordinatePerformance: (from?: string, to?: string, onlyApproved?: boolean) =>
    axiosInstance.get<ApiResponse<MetricValueResponse>>('/stats/subordinates/metrics/performance', { params: { from, to, onlyApproved } }).then((r) => r.data.data),

  getSubordinateCompletedCount: (from?: string, to?: string, onlyApproved?: boolean) =>
    axiosInstance.get<ApiResponse<CompletedCountResponse>>('/stats/subordinates/metrics/completed-count', { params: { from, to, onlyApproved } }).then((r) => r.data.data),

  getSubordinateAtRisk: (from?: string, to?: string, onlyApproved?: boolean) =>
    axiosInstance.get<ApiResponse<CountResponse>>('/stats/subordinates/metrics/at-risk', { params: { from, to, onlyApproved } }).then((r) => r.data.data),

  getSubordinatePersonnel: () =>
    axiosInstance.get<ApiResponse<CountResponse>>('/stats/subordinates/metrics/personnel').then((r) => r.data.data),

  getSubordinateComboChart: (from?: string, to?: string, onlyApproved?: boolean) =>
    axiosInstance.get<ApiResponse<ComboChartResponse>>('/stats/subordinates/chart/combo', { params: { from, to, onlyApproved } }).then((r) => r.data.data),

  getSubordinateDetailedObjectives: (params: {
    from?: string; to?: string; onlyApproved?: boolean;
    sortBy?: string; sortDir?: string;
    orgUnitId?: string;
    page?: number; size?: number;
  }) =>
    axiosInstance.get<ApiResponse<PagedObjectiveDetailedResponse>>('/stats/subordinates/details', { params }).then((r) => r.data.data),

  getDetailFilterUnits: () =>
    axiosInstance.get<ApiResponse<OrgUnitFilterDto[]>>('/stats/subordinates/details/filter-units').then((r) => r.data.data),

  getObjScopedMetrics: (id: string, from?: string, to?: string, onlyApproved?: boolean) =>
    axiosInstance.get<ApiResponse<ScopedMetrics>>(`/stats/subordinates/objectives/${id}/metrics`, { params: { from, to, onlyApproved } }).then((r) => r.data.data),

  getObjScopedCombo: (id: string, from?: string, to?: string, onlyApproved?: boolean) =>
    axiosInstance.get<ApiResponse<ComboChartResponse>>(`/stats/subordinates/objectives/${id}/chart/combo`, { params: { from, to, onlyApproved } }).then((r) => r.data.data),

  getObjScopedTopEntities: (id: string, from?: string, to?: string, onlyApproved?: boolean) =>
    axiosInstance.get<ApiResponse<TopScopedEntitiesResponse>>(`/stats/subordinates/objectives/${id}/top-entities`, { params: { from, to, onlyApproved } }).then((r) => r.data.data),

  getKrScopedMetrics: (id: string, from?: string, to?: string, onlyApproved?: boolean) =>
    axiosInstance.get<ApiResponse<ScopedMetrics>>(`/stats/subordinates/key-results/${id}/metrics`, { params: { from, to, onlyApproved } }).then((r) => r.data.data),

  getKrScopedCombo: (id: string, from?: string, to?: string, onlyApproved?: boolean) =>
    axiosInstance.get<ApiResponse<ComboChartResponse>>(`/stats/subordinates/key-results/${id}/chart/combo`, { params: { from, to, onlyApproved } }).then((r) => r.data.data),

  getKrScopedTopEntities: (id: string, from?: string, to?: string, onlyApproved?: boolean) =>
    axiosInstance.get<ApiResponse<TopScopedEntitiesResponse>>(`/stats/subordinates/key-results/${id}/top-entities`, { params: { from, to, onlyApproved } }).then((r) => r.data.data),

  getKpiScopedMetrics: (id: string, from?: string, to?: string, onlyApproved?: boolean) =>
    axiosInstance.get<ApiResponse<ScopedMetrics>>(`/stats/subordinates/kpis/${id}/metrics`, { params: { from, to, onlyApproved } }).then((r) => r.data.data),

  getKpiScopedCombo: (id: string, from?: string, to?: string, onlyApproved?: boolean) =>
    axiosInstance.get<ApiResponse<ComboChartResponse>>(`/stats/subordinates/kpis/${id}/chart/combo`, { params: { from, to, onlyApproved } }).then((r) => r.data.data),

  getKpiScopedTopEntities: (id: string, from?: string, to?: string, onlyApproved?: boolean) =>
    axiosInstance.get<ApiResponse<TopScopedEntitiesResponse>>(`/stats/subordinates/kpis/${id}/top-entities`, { params: { from, to, onlyApproved } }).then((r) => r.data.data),

  getTopEntitiesDashboard: (filter: 'BEST' | 'WORST', from?: string, to?: string, onlyApproved?: boolean) =>
    axiosInstance.get<ApiResponse<TopEntitiesDashboardResponse>>('/stats/subordinates/top-entities-dashboard', { params: { filter, from, to, onlyApproved } }).then((r) => r.data.data),
  
  getDetailedExportStats: (orgUnitId: string | undefined, kpiPeriodId: string) =>
    axiosInstance.get<ApiResponse<ExportDetailedPerformanceResponse[]>>('/stats/detailed-export', { params: { orgUnitId, kpiPeriodId } }).then((r) => r.data.data),
}
