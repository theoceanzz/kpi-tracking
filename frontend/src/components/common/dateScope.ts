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

/** Đang chạy theo đúng nghĩa đen: "bây giờ" nằm trong [start, end]; thiếu biên nào thì biên đó bỏ ngỏ. */
function isRunning(x: DatedScope, nowMs: number): boolean {
  const start = ms(x.startDate)
  const end = ms(x.endDate)
  if (start == null && end == null) return false
  return (start == null || nowMs >= start) && (end == null || nowMs <= end)
}

/** Đã kết thúc trước thời điểm hiện tại. Thứ không có ngày kết thúc thì không tính là đã qua. */
export function isPastScope(x: DatedScope, now: Date = new Date()): boolean {
  const end = ms(x.endDate)
  return end != null && now.getTime() > end
}

/**
 * Mục đang được coi là "hiện tại":
 *
 * 1. Mục đang chạy (hoà nhau thì lấy mục bắt đầu sớm hơn — đợt tháng bao ngoài đợt tuần).
 * 2. Không có mục nào đang chạy thì Ở LẠI mục vừa bắt đầu gần đây nhất, tức mục mới kết
 *    thúc. Đợt tuần chạy thứ 2 → chiều thứ 7, nhưng tối thứ 7 và Chủ nhật vẫn thuộc về
 *    đợt đó: người duyệt còn đang chấm nó. Đợt sau chỉ lên khi nó thật sự bắt đầu (thứ 2
 *    tuần kế), chứ không phải cứ hết giờ đợt trước là nhảy sang.
 * 3. Chưa mục nào bắt đầu (tổ chức mới lập, mọi đợt đều ở tương lai) → mục sắp tới sớm nhất.
 */
export function pickCurrentOrNearest<T extends DatedScope>(
  items: T[] | undefined,
  now: Date = new Date()
): T | undefined {
  if (!items?.length) return undefined
  const nowMs = now.getTime()

  const running = items.filter(x => isRunning(x, nowMs))
  if (running.length) {
    return running.reduce((best, x) =>
      (ms(x.startDate) ?? Number.POSITIVE_INFINITY) < (ms(best.startDate) ?? Number.POSITIVE_INFINITY) ? x : best
    )
  }

  const started = items.filter(x => {
    const start = ms(x.startDate)
    return start != null && start <= nowMs
  })
  if (started.length) {
    return started.reduce((best, x) => {
      const a = ms(x.startDate)!
      const b = ms(best.startDate)!
      if (a !== b) return a > b ? x : best
      return (ms(x.endDate) ?? 0) > (ms(best.endDate) ?? 0) ? x : best
    })
  }

  const upcoming = items.filter(x => ms(x.startDate) != null)
  if (upcoming.length) {
    return upcoming.reduce((best, x) => (ms(x.startDate)! < ms(best.startDate)! ? x : best))
  }

  return items[0]
}

/**
 * Tách danh sách thành phần "từ hiện tại trở đi" (sắp xếp gần → xa) và phần "đã qua"
 * (mới kết thúc → cũ nhất).
 *
 * Mục đang là "hiện tại" theo {@link pickCurrentOrNearest} luôn nằm ở nhóm đầu kể cả khi
 * endDate của nó đã trôi qua — nếu không, đợt được chọn sẵn lại bị xếp vào "đã qua" và
 * người dùng tưởng mình đang xem dữ liệu cũ.
 */
export function splitByTime<T extends DatedScope>(
  items: T[] | undefined,
  now: Date = new Date()
): { upcoming: T[]; past: T[] } {
  const list = items ?? []
  const currentId = pickCurrentOrNearest(list, now)?.id
  const isPast = (x: T) => x.id !== currentId && isPastScope(x, now)
  const asc = (a: T, b: T) => (ms(a.startDate) ?? Number.POSITIVE_INFINITY) - (ms(b.startDate) ?? Number.POSITIVE_INFINITY)
  return {
    upcoming: list.filter(x => !isPast(x)).sort(asc),
    past: list.filter(isPast).sort((a, b) => -asc(a, b)),
  }
}
