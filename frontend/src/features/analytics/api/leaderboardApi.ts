import axiosClient from '@/lib/axios'

/**
 * Ba ô mở đầu trang Thống kê — khớp `com.kpitracking.dto.response.stats.advanced.LeaderboardResponses`.
 *
 * <p>`cycleId` có mặt thì server xếp theo KỲ và BỎ QUA hẳn `periodId`/`periodIdTo` — cùng giao kèo
 * với bảng xếp loại đơn vị. Đó là hai phạm vi khác nhau chứ không phải hai cách viết của một
 * khoảng thời gian, nên gửi cả hai là mơ hồ.
 */

export interface LeaderboardFilter {
  orgUnitId?: string
  periodId?: string
  periodIdTo?: string
  cycleId?: string
  limit?: number
  /** Cột xếp: người = kpi | conduct; đơn vị = bsc | kpi | kpiCount | conduct. */
  sortBy?: string
  /** `desc` = cao nhất (mặc định), `asc` = thấp nhất. */
  sortDir?: string
}

export interface PersonRow {
  /** null khi server đã ẩn danh (cấp SELF, người khác). */
  userId?: string | null
  fullName?: string | null
  orgUnitName?: string | null
  /** Hiệu suất KPI đã được đánh giá trong đợt/kỳ, đơn vị %. */
  kpiPercent?: number | null
  conductScore?: number | null
  conductMax?: number | null
  ratingName?: string | null
  ratingColor?: string | null
  isSelf?: boolean
}

export interface PeopleLeaderboard {
  rows: PersonRow[]
  /** true → tên người khác đã bị gỡ TỪ SERVER, không phải chỉ ẩn ở giao diện. */
  anonymized?: boolean
  conductMax?: number | null
  conductEnabled?: boolean
}

export interface UnitRow {
  orgUnitId?: string | null
  orgUnitName?: string | null
  bscPercent?: number | null
  avgKpiPercent?: number | null
  kpiCount?: number | null
  conductScore?: number | null
  conductMax?: number | null
}

export interface UnitLeaderboard {
  rows: UnitRow[]
  conductMax?: number | null
  conductEnabled?: boolean
  bscEnabled?: boolean
}

export interface HeatmapPeriod {
  id: string
  name?: string | null
}

export interface HeatmapUnitRow {
  orgUnitId?: string | null
  name?: string | null
  /** Độ sâu so với đơn vị gốc của phạm vi — thụt lề tên cho ra hình cây. */
  depth?: number | null
  /** Cùng thứ tự với `periods`; null = đợt đó chưa có số. */
  cells: (number | null)[]
}

export interface UnitPeriodHeatmap {
  periods: HeatmapPeriod[]
  units: HeatmapUnitRow[]
  /** `BSC` hay `EVALUATION` — ô đang tô màu theo cái gì. */
  source?: string | null
}

const BASE = '/stats/advanced'

async function get<T>(path: string, params: LeaderboardFilter): Promise<T> {
  const res = await axiosClient.get(`${BASE}${path}`, { params })
  return res.data.data
}

export const leaderboardApi = {
  getPeople: (p: LeaderboardFilter) => get<PeopleLeaderboard>('/leaderboard/people', p),
  getUnits: (p: LeaderboardFilter) => get<UnitLeaderboard>('/leaderboard/units', p),
  getUnitPeriodHeatmap: (p: LeaderboardFilter) => get<UnitPeriodHeatmap>('/heatmap/unit-period', p),
}
