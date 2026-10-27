import axiosClient from '@/lib/axios'
import type { RatingLevelPoint } from './personDetailApi'

/**
 * Trang thống kê chi tiết một đơn vị — khớp
 * `com.kpitracking.dto.response.stats.advanced.UnitDetailResponses`.
 *
 * <p>Cùng khuôn với `personDetailApi`: một lời gọi cho cả trang, `light` bỏ phần sổ đánh giá.
 */

export interface UnitMetrics {
  /** Đóng góp BSC %, ĐÚNG cột mà bảng xếp hạng đơn vị hiện. */
  bscPercent?: number | null
  avgKpiPercent?: number | null
  kpiCount?: number | null
  conductScore?: number | null
  conductMax?: number | null
  memberCount?: number | null
}

/** Một trục radar = một lĩnh vực BSC cố định. `percent` null = lĩnh vực đó chưa có số. */
export interface BscAxisPoint {
  code?: string | null
  name?: string | null
  color?: string | null
  percent?: number | null
}

export interface BscTrendPoint {
  periodId: string
  periodName?: string | null
  achievementPercent?: number | null
  gatePassed?: boolean | null
  provisional?: boolean
  axes: BscAxisPoint[]
}

export interface UnitTrendPoint {
  periodId: string
  periodName?: string | null
  bscPercent?: number | null
  ratingName?: string | null
  ratingColor?: string | null
  ratingIndex?: number | null
}

/** Điểm chốt KỲ của đơn vị — tập con của `CycleUnitEvaluationResponse` phía backend. */
export interface UnitCycleEvaluation {
  selfScore?: number | null
  managerScore?: number | null
  autoScore?: number | null
  overrideScore?: number | null
  qualScore?: number | null
  matrixRating?: number | null
  behaviorScore?: number | null
  memberCount?: number
  fromSnapshot?: boolean
  classification?: string | null
  classificationColor?: string | null
  status?: string | null
  comment?: string | null
  finalizedByName?: string | null
  finalizedAt?: string | null
}

export interface UnitPeriod {
  periodId: string
  name?: string | null
  startDate?: string | null
  endDate?: string | null
  bscPercent?: number | null
  gatePassed?: boolean | null
  provisional?: boolean
  ratingName?: string | null
  ratingColor?: string | null
  axes: BscAxisPoint[]
}

/** `cycleId` null = nhóm gom các đợt không thuộc kỳ nào; nhóm đó luôn đứng cuối. */
export interface UnitCycle {
  cycleId?: string | null
  name?: string | null
  startDate?: string | null
  endDate?: string | null
  evaluation?: UnitCycleEvaluation | null
  periods: UnitPeriod[]
}

export interface UnitDetail {
  orgUnitId: string
  name?: string | null
  parentName?: string | null
  periodName?: string | null
  metrics?: UnitMetrics | null
  bsc: BscAxisPoint[]
  bscTrend: BscTrendPoint[]
  trend: UnitTrendPoint[]
  ratingLevels: RatingLevelPoint[]
  cycles: UnitCycle[]
  /** false ⇒ ba khung BSC trống là bình thường, phải nói ra thay vì để trắng. */
  bscEnabled?: boolean
}

export interface UnitDetailParams {
  periodId?: string
  periodIdTo?: string
  cycleId?: string
  /** Bỏ sổ đánh giá (phần nặng nhất) — thẻ xem nhanh lúc rê chuột không cần tới nó. */
  light?: boolean
}

export const unitDetailApi = {
  get: async (orgUnitId: string, params?: UnitDetailParams) => {
    const res = await axiosClient.get<{ data: UnitDetail }>(
      `/stats/advanced/unit/${orgUnitId}`, { params })
    return res.data.data
  },
}
