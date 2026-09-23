import axiosClient from '@/lib/axios'
import type {
  BscScorecardLevel, BscScorecardStatus, BscScoringMode, BscUnitResultStatus, ScorecardCoverageResponse,
} from '@/features/bsc/types'

// ── Types (khớp com.kpitracking.dto.response.stats.BscOverviewResponses / BscAnalyticsResponses) ──

export interface BscPerspectiveMeta {
  id: string
  code?: string
  name: string
  color?: string
  displayOrder?: number
}

/** Một lĩnh vực cố định (4 trục BSC), tên/màu theo bản của tổ chức. */
export interface BscPerspectiveRef {
  code: string
  name: string
  color: string
}

export interface BscCoverageCounts {
  total: number
  notCascaded: number
  under: number
  ok: number
  over: number
}

/** Thẻ số liệu đầu tab: sức khoẻ BSC của một đợt. */
export interface BscOverview {
  periodId?: string | null
  periodName?: string | null
  scorecardId?: string | null
  scorecardName?: string | null
  orgUnitName?: string | null
  level?: BscScorecardLevel | null
  status?: BscScorecardStatus | null
  scoringMode?: BscScoringMode | null
  achievementPercent?: number | null
  resultStatus?: BscUnitResultStatus | null
  gatePassed?: boolean | null
  gateFailedItems?: string | null
  itemCount: number
  unitScorecardCount: number
  unitStatusCounts: Record<string, number>
  unitsWithResult: number
  unitsGatePassed: number
  unitsGateFailed: number
  coverage: BscCoverageCounts
}

/** Một thẻ điểm trong cây (đã trải phẳng) kèm kết quả đợt. */
export interface BscUnitAttainmentRow {
  scorecardId: string
  name: string
  orgUnitName?: string | null
  level: BscScorecardLevel
  status: BscScorecardStatus
  depth: number
  parentScorecardName?: string | null
  achievementPercent?: number | null
  resultStatus?: BscUnitResultStatus | null
  gatePassed?: boolean | null
  gateFailedItems?: string | null
  itemCount: number
  assignedCount: number
  gateCount: number
  totalWeight?: number | null
}

export interface BscItemRow {
  scorecardPerspectiveId: string
  name: string
  color?: string | null
  fixedPerspective?: string | null
  fixedPerspectiveName?: string | null
  fixedPerspectiveColor?: string | null
  actualValue?: number | null
  targetValue?: number | null
  minimumValue?: number | null
  unit?: string | null
  achievementPercent?: number | null
  weightPercentage?: number | null
  weightedScore?: number | null
  kpiCount?: number | null
  isGate: boolean
  gateMinPercent?: number | null
  gatePassed?: boolean | null
  measurementSource?: string | null
  origin?: string | null
  parentScorecardName?: string | null
  hasResult: boolean
}

export interface BscItemAttainment {
  scorecardId?: string | null
  scorecardName?: string | null
  orgUnitName?: string | null
  periodId?: string | null
  periodName?: string | null
  achievementPercent?: number | null
  gatePassed?: boolean | null
  resultStatus?: BscUnitResultStatus | null
  items: BscItemRow[]
}

export interface BscTrendPoint {
  periodId: string
  label: string
  scorecardId?: string | null
  hasResult: boolean
  achievementPercent?: number | null
  gatePassed?: boolean | null
  /** Mã lĩnh vực cố định → %đạt bình quân theo trọng số. */
  byPerspective: Record<string, number>
}

export interface BscAttainmentTrend {
  perspectives: BscPerspectiveRef[]
  points: BscTrendPoint[]
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
  getOverview: async (params?: BscScopeParams) => {
    const res = await axiosClient.get<{ data: BscOverview }>('/stats/bsc/overview', { params })
    return res.data.data
  },

  getUnitAttainment: async (params?: BscScopeParams) => {
    const res = await axiosClient.get<{ data: BscUnitAttainmentRow[] }>('/stats/bsc/unit-attainment', { params })
    return res.data.data
  },

  getItemAttainment: async (params?: BscScopeParams) => {
    const res = await axiosClient.get<{ data: BscItemAttainment }>('/stats/bsc/item-attainment', { params })
    return res.data.data
  },

  getAttainmentTrend: async (params?: BscScopeParams) => {
    const res = await axiosClient.get<{ data: BscAttainmentTrend }>('/stats/bsc/attainment-trend', { params })
    return res.data.data
  },

  getCascadeCoverage: async (params?: BscScopeParams) => {
    const res = await axiosClient.get<{ data: ScorecardCoverageResponse }>('/stats/bsc/cascade-coverage', { params })
    return res.data.data
  },

  getRankings: async (params?: BscScopeParams & { sortBy?: string; sortDir?: string; page?: number; size?: number }) => {
    const res = await axiosClient.get<{ data: BscRanking }>('/stats/bsc/rankings', { params })
    return res.data.data
  },
}
