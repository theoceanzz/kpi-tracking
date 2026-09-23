import axiosClient from '@/lib/axios'

// ── Types (khớp com.kpitracking.dto.response.stats.advanced.*) ──

/** Một chấm trên biểu đồ phân tán. Danh tính là null khi server đã ẩn danh (cấp SELF). */
export interface ScatterPoint {
  userId?: string | null
  name?: string | null
  orgUnitName?: string | null
  /** Trục X — % hoàn thành KPI. */
  completion: number
  /** Trục Y — điểm hành vi. */
  behavior: number
  rating?: number | null
  isSelf?: boolean
  /** Số KPI đã duyệt người này đang gánh trong phạm vi đang xem. */
  kpiCount?: number
}

export interface BehaviorCompletionResponse {
  xLabel: string
  yLabel: string
  xMax: number
  yMax: number
  /** Vạch chia suy từ cấu hình ma trận của tổ chức; rỗng nếu chưa cấu hình. */
  xDividers: number[]
  yDividers: number[]
  points: ScatterPoint[]
  totalCount: number
  /** true → dữ liệu người khác đã bị gỡ danh tính từ server, không phải chỉ ẩn ở giao diện. */
  anonymized: boolean
}

export interface HistogramBin {
  from: number
  to: number
  label: string
  count: number
}

export interface LevelMarker {
  name: string
  threshold: number
  color?: string | null
}

export interface ScoreHistogramResponse {
  bins: HistogramBin[]
  levels: LevelMarker[]
  totalCount: number
  averageScore?: number | null
  maxScore: number
  myScore?: number | null
  anonymized: boolean
}

export interface BoxplotBox {
  orgUnitId: string
  name: string
  min: number
  q1: number
  median: number
  q3: number
  max: number
  count: number
}

export interface UnitBoxplotResponse {
  boxes: BoxplotBox[]
  axisMax: number
}

export interface SankeyResponse {
  nodes: { name: string; depth: number; color?: string | null }[]
  links: { source: number; target: number; value: number; note?: string | null }[]
  valueLabel: string
  empty: boolean
}

export interface SelfVsManagerResponse {
  rows: {
    orgUnitId: string
    name: string
    selfScore: number
    managerScore: number
    gap: number
    memberCount?: number
  }[]
  axisMax: number
  averageGap?: number | null
}

/** Bộ lọc chung — cùng chữ ký với các API thống kê khác. */
export interface AdvancedFilter {
  orgUnitId?: string
  periodId?: string
  periodIdTo?: string
  from?: string
  to?: string
}

const BASE = '/stats/advanced'

async function get<T>(path: string, params: AdvancedFilter): Promise<T> {
  const res = await axiosClient.get(`${BASE}${path}`, { params })
  return res.data.data
}

export const advancedAnalyticsApi = {
  // Tương quan
  getBehaviorCompletion: (p: AdvancedFilter) =>
    get<BehaviorCompletionResponse>('/correlation/behavior-completion', p),

  // Phân phối
  getScoreHistogram: (p: AdvancedFilter) =>
    get<ScoreHistogramResponse>('/distribution/score-histogram', p),
  getUnitBoxplot: (p: AdvancedFilter) =>
    get<UnitBoxplotResponse>('/distribution/unit-boxplot', p),

  // Luồng
  getKpiCascade: (p: AdvancedFilter) => get<SankeyResponse>('/flow/kpi-cascade', p),
  getOkrFlow: (p: AdvancedFilter) => get<SankeyResponse>('/flow/okr', p),

  // Xếp hạng & so sánh
  getSelfVsManager: (p: AdvancedFilter) =>
    get<SelfVsManagerResponse>('/comparison/self-vs-manager', p),
}
