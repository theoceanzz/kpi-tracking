/**
 * Bộ lọc thời gian dưới dạng DỮ LIỆU THUẦN.
 *
 * Trước đây toàn bộ trạng thái lọc nằm trong closure của `useAnalyticsDateFilter`, và hook đó trả
 * về sẵn JSX (`controls`). Hệ quả là không có cách nào nâng trạng thái ra ngoài, nên mọi biểu đồ
 * trên một trang buộc phải dùng chung một khoảng thời gian — muốn cho từng widget một bộ lọc riêng
 * thì phải gỡ chỗ này trước.
 *
 * Điểm mấu chốt: lưu Ý ĐỊNH lọc ({@link DateFilterIntent}) chứ không lưu khoảng đã tính
 * ({@link ResolvedDateFilter}). Hai ý định khác nhau có thể cho ra cùng một khoảng — "Quý 1, toàn
 * đợt" và "Quý 1, theo tháng, tháng thứ 2" chẳng hạn — nên nếu chỉ lưu khoảng thì lần sau mở bảng
 * cấu hình lên không dựng lại được các ô đang chọn.
 */
import {
  subDays, subMonths, startOfYear,
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter,
  eachWeekOfInterval, eachMonthOfInterval, eachQuarterOfInterval,
  format, parse,
} from 'date-fns'
import type { KpiFrequency, KpiPeriod, KpiCycle } from '@/types/kpi'

export type LegacyMode = 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_QUARTER' | '6_MONTHS' | 'THIS_YEAR' | 'CUSTOM'
export type PeriodMode = 'WHOLE_PERIOD' | 'BY_DAY' | 'BY_WEEK' | 'BY_MONTH' | 'BY_QUARTER' | 'CUSTOM'
export type FilterMode = 'SINGLE' | 'RANGE' | 'CYCLE'
export type GroupBy = 'TIME' | 'PERIOD'

/** Khoảng thời gian đã tính xong — thứ gửi lên API. */
export interface ResolvedDateFilter {
  periodId?: string
  periodIdTo?: string
  from?: string
  to?: string
  /** Kiểu chia cột biểu đồ xu hướng: 'TIME' (theo thời gian, mặc định) | 'PERIOD' (theo đợt). */
  groupBy?: GroupBy
}

/**
 * Người dùng đã CHỌN gì. Đây là thứ lưu xuống server cho từng widget.
 *
 * Mọi trường đều tuỳ chọn để một widget chỉ ghi đè phần nó quan tâm; phần bỏ trống lấy theo
 * {@link DEFAULT_DATE_INTENT}.
 */
export interface DateFilterIntent {
  mode?: FilterMode
  /** Chế độ SINGLE: đợt đang chọn. Bỏ trống = "Tất cả các đợt" (rơi về `legacyMode`). */
  periodId?: string
  legacyMode?: LegacyMode
  periodMode?: PeriodMode
  /** Chỉ số tuần/tháng/quý trong đợt, dùng cho BY_WEEK / BY_MONTH / BY_QUARTER. */
  subIndex?: number
  /** Ngày đang chọn ở BY_DAY, dạng yyyy-MM-dd. */
  dayValue?: string
  customFrom?: string
  customTo?: string
  rangeFromId?: string
  rangeToId?: string
  cycleIds?: string[]
  groupBy?: GroupBy
}

export const DEFAULT_DATE_INTENT: Required<
  Pick<DateFilterIntent, 'mode' | 'legacyMode' | 'periodMode' | 'subIndex' | 'groupBy'>
> = {
  mode: 'SINGLE',
  legacyMode: 'THIS_YEAR',
  periodMode: 'WHOLE_PERIOD',
  subIndex: 0,
  groupBy: 'TIME',
}

export const LEGACY_OPTIONS: { value: LegacyMode; label: string }[] = [
  { value: 'THIS_WEEK', label: 'Tuần này' },
  { value: 'THIS_MONTH', label: 'Tháng này' },
  { value: 'THIS_QUARTER', label: 'Quý này' },
  { value: '6_MONTHS', label: '6 tháng gần đây' },
  { value: 'THIS_YEAR', label: 'Năm nay' },
  { value: 'CUSTOM', label: 'Tùy chỉnh...' },
]

/** Các mức granularity khả dụng theo loại đợt (chưa gồm "Toàn đợt" và "Tùy chỉnh"). */
export const PERIOD_GRANULARITY: Record<KpiFrequency, PeriodMode[]> = {
  DAILY: [],
  WEEKLY: ['BY_DAY'],
  MONTHLY: ['BY_DAY', 'BY_WEEK'],
  QUARTERLY: ['BY_WEEK', 'BY_MONTH'],
  SEMI_ANNUALLY: ['BY_MONTH', 'BY_QUARTER'],
  YEARLY: ['BY_MONTH', 'BY_QUARTER'],
  UNLIMITED: ['BY_MONTH', 'BY_QUARTER'],
}

export const PERIOD_MODE_LABEL: Record<PeriodMode, string> = {
  WHOLE_PERIOD: 'Toàn đợt',
  BY_DAY: 'Theo ngày',
  BY_WEEK: 'Theo tuần',
  BY_MONTH: 'Theo tháng',
  BY_QUARTER: 'Theo quý',
  CUSTOM: 'Tùy chỉnh...',
}

export const clamp = (d: Date, lo: Date | null, hi: Date | null) => {
  let t = d.getTime()
  if (lo && t < lo.getTime()) t = lo.getTime()
  if (hi && t > hi.getTime()) t = hi.getTime()
  return new Date(t)
}

export const fmtInput = (d: Date) => format(d, 'yyyy-MM-dd')
export const parseInput = (s: string) => parse(s, 'yyyy-MM-dd', new Date())

/**
 * Các mốc tuần/tháng/quý nằm trong một đợt — dùng cho cả ô chọn lẫn phép tính khoảng.
 *
 * Nhận hai chuỗi ngày chứ không nhận cả đối tượng đợt: nơi gọi cần memo hoá theo giá trị nguyên
 * thuỷ, còn đối tượng đợt lấy từ `periods.find()` thì đổi định danh mỗi lần render.
 */
export function periodSubUnits(startDate?: string | null, endDate?: string | null) {
  const s = startDate
  const e = endDate
  if (!s || !e) return { weeks: [] as Date[], months: [] as Date[], quarters: [] as Date[] }
  const start = new Date(s)
  const end = new Date(e)
  return {
    weeks: eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }),
    months: eachMonthOfInterval({ start, end }),
    quarters: eachQuarterOfInterval({ start, end }),
  }
}

/** Các lựa chọn granularity hợp lệ cho đợt đang chọn; không chọn đợt nào thì không có gì. */
export function periodModeOptions(period?: KpiPeriod): PeriodMode[] {
  return period ? ['WHOLE_PERIOD', ...(PERIOD_GRANULARITY[period.periodType] ?? []), 'CUSTOM'] : []
}

/* ── Ba nhánh tính khoảng, tách rời để đọc được từng cái ────────────────────────── */

/** SINGLE: một đợt (kèm lát cắt con), hoặc không chọn đợt nào thì rơi về khoảng tương đối. */
function resolveSingle(intent: DateFilterIntent, periods: KpiPeriod[]): ResolvedDateFilter {
  const { periodId } = intent
  const legacyMode = intent.legacyMode ?? DEFAULT_DATE_INTENT.legacyMode
  const periodMode = intent.periodMode ?? DEFAULT_DATE_INTENT.periodMode
  const subIndex = intent.subIndex ?? DEFAULT_DATE_INTENT.subIndex
  const customFrom = intent.customFrom ?? ''
  const customTo = intent.customTo ?? ''

  const period = periodId ? periods.find(p => p.id === periodId) : undefined
  const pStartStr = period?.startDate ?? null
  const pEndStr = period?.endDate ?? null

  if (!pStartStr || !periodId) {
    const now = new Date()
    const to = endOfDay(now).toISOString()
    switch (legacyMode) {
      case 'THIS_WEEK': return { from: startOfDay(subDays(now, 7)).toISOString(), to }
      case 'THIS_MONTH': return { from: startOfDay(subDays(now, 30)).toISOString(), to }
      case 'THIS_QUARTER': return { from: startOfDay(subDays(now, 90)).toISOString(), to }
      case '6_MONTHS': return { from: startOfDay(subMonths(now, 6)).toISOString(), to }
      case 'THIS_YEAR': return { from: startOfYear(now).toISOString(), to }
      case 'CUSTOM':
        return {
          from: customFrom ? startOfDay(parseInput(customFrom)).toISOString() : undefined,
          to: customTo ? endOfDay(parseInput(customTo)).toISOString() : undefined,
        }
      default: return {}
    }
  }

  const lo = new Date(pStartStr)
  const hi = pEndStr ? new Date(pEndStr) : null
  // "Toàn đợt" cố ý KHÔNG trả from/to: backend tự suy khoảng từ `periodId`, và nó biết những thứ
  // mà chỗ này không biết. Điền hộ vào đây là âm thầm đổi số liệu của mọi biểu đồ.
  const base: ResolvedDateFilter = { periodId }
  const { weeks, months, quarters } = periodSubUnits(pStartStr, pEndStr)

  switch (periodMode) {
    case 'WHOLE_PERIOD':
      return base
    case 'BY_DAY': {
      const d = intent.dayValue ? parseInput(intent.dayValue) : lo
      return {
        ...base,
        from: clamp(startOfDay(d), lo, hi).toISOString(),
        to: clamp(endOfDay(d), lo, hi).toISOString(),
      }
    }
    case 'BY_WEEK': {
      const ws = weeks[Math.min(subIndex, Math.max(0, weeks.length - 1))]
      if (!ws) return base
      return {
        ...base,
        from: clamp(startOfWeek(ws, { weekStartsOn: 1 }), lo, hi).toISOString(),
        to: clamp(endOfWeek(ws, { weekStartsOn: 1 }), lo, hi).toISOString(),
      }
    }
    case 'BY_MONTH': {
      const ms = months[Math.min(subIndex, Math.max(0, months.length - 1))]
      if (!ms) return base
      return {
        ...base,
        from: clamp(startOfMonth(ms), lo, hi).toISOString(),
        to: clamp(endOfMonth(ms), lo, hi).toISOString(),
      }
    }
    case 'BY_QUARTER': {
      const qs = quarters[Math.min(subIndex, Math.max(0, quarters.length - 1))]
      if (!qs) return base
      return {
        ...base,
        from: clamp(startOfQuarter(qs), lo, hi).toISOString(),
        to: clamp(endOfQuarter(qs), lo, hi).toISOString(),
      }
    }
    case 'CUSTOM':
      return {
        ...base,
        from: customFrom ? clamp(startOfDay(parseInput(customFrom)), lo, hi).toISOString() : lo.toISOString(),
        to: customTo ? clamp(endOfDay(parseInput(customTo)), lo, hi).toISOString() : hi?.toISOString(),
      }
    default:
      return base
  }
}

/** RANGE: chuẩn hoá theo startDate; from = đầu biên nhỏ, to = cuối biên lớn. */
function resolveRange(intent: DateFilterIntent, periods: KpiPeriod[]): ResolvedDateFilter {
  const a = intent.rangeFromId ? periods.find(p => p.id === intent.rangeFromId) : undefined
  const b = intent.rangeToId ? periods.find(p => p.id === intent.rangeToId) : undefined
  if (!a && !b) return {}
  const x = a ?? b!
  const y = b ?? a!
  const [lo, hi] = x.startDate && y.startDate && new Date(x.startDate) <= new Date(y.startDate) ? [x, y] : [y, x]
  return {
    periodId: lo.id,
    periodIdTo: lo.id === hi.id ? undefined : hi.id,
    from: lo.startDate ? new Date(lo.startDate).toISOString() : undefined,
    to: hi.endDate ? new Date(hi.endDate).toISOString() : undefined,
  }
}

/** CYCLE: gom các đợt thuộc kỳ được chọn, quy về biên periodId/periodIdTo + span from/to. */
function resolveCycle(intent: DateFilterIntent, periods: KpiPeriod[], cycles: KpiCycle[]): ResolvedDateFilter {
  const ids = intent.cycleIds ?? []
  if (ids.length === 0) return {}
  const sel = new Set(ids)
  const selPeriods = periods
    .filter(p => p.cycleId && sel.has(p.cycleId) && p.startDate)
    .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime())
  const lo = selPeriods[0]
  const hi = selPeriods[selPeriods.length - 1]
  const selCycles = cycles.filter(c => sel.has(c.id))
  const fromMs = [
    ...selCycles.map(c => c.startDate).filter(Boolean).map(s => new Date(s!).getTime()),
    ...(lo?.startDate ? [new Date(lo.startDate).getTime()] : []),
  ]
  const toMs = [
    ...selCycles.map(c => c.endDate).filter(Boolean).map(s => new Date(s!).getTime()),
    ...(hi?.endDate ? [new Date(hi.endDate).getTime()] : []),
  ]
  return {
    periodId: lo?.id,
    periodIdTo: lo && hi && lo.id !== hi.id ? hi.id : undefined,
    from: fromMs.length ? new Date(Math.min(...fromMs)).toISOString() : undefined,
    to: toMs.length ? new Date(Math.max(...toMs)).toISOString() : undefined,
  }
}

/**
 * Ý định → khoảng thời gian gửi API. Hàm thuần: cùng đầu vào luôn cho cùng đầu ra, trừ các chế độ
 * tương đối ("Tuần này"…) vốn phải bám mốc hiện tại theo đúng định nghĩa của chúng.
 */
export function resolveDateFilter(
  intent: DateFilterIntent,
  periods: KpiPeriod[],
  cycles: KpiCycle[],
): ResolvedDateFilter {
  const mode = intent.mode ?? DEFAULT_DATE_INTENT.mode
  const active =
    mode === 'CYCLE' ? resolveCycle(intent, periods, cycles)
      : mode === 'RANGE' ? resolveRange(intent, periods)
        : resolveSingle(intent, periods)

  // Chọn đúng một đợt cụ thể thì "theo đợt" chỉ ra một cột, vô nghĩa — ép về mốc thời gian trong
  // đợt. Bỏ luật này là biểu đồ xu hướng bẹp thành một cột mà không ai hiểu vì sao.
  const selectedPeriod = intent.periodId ? periods.find(p => p.id === intent.periodId) : undefined
  const groupBy = mode === 'SINGLE' && selectedPeriod ? 'TIME' : intent.groupBy ?? DEFAULT_DATE_INTENT.groupBy

  return { ...active, groupBy }
}
