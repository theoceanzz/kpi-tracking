import axiosClient from '@/lib/axios'

export interface PersonalObjectiveMetrics {
  averageProgress: number
  averagePerformance: number
  runningKpis: number
  completedKpis: number
  riskKpis: number
}

export interface ComboChartData {
  points: {
    label: string
    oldItems: number
    newItems: number
    completionTrend: number
    performanceTrend: number
  }[]
}

export interface SubmissionHistory {
  id: string
  code: string
  submitDate: string
  actualValue: number
  contributionProgress: number
  performance: number
  status: string
}

export interface TeammateProgress {
  userId: string
  avatarUrl: string
  fullName: string
  employeeCode: string
  role: string
  department: string
  actualValue: number
  progress: number
  performance: number
}

export type KpiParentRelationType = 'DELEGATION' | 'DECOMPOSITION'

export interface KpiDetail {
  kpiId: string
  kpiName: string
  targetValue: number
  actualValue: number
  unit: string
  progress: number | null
  performance: number | null
  objectiveName: string
  objectiveCode: string
  keyResultName: string
  keyResultCode: string
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
  parentId?: string | null
  parentRelationType?: KpiParentRelationType | null
  childRelationType?: KpiParentRelationType | null
  children?: KpiDetail[] | null
  mySubmissions: SubmissionHistory[]
  teammates: TeammateProgress[]
}

export interface DrawerData {
  kpiName: string
  krName: string
  krCode: string
  objName: string
  objCode: string
  shared: boolean
  unit: string
  targetValue: number
  myActualValue: number
  myProgress: number
  totalActualValue: number
  totalProgress: number
  myPerformance: number
  teamPerformance: number
  chartData: {
    points: {
      label: string
      targetValue: number
      teamTotalActual: number
      myActual: number
      myPerformance: number
      teammateValues: Record<string, { actual: number, performance: number }>
    }[]
    availableTeammates: { userId: string, fullName: string }[]
  }
  contributions: {
    userId: string
    fullName: string
    contributionPercentage: number
    actualValue: number
  }[]
}

export interface KpiFilterOption {
  code: string
  name: string
}

export interface PagedKpiDetailResponse {
  content: KpiDetail[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
  availableObjectives: KpiFilterOption[]
  availableKeyResults: KpiFilterOption[]
}

export interface KpiDetailParams {
  from?: string
  to?: string
  onlyApproved?: boolean
  sortBy?: string
  sortDir?: string
  objectiveCode?: string
  keyResultCode?: string
  sharedType?: string
  page?: number
  size?: number
  periodId?: string
}

export const personalObjectiveApi = {
  getMetrics: async (params?: { from?: string; to?: string; onlyApproved?: boolean; periodId?: string }) => {
    const res = await axiosClient.get<{ data: PersonalObjectiveMetrics }>('/stats/personal/objectives/metrics', { params })
    return res.data.data
  },
  getComboChart: async (params?: { from?: string; to?: string; onlyApproved?: boolean; periodId?: string }) => {
    const res = await axiosClient.get<{ data: ComboChartData }>('/stats/personal/objectives/chart/combo', { params })
    return res.data.data
  },
  getDetailedKpis: async (params?: KpiDetailParams) => {
    const res = await axiosClient.get<{ data: PagedKpiDetailResponse }>('/stats/personal/objectives/details', { params })
    return res.data.data
  },
  getKpiDrawerData: async (id: string, params?: { from?: string; to?: string; onlyApproved?: boolean; periodId?: string }) => {
    const res = await axiosClient.get<{ data: DrawerData }>(`/stats/personal/objectives/kpis/${id}/drawer`, { params })
    return res.data.data
  }
}
