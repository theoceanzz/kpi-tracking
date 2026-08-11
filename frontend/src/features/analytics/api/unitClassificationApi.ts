import axiosClient from '@/lib/axios'

// ── Types (khớp com.kpitracking.dto.response.stats.UnitClassificationResponses) ──

export interface UnitClassLevelInfo { name: string; color: string }

export interface UnitClassBucket {
  level: string
  color: string
  count: number
  percent: number
}

export interface UnitClassification { level: string; color: string }

export interface UnitClassTrendPoint {
  periodName: string
  /** levelName → % người ở mức đó trong kỳ */
  percents: Record<string, number>
}

export interface UnitClassChild {
  orgUnitId: string
  orgUnitName: string
  classification: string | null
  color: string | null
  appliedProfileName?: string | null
  evaluatedMembers: number
}

export interface UnitClassificationOverview {
  orgUnitId: string | null
  orgUnitName: string | null
  levels: UnitClassLevelInfo[]
  totalMembers: number
  evaluatedMembers: number
  currentPeriodName: string | null
  distribution: UnitClassBucket[]
  classification: UnitClassification | null
  appliedProfileName?: string | null
  trend: UnitClassTrendPoint[]
  children: UnitClassChild[]
}

export interface UnitClassScopeParams {
  orgUnitId?: string
  periodId?: string
  periodIdTo?: string
}

export const unitClassificationApi = {
  getOverview: async (params?: UnitClassScopeParams) => {
    const res = await axiosClient.get<{ data: UnitClassificationOverview }>('/stats/unit-classification/overview', { params })
    return res.data.data
  },
}
