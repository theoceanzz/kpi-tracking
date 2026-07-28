import axiosClient from '@/lib/axios'

// ── Types (khớp com.kpitracking.dto.response.stats.MatrixAnalyticsResponses) ──

export interface MatrixRatingBucket {
  rating: number
  count: number
}

export interface MatrixHeatmap {
  rowHeader: string
  colHeader: string
  rows: string[]          // dải điểm hành vi
  cols: string[]          // dải % hoàn thành
  ratings: number[][]     // ratings[row][col] = xếp loại (từ cấu hình org)
  counts: number[][]      // counts[row][col] = số nhân sự
}

export interface MatrixOverview {
  averageRating?: number | null
  averageBehavior?: number | null
  averageCompletion?: number | null
  evaluationCount: number
  distribution: MatrixRatingBucket[]
  heatmap?: MatrixHeatmap | null
}

export interface MatrixScopeParams {
  orgUnitId?: string
  periodId?: string
  periodIdTo?: string
}

// ── Client ──────────────────────────────────────────────────────────────
// Chỉ dùng "overview" (thẻ chỉ số + phân bố xếp loại + heatmap), nhúng trong tab Phân cấp.

export const matrixAnalyticsApi = {
  getOverview: async (params?: MatrixScopeParams) => {
    const res = await axiosClient.get<{ data: MatrixOverview }>('/stats/matrix/overview', { params })
    return res.data.data
  },
}
