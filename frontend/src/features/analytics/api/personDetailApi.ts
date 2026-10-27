import axiosClient from '@/lib/axios'

/**
 * Trang thống kê chi tiết một người — khớp
 * `com.kpitracking.dto.response.stats.advanced.PersonDetailResponses`.
 *
 * <p>Một lời gọi cho cả trang: bốn nguồn sẵn có ở backend nằm dưới bốn luật quyền khác nhau, gom
 * về một endpoint của nhóm thống kê thì cả trang đi chung một luật.
 */

export interface PersonMetrics {
  /** Hiệu suất KPI %, ĐÚNG cột mà bảng xếp hạng hiện — hai màn phải nói cùng một con số. */
  performancePercent?: number | null
  conductScore?: number | null
  conductMax?: number | null
  ratingName?: string | null
  ratingColor?: string | null
  /** Tỉ lệ kỳ nộp muộn hoặc thiếu bài, %. */
  latePercent?: number | null
  lateCount?: number | null
  totalCount?: number | null
}

export interface ConductAxisPoint {
  criteriaName?: string | null
  weight?: number | null
  selfScore?: number | null
  managerScore?: number | null
  maxScore?: number | null
  minScore?: number | null
}

export interface PersonKpiRow {
  kpiId: string
  periodId?: string | null
  name?: string | null
  kpiType?: string | null
  unit?: string | null
  weight?: number | null
  targetValue?: number | null
  actualValue?: number | null
  /** null = KPI không tham gia tính điểm, hoặc định tính chưa chấm. */
  attainmentPercent?: number | null
  periodName?: string | null
  status?: string | null
}

export interface PersonTrendPoint {
  periodId: string
  periodName?: string | null
  performancePercent?: number | null
  conductScore?: number | null
  ratingName?: string | null
  ratingColor?: string | null
  /** Bậc 1..n trong `ratingLevels` — toạ độ Y của biểu đồ bậc xếp loại. */
  ratingIndex?: number | null
}

export interface RatingLevelPoint {
  name?: string | null
  color?: string | null
  threshold?: number | null
}

/** Điểm chốt KỲ — tập con của `CycleUserEvaluationResponse` phía backend. */
export interface CycleEvaluation {
  selfScore?: number | null
  managerScore?: number | null
  finalScore?: number | null
  finalScoreOverridden?: boolean
  qualScore?: number | null
  matrixRating?: number | null
  avgCompletionPercent?: number | null
  behaviorScore?: number | null
  conductScore?: number | null
  conductMaxScore?: number | null
  feedback360Score?: number | null
  comment?: string | null
  evaluatedByName?: string | null
  evaluatedAt?: string | null
  locked?: boolean
}

/** Một dòng `evaluations`: ai chấm và chấm bao nhiêu. */
export interface EvaluatorScore {
  evaluatorId?: string | null
  evaluatorName?: string | null
  evaluatorRoleName?: string | null
  self?: boolean
  score?: number | null
  systemScore?: number | null
  bscScore?: number | null
  behaviorScore?: number | null
  kpiCompletionPercent?: number | null
  matrixRating?: number | null
  comment?: string | null
  evaluatedAt?: string | null
}

export interface PersonPeriod {
  periodId: string
  name?: string | null
  startDate?: string | null
  endDate?: string | null
  selfScore?: number | null
  managerScore?: number | null
  quantScore?: number | null
  qualScore?: number | null
  completionPercent?: number | null
  matrixRating?: number | null
  ratingName?: string | null
  ratingColor?: string | null
  evaluators: EvaluatorScore[]
  kpis: PersonKpiRow[]
}

/** `cycleId` null = nhóm gom các đợt KHÔNG thuộc kỳ nào; nhóm đó luôn đứng cuối. */
export interface PersonCycle {
  cycleId?: string | null
  name?: string | null
  startDate?: string | null
  endDate?: string | null
  evaluation?: CycleEvaluation | null
  periods: PersonPeriod[]
}

export interface PersonDetail {
  userId: string
  fullName?: string | null
  email?: string | null
  avatarUrl?: string | null
  orgUnitName?: string | null
  periodName?: string | null
  metrics?: PersonMetrics | null
  conduct: ConductAxisPoint[]
  trend: PersonTrendPoint[]
  /** Thang xếp loại của tổ chức, TĂNG DẦN theo ngưỡng — trục Y của biểu đồ bậc xếp loại. */
  ratingLevels: RatingLevelPoint[]
  /** Sổ đánh giá: kỳ → đợt → KPI. */
  cycles: PersonCycle[]
}

export interface PersonDetailParams {
  periodId?: string
  periodIdTo?: string
  cycleId?: string
  /** Bỏ sổ đánh giá (phần nặng nhất) — thẻ xem nhanh lúc rê chuột không cần tới nó. */
  light?: boolean
}

export const personDetailApi = {
  get: async (userId: string, params?: PersonDetailParams) => {
    const res = await axiosClient.get<{ data: PersonDetail }>(
      `/stats/advanced/person/${userId}`, { params })
    return res.data.data
  },
}
