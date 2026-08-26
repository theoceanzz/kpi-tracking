import axiosClient from '@/lib/axios'

export interface OrgUnitKpiMetrics {
  averageProgress: number
  averagePerformance: number
  runningKpis: number
  completedKpis: number
  riskKpis: number
}

export interface OrgUnitKpiComboChartData {
  points: {
    label: string
    oldItems: number
    newItems: number
    completionTrend: number
    performanceTrend: number
  }[]
}

export type KpiParentRelationType = 'DELEGATION' | 'DECOMPOSITION'

export interface OrgUnitKpiDetail {
  kpiId: string
  kpiName: string
  targetValue: number
  actualValue: number
  unit: string
  progress: number | null
  performance: number | null
  orgUnitId: string | null
  orgUnitName: string
  periodStart: string | null
  periodEnd: string | null
  periodName?: string | null
  weight?: number | null
  assigneeName?: string | null
  shared: boolean
  participantCount: number
  // Nhận diện loại KPI + KPI con (cho tag & expand)
  isReverseKpi?: boolean
  isBonusKpi?: boolean
  kpiType?: 'QUANTITATIVE' | 'QUALITATIVE'
  qualitativeLevelName?: string | null
  parentId?: string | null
  parentRelationType?: KpiParentRelationType | null
  childRelationType?: KpiParentRelationType | null
  children?: OrgUnitKpiDetail[] | null
}

export interface OrgUnitFilterOption {
  code: string
  name: string
  depth?: number
}

export interface OrgUnitKpiPagedResponse {
  content: OrgUnitKpiDetail[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
  availableOrgUnits: OrgUnitFilterOption[]
}

export interface OrgUnitKpiDetailParams {
  orgUnitId?: string
  filterOrgUnitId?: string
  from?: string
  to?: string
  onlyApproved?: boolean
  sortBy?: string
  sortDir?: string
  sharedType?: string
  page?: number
  size?: number
  periodId?: string
  periodIdTo?: string
}

export interface OrgUnitAssigneeStat {
  userId: string
  fullName: string
  avatarUrl: string | null
  orgUnitName: string | null
  roleName: string | null
  actualValue: number
  completionRate: number
  performanceRate: number
}

export interface OrgUnitAssigneeChartValues {
  actual: number
  performance: number
}

export interface OrgUnitDrawerChartPoint {
  label: string
  targetValue: number
  teamTotalActual: number
  teamPerformance: number
  assigneeValues: Record<string, OrgUnitAssigneeChartValues>
}

export interface QualLevelBucket {
  levelName: string
  position?: number | null
  color?: string | null
  count: number
}

export interface OrgUnitSubmissionStat {
  label: string
  submitterName: string
  actualValue: number
  contributionProgress: number
  performance: number
  submittedAt: string | null
  qualitativeLevelName?: string | null
}

export interface OrgUnitKpiDrawerData {
  kpiName: string
  unit: string
  isShared: boolean
  isReverseKpi?: boolean
  isBonusKpi?: boolean
  periodName?: string | null
  orgUnitName?: string | null
  weight?: number | null
  targetValue: number
  totalActualValue: number
  totalProgress: number
  teamPerformance: number
  chartPoints: OrgUnitDrawerChartPoint[]
  assigneeStats: OrgUnitAssigneeStat[]
  availableAssignees: { userId: string; fullName: string }[]
  topSubmissions: OrgUnitSubmissionStat[]
  kpiType?: 'QUANTITATIVE' | 'QUALITATIVE'
  qualitativeLevelName?: string | null
  qualitativeDistribution?: QualLevelBucket[] | null
}

export interface UnitRiskRow {
  unitId: string
  unitName: string
  totalKpis: number
  overdueCount: number
  overdueRate: number
  avgProgress: number
}

export interface UnitRiskPagedResponse {
  content: UnitRiskRow[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

export interface MemberRiskRow {
  userId: string
  fullName: string
  avatarUrl: string | null
  orgUnitName: string
  totalKpis: number
  overdueCount: number
  overdueRate: number
  avgProgress: number
}

export interface MemberRiskPagedResponse {
  content: MemberRiskRow[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
  availableOrgUnits: OrgUnitFilterOption[]
}

export interface OverdueKpiForUnit {
  kpiId: string
  kpiName: string
  deadline: string | null
  assigneeNames: string[]
  targetValue: number
  unit: string | null
}

export interface MemberSubmissionItem {
  actualValue: number
  submittedAt: string | null
  status: string
}

export interface OverdueKpiForMember {
  kpiId: string
  kpiName: string
  deadline: string | null
  targetValue: number
  unit: string | null
  submissions: MemberSubmissionItem[]
}

export const orgUnitKpiApi = {
  getMetrics: async (params?: { orgUnitId?: string; from?: string; to?: string; onlyApproved?: boolean; periodId?: string; periodIdTo?: string }) => {
    const res = await axiosClient.get<{ data: OrgUnitKpiMetrics }>('/stats/org-unit/kpis/metrics', { params })
    return res.data.data
  },

  getComboChart: async (params?: { orgUnitId?: string; from?: string; to?: string; onlyApproved?: boolean; periodId?: string; periodIdTo?: string; groupBy?: string }) => {
    const res = await axiosClient.get<{ data: OrgUnitKpiComboChartData }>('/stats/org-unit/kpis/chart/combo', { params })
    return res.data.data
  },

  getDetailedKpis: async (params?: OrgUnitKpiDetailParams) => {
    const res = await axiosClient.get<{ data: OrgUnitKpiPagedResponse }>('/stats/org-unit/kpis/details', { params })
    return res.data.data
  },

  getKpiDrawerData: async (kpiId: string, params?: { from?: string; to?: string; onlyApproved?: boolean; periodId?: string; periodIdTo?: string }) => {
    const res = await axiosClient.get<{ data: OrgUnitKpiDrawerData }>(`/stats/org-unit/kpis/${kpiId}/drawer`, { params })
    return res.data.data
  },

  getUnitRisks: async (params?: { orgUnitId?: string; from?: string; to?: string; onlyApproved?: boolean; page?: number; size?: number; sortBy?: string; sortDir?: string; periodId?: string; periodIdTo?: string }) => {
    const res = await axiosClient.get<{ data: UnitRiskPagedResponse }>('/stats/org-unit/kpis/risks/units', { params })
    return res.data.data
  },

  /**
   * Rủi ro theo thành viên. `everyKpi` = tính cả KPI gắn key result — bắt buộc với tổ chức bật
   * OKR (gần như mọi KPI đều nằm dưới key result, bỏ qua chúng là ra bảng rỗng). Mặc định
   * `false` giữ nguyên phạm vi cũ của bảng "Rủi ro thành viên" bên Phân tích.
   */
  getMemberRisks: async (params?: { orgUnitId?: string; filterOrgUnitId?: string; from?: string; to?: string; onlyApproved?: boolean; page?: number; size?: number; sortBy?: string; sortDir?: string; periodId?: string; periodIdTo?: string; everyKpi?: boolean }) => {
    const res = await axiosClient.get<{ data: MemberRiskPagedResponse }>('/stats/org-unit/kpis/risks/members', { params })
    return res.data.data
  },

  getUnitOverdueKpis: async (unitId: string) => {
    const res = await axiosClient.get<{ data: OverdueKpiForUnit[] }>(`/stats/org-unit/kpis/risks/units/${unitId}/overdue-kpis`)
    return res.data.data
  },

  /** Chi tiết KPI trễ hạn của một thành viên — truyền cùng đợt/kỳ VÀ cùng `everyKpi` với bảng gọi nó để hai bên khớp số. */
  getMemberOverdueKpis: async (userId: string, params?: { orgUnitId?: string; periodId?: string; periodIdTo?: string; everyKpi?: boolean }) => {
    const res = await axiosClient.get<{ data: OverdueKpiForMember[] }>(`/stats/org-unit/kpis/risks/members/${userId}/overdue-kpis`, { params })
    return res.data.data
  },
}
