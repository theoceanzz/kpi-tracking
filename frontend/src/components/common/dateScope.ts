/**
 * Phân loại "phạm vi thời gian" theo mốc hiện tại — dùng chung cho các bộ lọc Đợt
 * (KpiPeriod) và Kỳ (KpiCycle). Hai thứ này khác nhau về ý nghĩa nhưng giống hệt nhau
 * về hình dạng (có ngày bắt đầu / ngày kết thúc) nên dùng chung một bộ quy tắc.
 */

/** Đủ dùng cho KpiPeriod, KpiCycle và mọi thứ có mốc bắt đầu/kết thúc. */
export interface DatedScope {
  id: string
  name: string
  startDate?: string | null
  endDate?: string | null
}

const ms = (s?: string | null) => (s ? new Date(s).getTime() : null)

/**
 * Khoảng cách (ms) từ "bây giờ" tới một phạm vi: 0 nếu đang ở trong, còn lại là số ms
 * phải chờ (chưa tới) hoặc đã trôi qua (đã kết thúc).
 */
function distanceToNow(x: DatedScope, nowMs: number): number {
  const start = ms(x.startDate)
  const end = ms(x.endDate)
  if (start == null && end == null) return Number.POSITIVE_INFINITY
  if (start != null && nowMs < start) return start - nowMs
  if (end != null && nowMs > end) return nowMs - end
  return 0
}

/** Đã kết thúc trước thời điểm hiện tại. Thứ không có ngày kết thúc thì không tính là đã qua. */
export function isPastScope(x: DatedScope, now: Date = new Date()): boolean {
  const end = ms(x.endDate)
  return end != null && now.getTime() > end
}

/**
 * Mục khớp thời điểm hiện tại; nếu không mục nào đang chạy thì lấy mục gần hiện tại
 * nhất (ưu tiên khoảng cách nhỏ hơn, hoà nhau thì lấy mục bắt đầu sớm hơn).
 */
export function pickCurrentOrNearest<T extends DatedScope>(
  items: T[] | undefined,
  now: Date = new Date()
): T | undefined {
  if (!items?.length) return undefined
  const nowMs = now.getTime()
  return items.reduce((best, x) => {
    const d = distanceToNow(x, nowMs)
    const bestD = distanceToNow(best, nowMs)
    if (d !== bestD) return d < bestD ? x : best
    const a = ms(x.startDate) ?? Number.POSITIVE_INFINITY
    const b = ms(best.startDate) ?? Number.POSITIVE_INFINITY
    return a < b ? x : best
  })
}

/**
 * Tách danh sách thành phần "từ hiện tại trở đi" (sắp xếp gần → xa) và phần "đã qua"
 * (mới kết thúc → cũ nhất).
 */
export function splitByTime<T extends DatedScope>(
  items: T[] | undefined,
  now: Date = new Date()
): { upcoming: T[]; past: T[] } {
  const list = items ?? []
  const asc = (a: T, b: T) => (ms(a.startDate) ?? Number.POSITIVE_INFINITY) - (ms(b.startDate) ?? Number.POSITIVE_INFINITY)
  return {
    upcoming: list.filter(x => !isPastScope(x, now)).sort(asc),
    past: list.filter(x => isPastScope(x, now)).sort((a, b) => -asc(a, b)),
  }
}
