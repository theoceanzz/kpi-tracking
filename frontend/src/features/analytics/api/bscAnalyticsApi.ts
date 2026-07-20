import axiosClient from '@/lib/axios'

// ── Types (khớp com.kpitracking.dto.response.stats.BscAnalyticsResponses) ──

export interface BscPerspectiveMeta {
  id: string
  code?: string
  name: string
  color?: string
  displayOrder?: number
}

export interface BscPerspectivePoint {
  perspectiveId: string
  code?: string
  name: string
  color?: string
  displayOrder?: number
  weightPercentage?: number | null
  /** Điểm đạt trung bình có trọng số của viễn cảnh (0..150), null nếu không có dữ liệu. */
  averageScore?: number | null
  weightedScore?: number | null
  kpiCount?: number
}

export interface BscBalance {
  averageBscScore?: number | null
  averageSystemScore?: number | null
  evaluationCount: number
  /** SHADOW | OFFICIAL | null. */
  scoringMode?: string | null
  strongestPerspective?: string | null
  strongestScore?: number | null
  weakestPerspective?: string | null
  weakestScore?: number | null
  coveragePercent?: number | null
  mappedKpiCount?: number
  unmappedKpiCount?: number
  unmappedKpiNames?: string[]
  perspectives: BscPerspectivePoint[]
}

export interface BscTrendPoint {
  label: string
  overall?: number | null
  /** perspectiveId → điểm đạt tại mốc này. */
  values: Record<string, number>
}
export interface BscTrend {
  perspectives: BscPerspectiveMeta[]
  points: BscTrendPoint[]
}

export interface BscUnitRow {
  orgUnitId: string
  orgUnitName: string
  overallBsc?: number | null
  overallSystem?: number | null
  evaluationCount: number
  values: Record<string, number>
}
export interface BscUnitComparison {
  perspectives: BscPerspectiveMeta[]
  units: BscUnitRow[]
}

export interface BscVsSystemRow {
  id: string
  name: string
  bscScore?: number | null
  systemScore?: number | null
  evaluationCount: number
}
export interface BscVsSystem {
  level: string
  scoringMode?: string | null
  rows: BscVsSystemRow[]
}

export interface BscRankingRow {
  userId: string
  fullName: string
  email?: string | null
  bscScore?: number | null
  systemScore?: number | null
  evaluationCount: number
  perspectiveScores: Record<string, number>
}
export interface BscRanking {
  perspectives: BscPerspectiveMeta[]
  content: BscRankingRow[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

export interface BscScopeParams {
  orgUnitId?: string
  periodId?: string
  periodIdTo?: string
}

// ── Client ──────────────────────────────────────────────────────────────

export const bscAnalyticsApi = {
  getBalance: async (params?: BscScopeParams) => {
    const res = await axiosClient.get<{ data: BscBalance }>('/stats/bsc/balance', { params })
    return res.data.data
  },

  getTrend: async (params?: BscScopeParams & { groupBy?: string }) => {
    const res = await axiosClient.get<{ data: BscTrend }>('/stats/bsc/trend', { params })
    return res.data.data
  },

  getUnitComparison: async (params?: BscScopeParams) => {
    const res = await axiosClient.get<{ data: BscUnitComparison }>('/stats/bsc/unit-comparison', { params })
    return res.data.data
  },

  getBscVsSystem: async (params?: BscScopeParams & { level?: string }) => {
    const res = await axiosClient.get<{ data: BscVsSystem }>('/stats/bsc/bsc-vs-system', { params })
    return res.data.data
  },

  getRankings: async (params?: BscScopeParams & { sortBy?: string; sortDir?: string; page?: number; size?: number }) => {
    const res = await axiosClient.get<{ data: BscRanking }>('/stats/bsc/rankings', { params })
    return res.data.data
  },
}
