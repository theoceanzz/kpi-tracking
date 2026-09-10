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

export interface AgreementPoint {
  userId?: string | null
  name?: string | null
  systemScore: number
  bscScore: number
  gap: number
  evaluationCount?: number
  isSelf?: boolean
}

export interface BscVsSystemScatterResponse {
  points: AgreementPoint[]
  axisMax: number
  scoringMode?: string | null
  totalCount: number
  anonymized: boolean
}

export interface PerspectiveBubble {
  perspectiveId: string
  name: string
  color?: string | null
  weightPercentage: number
  averageScore: number
  kpiCount: number
}

export interface PerspectiveBubbleResponse {
  bubbles: PerspectiveBubble[]
  avgWeight?: number | null
  avgScore?: number | null
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

export interface PyramidRow {
  levelOrder: number
  name: string
  left: number
  right: number
}

export interface StatusMeta {
  code: string
  label: string
  color: string
}

export interface SubmissionCompositionResponse {
  statuses: StatusMeta[]
  points: { label: string; values: Record<string, number> }[]
  totalCount: number
}

export interface SubmissionShareResponse {
  statuses: StatusMeta[]
  units: { orgUnitId: string; name: string; percents: Record<string, number>; total: number }[]
}

export interface WaterfallStep {
  name: string
  color?: string | null
  value: number
  weightPercentage?: number | null
  rawScore?: number | null
  kpiCount?: number
  isTotal?: boolean
}

export interface BscWaterfallResponse {
  steps: WaterfallStep[]
  totalScore: number
  scoringMode?: string | null
}

export interface WeightHistoryResponse {
  perspectives: { id: string; name: string; color?: string | null }[]
  points: { at?: string | null; label: string; values: Record<string, number>; changeNote?: string }[]
  changeCount: number
}

export interface SankeyResponse {
  nodes: { name: string; depth: number; color?: string | null }[]
  links: { source: number; target: number; value: number; note?: string | null }[]
  valueLabel: string
  empty: boolean
}

export interface DeviationResponse {
  rows: {
    id?: string | null
    name: string
    subText?: string | null
    deviation: number
    score?: number | null
    isSelf?: boolean
  }[]
  baseline: number
  baselineLabel: string
  unit: string
  anonymized: boolean
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

export interface RankDeltaResponse {
  rows: {
    orgUnitId: string
    name: string
    score: number
    currentRank: number
    previousRank?: number | null
    rankDelta?: number | null
    scoreDelta?: number | null
  }[]
  currentCycleName?: string | null
  previousCycleName?: string | null
  axisMax: number
  comparable: boolean
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
  getBscVsSystem: (p: AdvancedFilter) =>
    get<BscVsSystemScatterResponse>('/correlation/bsc-vs-system', p),
  getPerspectiveBubble: (p: AdvancedFilter) =>
    get<PerspectiveBubbleResponse>('/correlation/perspective-bubble', p),

  // Phân phối
  getScoreHistogram: (p: AdvancedFilter) =>
    get<ScoreHistogramResponse>('/distribution/score-histogram', p),
  getUnitBoxplot: (p: AdvancedFilter) =>
    get<UnitBoxplotResponse>('/distribution/unit-boxplot', p),

  // Thành phần & thời gian
  getSubmissionComposition: (p: AdvancedFilter) =>
    get<SubmissionCompositionResponse>('/timeline/submission-composition', p),
  getSubmissionShare: (p: AdvancedFilter) =>
    get<SubmissionShareResponse>('/part/submission-share', p),
  getBscWaterfall: (p: AdvancedFilter) =>
    get<BscWaterfallResponse>('/part/bsc-waterfall', p),
  getWeightHistory: (p: AdvancedFilter) =>
    get<WeightHistoryResponse>('/timeline/bsc-weight-history', p),

  // Luồng
  getKpiCascade: (p: AdvancedFilter) => get<SankeyResponse>('/flow/kpi-cascade', p),
  getKpiLifecycle: (p: AdvancedFilter) => get<SankeyResponse>('/flow/kpi-lifecycle', p),
  getOkrFlow: (p: AdvancedFilter) => get<SankeyResponse>('/flow/okr', p),

  // Xếp hạng & so sánh
  getDeviation: (p: AdvancedFilter) => get<DeviationResponse>('/comparison/deviation', p),
  getSelfVsManager: (p: AdvancedFilter) =>
    get<SelfVsManagerResponse>('/comparison/self-vs-manager', p),
  getRankDelta: (p: AdvancedFilter) => get<RankDeltaResponse>('/ranking/rank-delta', p),
}
