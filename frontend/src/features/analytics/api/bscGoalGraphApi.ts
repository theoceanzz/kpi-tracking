import axiosClient from '@/lib/axios'
import type { BscScopeParams } from './bscAnalyticsApi'

/**
 * Đồ thị mục tiêu BSC — MỘT nguồn cho cả ba cách xem (bản đồ chiến lược, cây liên kết, xương cá).
 *
 * <p>Ba view đọc cùng payload này nên không bao giờ nói ba chuyện khác nhau; khác nhau chỉ ở cách
 * vẽ. Mọi con số do server tính (đọc từ kết quả đợt đã "Tính lại"), client không tự tính lại gì.
 */

export type GoalStatus = 'GOOD' | 'WARN' | 'BEHIND' | 'NO_DATA'

export interface GoalThresholds {
  /** Từ mức này trở lên là "tốt". */
  good: number
  /** Dưới mức này là "chậm"; ở giữa là "cảnh báo". */
  warn: number
}

export interface GraphPerspective {
  code: string
  name: string
  color?: string | null
  displayOrder: number
  weightPercentage?: number | null
  achievementPercent?: number | null
  objectiveIds: string[]
}

export interface GoalTrend {
  deltaPercent?: number | null
  direction: 'UP' | 'DOWN' | 'FLAT' | 'NEW'
}

export interface GraphObjective {
  id: string
  /** "F1", "C2"… suy ra từ lĩnh vực + thứ tự (bảng chỉ tiêu không có cột mã). */
  derivedCode?: string | null
  name?: string | null
  perspectiveCode: string
  perspectiveName?: string | null
  color?: string | null
  scorecardId: string
  scorecardName?: string | null
  orgUnitName?: string | null
  level?: string | null
  parentId?: string | null
  linkType?: string | null
  contributionValue?: number | null
  contributionPercent?: number | null
  weightPercentage?: number | null
  targetValue?: number | null
  minimumValue?: number | null
  unit?: string | null
  actualValue?: number | null
  achievementPercent?: number | null
  weightedScore?: number | null
  measurementSource?: string | null
  isGate: boolean
  gateMinPercent?: number | null
  gatePassed?: boolean | null
  /** ASSIGNED = cấp trên giao xuống · SELF = đơn vị tự đặt. */
  origin?: string | null
  hasResult: boolean
  provisional: boolean
  status: GoalStatus
  trend?: GoalTrend | null
  kpiCount: number
  childCount: number
  coverageStatus?: string | null
  coverageGap?: number | null
  hasMoreChildren: boolean
}

export interface GraphEdge {
  id: string
  sourceId: string
  targetId: string
  kind: 'CASCADE' | 'CONTRIBUTION'
  linkType?: string | null
  contributionPercent?: number | null
}

export interface BscGoalGraph {
  periodId?: string | null
  periodName?: string | null
  scorecardId?: string | null
  scorecardName?: string | null
  orgUnitName?: string | null
  level?: string | null
  scoringMode?: string | null
  resultStatus?: string | null
  provisional: boolean
  emptyPerspectivePolicy?: string | null
  achievementPercent?: number | null
  gatePassed?: boolean | null
  thresholds: GoalThresholds
  perspectives: GraphPerspective[]
  objectives: GraphObjective[]
  edges: GraphEdge[]
  hiddenObjectiveCount: number
  hiddenUnitCount: number
}

export interface ContributorUnit {
  orgUnitId?: string | null
  orgUnitName?: string | null
  scorecardId?: string | null
  scorecardName?: string | null
  linkType?: string | null
  contributionValue?: number | null
  contributionPercent?: number | null
  targetValue?: number | null
  achievementPercent?: number | null
  gatePassed?: boolean | null
  kpiCount: number
}

export interface ContributorPerson {
  userId: string
  fullName?: string | null
  avatarUrl?: string | null
  orgUnitName?: string | null
  kpiCount: number
  attainmentPercent?: number | null
}

export interface ContributorKpi {
  kpiId: string
  name?: string | null
  kpiType?: string | null
  unit?: string | null
  weight?: number | null
  targetValue?: number | null
  actualValue?: number | null
  /** null = KPI không tham gia tính điểm, hoặc định tính chưa chấm. */
  attainmentPercent?: number | null
  assigneeNames?: string | null
  periodName?: string | null
  status?: string | null
}

export interface BscObjectiveContributors {
  objective?: GraphObjective | null
  units: ContributorUnit[]
  people: ContributorPerson[]
  kpis: ContributorKpi[]
  hiddenUnitCount: number
  hiddenPersonCount: number
}

export interface GoalGraphParams extends BscScopeParams {
  status?: GoalStatus | 'ALL'
  perspective?: string[]
  /** Mặc định server trả 20 mục tiêu nặng nhất — đồ thị lớn không đổ hết ngay. */
  limit?: number
}

export const bscGoalGraphApi = {
  getGoalGraph: async (params?: GoalGraphParams) => {
    const res = await axiosClient.get<{ data: BscGoalGraph }>('/stats/bsc/goal-graph', { params })
    return res.data.data
  },

  /** Một lần bung một nút = một lời gọi. */
  getContributors: async (itemId: string, params?: BscScopeParams) => {
    const res = await axiosClient.get<{ data: BscObjectiveContributors }>(
      `/stats/bsc/goal-graph/${itemId}/contributors`, { params })
    return res.data.data
  },
}
