import { useMemo, useState, type ReactNode } from 'react'
import {
  subDays, subMonths, startOfYear,
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter,
  eachWeekOfInterval, eachMonthOfInterval, eachQuarterOfInterval,
  getQuarter, format, parse,
} from 'date-fns'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useAuthStore } from '@/store/authStore'
import type { KpiFrequency, KpiPeriod } from '@/types/kpi'
import { cn } from '@/lib/utils'

export interface AnalyticsDateFilterValue {
  periodId?: string
  periodIdTo?: string
  from?: string
  to?: string
  /** Kiểu chia cột biểu đồ xu hướng: 'TIME' (theo thời gian, mặc định) | 'PERIOD' (theo đợt). */
  groupBy?: 'TIME' | 'PERIOD'
}

interface Options {
  className?: string
  selectClassName?: string
}

type LegacyMode = 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_QUARTER' | '6_MONTHS' | 'THIS_YEAR' | 'CUSTOM'
type PeriodMode = 'WHOLE_PERIOD' | 'BY_DAY' | 'BY_WEEK' | 'BY_MONTH' | 'BY_QUARTER' | 'CUSTOM'
type FilterMode = 'SINGLE' | 'RANGE'

const LEGACY_OPTIONS: { value: LegacyMode; label: string }[] = [
  { value: 'THIS_WEEK', label: 'Tuần này' },
  { value: 'THIS_MONTH', label: 'Tháng này' },
  { value: 'THIS_QUARTER', label: 'Quý này' },
  { value: '6_MONTHS', label: '6 tháng gần đây' },
  { value: 'THIS_YEAR', label: 'Năm nay' },
  { value: 'CUSTOM', label: 'Tùy chỉnh...' },
]

// Các mức granularity khả dụng theo loại đợt (chưa gồm "Toàn đợt" và "Tùy chỉnh").
const PERIOD_GRANULARITY: Record<KpiFrequency, PeriodMode[]> = {
  DAILY: [],
  WEEKLY: ['BY_DAY'],
  MONTHLY: ['BY_DAY', 'BY_WEEK'],
  QUARTERLY: ['BY_WEEK', 'BY_MONTH'],
  SEMI_ANNUALLY: ['BY_MONTH', 'BY_QUARTER'],
  YEARLY: ['BY_MONTH', 'BY_QUARTER'],
  UNLIMITED: ['BY_MONTH', 'BY_QUARTER'],
}

const PERIOD_MODE_LABEL: Record<PeriodMode, string> = {
  WHOLE_PERIOD: 'Toàn đợt',
  BY_DAY: 'Theo ngày',
  BY_WEEK: 'Theo tuần',
  BY_MONTH: 'Theo tháng',
  BY_QUARTER: 'Theo quý',
  CUSTOM: 'Tùy chỉnh...',
}

const clamp = (d: Date, lo: Date | null, hi: Date | null) => {
  let t = d.getTime()
  if (lo && t < lo.getTime()) t = lo.getTime()
  if (hi && t > hi.getTime()) t = hi.getTime()
  return new Date(t)
}

const fmtInput = (d: Date) => format(d, 'yyyy-MM-dd')
const parseInput = (s: string) => parse(s, 'yyyy-MM-dd', new Date())

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * Hook bộ lọc thời gian dùng chung cho các trang thống kê.
 * Hai chế độ: "Một đợt" (kèm lọc con theo ngày/tuần/tháng) và "Khoảng đợt" (Từ đợt → Đến đợt, toàn span).
 */
export function useAnalyticsDateFilter(opts: Options = {}): AnalyticsDateFilterValue & { controls: ReactNode } {
  const { className, selectClassName } = opts
  const user = useAuthStore(s => s.user)
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data } = useKpiPeriods({ organizationId, size: 1000, sortBy: 'startDate', direction: 'desc' })
  const periods = (data?.content ?? []) as KpiPeriod[]

  const [mode, setMode] = useState<FilterMode>('SINGLE')
  const [groupBy, setGroupBy] = useState<'TIME' | 'PERIOD'>('TIME')
  const [periodId, setPeriodId] = useState<string | undefined>(undefined)
  const [legacyMode, setLegacyMode] = useState<LegacyMode>('THIS_YEAR')
  const [periodMode, setPeriodMode] = useState<PeriodMode>('WHOLE_PERIOD')
  const [subIndex, setSubIndex] = useState(0)
  const [dayValue, setDayValue] = useState('')
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>({ from: '', to: '' })

  // Chế độ "Khoảng đợt"
  const [rangeFromId, setRangeFromId] = useState<string | undefined>(undefined)
  const [rangeToId, setRangeToId] = useState<string | undefined>(undefined)

  const selectedPeriod = periodId ? periods.find(p => p.id === periodId) : undefined
  const pStartStr = selectedPeriod?.startDate ?? null
  const pEndStr = selectedPeriod?.endDate ?? null
  const periodStart = pStartStr ? new Date(pStartStr) : null
  const periodEnd = pEndStr ? new Date(pEndStr) : null

  // Danh sách sub-unit trong đợt
  const weeks = useMemo(
    () => (pStartStr && pEndStr ? eachWeekOfInterval({ start: new Date(pStartStr), end: new Date(pEndStr) }, { weekStartsOn: 1 }) : []),
    [pStartStr, pEndStr]
  )
  const months = useMemo(
    () => (pStartStr && pEndStr ? eachMonthOfInterval({ start: new Date(pStartStr), end: new Date(pEndStr) }) : []),
    [pStartStr, pEndStr]
  )
  const quarters = useMemo(
    () => (pStartStr && pEndStr ? eachQuarterOfInterval({ start: new Date(pStartStr), end: new Date(pEndStr) }) : []),
    [pStartStr, pEndStr]
  )

  // Đổi đợt → reset về "Toàn đợt"
  const handlePeriodChange = (id: string | undefined) => {
    setPeriodId(id)
    setPeriodMode('WHOLE_PERIOD')
    setSubIndex(0)
    setDayValue('')
    setCustomRange({ from: '', to: '' })
  }

  const periodModeOptions: PeriodMode[] = selectedPeriod
    ? ['WHOLE_PERIOD', ...(PERIOD_GRANULARITY[selectedPeriod.periodType] ?? []), 'CUSTOM']
    : []

  // Chuyển chế độ; khi vào "Khoảng đợt" lần đầu, mặc định chọn đợt mới nhất cho cả hai biên.
  const switchMode = (m: FilterMode) => {
    setMode(m)
    const newest = periods[0]
    if (m === 'RANGE' && !rangeFromId && !rangeToId && newest) {
      setRangeFromId(newest.id)
      setRangeToId(newest.id)
    }
  }

  // Đổi "Từ đợt": nếu "Đến đợt" đang trước → kéo "Đến" về bằng "Từ".
  const handleRangeFrom = (id: string) => {
    setRangeFromId(id)
    const f = periods.find(p => p.id === id)
    const t = rangeToId ? periods.find(p => p.id === rangeToId) : undefined
    if (f?.startDate && t?.startDate && new Date(t.startDate) < new Date(f.startDate)) setRangeToId(id)
  }

  // "Đến đợt" chỉ cho chọn đợt có startDate ≥ "Từ đợt".
  const rangeFromPeriod = rangeFromId ? periods.find(p => p.id === rangeFromId) : undefined
  const toOptions = useMemo(() => {
    if (!rangeFromPeriod?.startDate) return periods
    const lo = new Date(rangeFromPeriod.startDate).getTime()
    return periods.filter(p => p.startDate && new Date(p.startDate).getTime() >= lo)
  }, [periods, rangeFromPeriod])

  // Giá trị "Khoảng đợt": chuẩn hoá theo startDate; from = start biên nhỏ, to = end biên lớn.
  const rangeValue: AnalyticsDateFilterValue = useMemo(() => {
    const a = rangeFromId ? periods.find(p => p.id === rangeFromId) : undefined
    const b = rangeToId ? periods.find(p => p.id === rangeToId) : undefined
    if (!a && !b) return {}
    const x = a ?? b!
    const y = b ?? a!
    const [lo, hi] = (x.startDate && y.startDate && new Date(x.startDate) <= new Date(y.startDate)) ? [x, y] : [y, x]
    return {
      periodId: lo.id,
      periodIdTo: lo.id === hi.id ? undefined : hi.id,
      from: lo.startDate ? new Date(lo.startDate).toISOString() : undefined,
      to: hi.endDate ? new Date(hi.endDate).toISOString() : undefined,
    }
  }, [periods, rangeFromId, rangeToId])

  // Tính from/to cho chế độ "Một đợt"
  const value: AnalyticsDateFilterValue = useMemo(() => {
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
            from: customRange.from ? startOfDay(parseInput(customRange.from)).toISOString() : undefined,
            to: customRange.to ? endOfDay(parseInput(customRange.to)).toISOString() : undefined,
          }
        default: return {}
      }
    }

    const lo = new Date(pStartStr)
    const hi = pEndStr ? new Date(pEndStr) : null
    const base: AnalyticsDateFilterValue = { periodId }
    switch (periodMode) {
      case 'WHOLE_PERIOD': return base
      case 'BY_DAY': {
        const d = dayValue ? parseInput(dayValue) : lo
        return { ...base, from: clamp(startOfDay(d), lo, hi).toISOString(), to: clamp(endOfDay(d), lo, hi).toISOString() }
      }
      case 'BY_WEEK': {
        const ws = weeks[Math.min(subIndex, Math.max(0, weeks.length - 1))]
        if (!ws) return base
        return { ...base, from: clamp(startOfWeek(ws, { weekStartsOn: 1 }), lo, hi).toISOString(), to: clamp(endOfWeek(ws, { weekStartsOn: 1 }), lo, hi).toISOString() }
      }
      case 'BY_MONTH': {
        const ms = months[Math.min(subIndex, Math.max(0, months.length - 1))]
        if (!ms) return base
        return { ...base, from: clamp(startOfMonth(ms), lo, hi).toISOString(), to: clamp(endOfMonth(ms), lo, hi).toISOString() }
      }
      case 'BY_QUARTER': {
        const qs = quarters[Math.min(subIndex, Math.max(0, quarters.length - 1))]
        if (!qs) return base
        return { ...base, from: clamp(startOfQuarter(qs), lo, hi).toISOString(), to: clamp(endOfQuarter(qs), lo, hi).toISOString() }
      }
      case 'CUSTOM':
        return {
          ...base,
          from: customRange.from ? clamp(startOfDay(parseInput(customRange.from)), lo, hi).toISOString() : lo.toISOString(),
          to: customRange.to ? clamp(endOfDay(parseInput(customRange.to)), lo, hi).toISOString() : (hi?.toISOString()),
        }
      default: return base
    }
  }, [periodId, pStartStr, pEndStr, legacyMode, periodMode, subIndex, dayValue, customRange, weeks, months, quarters])

  const active = mode === 'RANGE' ? rangeValue : value

  const baseTrigger = cn(
    'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-violet-500/50 w-full sm:w-auto',
    selectClassName ?? 'h-10'
  )

  const modeBtn = (m: FilterMode, label: string) => (
    <button
      type="button"
      onClick={() => switchMode(m)}
      className={cn(
        'px-3 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap',
        mode === m
          ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-300 shadow-sm'
          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
      )}
    >
      {label}
    </button>
  )

  const controls = (
    <div className={cn('flex flex-col sm:flex-row items-stretch sm:items-center gap-3', className)}>
      {/* Toggle chế độ */}
      <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 gap-0.5 shrink-0 self-start sm:self-auto">
        {modeBtn('SINGLE', 'Một đợt')}
        {modeBtn('RANGE', 'Khoảng đợt')}
      </div>

      {mode === 'SINGLE' ? (
        <>
          <Select value={periodId ?? 'ALL'} onValueChange={v => handlePeriodChange(v === 'ALL' ? undefined : v)}>
            <SelectTrigger className={cn(baseTrigger, "md:w-[300px]")}>
              <SelectValue placeholder="Tất cả các đợt" />
            </SelectTrigger>
            <SelectContent className="w-[var(--radix-select-trigger-width)]">
              <SelectItem value="ALL">Tất cả các đợt</SelectItem>
              {periods.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedPeriod ? (
            <Select value={periodMode} onValueChange={v => { setPeriodMode(v as PeriodMode); setSubIndex(0) }}>
              <SelectTrigger className={cn(baseTrigger, "md:w-[220px]")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-[var(--radix-select-trigger-width)]">
                {periodModeOptions.map(m => (
                  <SelectItem key={m} value={m}>{PERIOD_MODE_LABEL[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={legacyMode} onValueChange={v => setLegacyMode(v as LegacyMode)}>
              <SelectTrigger className={cn(baseTrigger, "md:w-[220px]")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-[var(--radix-select-trigger-width)]">
                {LEGACY_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {selectedPeriod && periodMode === 'BY_DAY' && (
            <input
              type="date"
              className={baseTrigger}
              min={periodStart ? fmtInput(periodStart) : undefined}
              max={periodEnd ? fmtInput(periodEnd) : undefined}
              value={dayValue || (periodStart ? fmtInput(periodStart) : '')}
              onChange={e => setDayValue(e.target.value)}
            />
          )}

          {selectedPeriod && periodMode === 'BY_WEEK' && (
            <Select value={subIndex.toString()} onValueChange={v => setSubIndex(Number(v))}>
              <SelectTrigger className={baseTrigger}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-[var(--radix-select-trigger-width)]">
                {weeks.map((ws, i) => {
                  const f = clamp(startOfWeek(ws, { weekStartsOn: 1 }), periodStart, periodEnd)
                  const t = clamp(endOfWeek(ws, { weekStartsOn: 1 }), periodStart, periodEnd)
                  return <SelectItem key={i} value={i.toString()}>{`Tuần ${i + 1} (${format(f, 'dd/MM')} – ${format(t, 'dd/MM')})`}</SelectItem>
                })}
              </SelectContent>
            </Select>
          )}

          {selectedPeriod && periodMode === 'BY_MONTH' && (
            <Select value={subIndex.toString()} onValueChange={v => setSubIndex(Number(v))}>
              <SelectTrigger className={baseTrigger}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-[var(--radix-select-trigger-width)]">
                {months.map((ms, i) => (
                  <SelectItem key={i} value={i.toString()}>{`Tháng ${format(ms, 'MM/yyyy')}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {selectedPeriod && periodMode === 'BY_QUARTER' && (
            <Select value={subIndex.toString()} onValueChange={v => setSubIndex(Number(v))}>
              <SelectTrigger className={baseTrigger}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-[var(--radix-select-trigger-width)]">
                {quarters.map((qs, i) => (
                  <SelectItem key={i} value={i.toString()}>{`Quý ${getQuarter(qs)}/${format(qs, 'yyyy')}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {((selectedPeriod && periodMode === 'CUSTOM') || (!selectedPeriod && legacyMode === 'CUSTOM')) && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="date"
                className={baseTrigger}
                min={periodStart ? fmtInput(periodStart) : undefined}
                max={periodEnd ? fmtInput(periodEnd) : undefined}
                value={customRange.from}
                onChange={e => setCustomRange(prev => ({ ...prev, from: e.target.value }))}
              />
              <span className="hidden sm:inline text-slate-400">-</span>
              <input
                type="date"
                className={baseTrigger}
                min={periodStart ? fmtInput(periodStart) : undefined}
                max={periodEnd ? fmtInput(periodEnd) : undefined}
                value={customRange.to}
                onChange={e => setCustomRange(prev => ({ ...prev, to: e.target.value }))}
              />
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Select value={rangeFromId} onValueChange={handleRangeFrom}>
            <SelectTrigger className={cn(baseTrigger, "md:w-[240px]")}>
              <SelectValue placeholder="Từ đợt..." />
            </SelectTrigger>
            <SelectContent className="w-[var(--radix-select-trigger-width)]">
              {periods.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="hidden sm:inline text-slate-400 self-center">→</span>
          <Select value={rangeToId} onValueChange={v => setRangeToId(v)}>
            <SelectTrigger className={cn(baseTrigger, "md:w-[240px]")}>
              <SelectValue placeholder="Đến đợt..." />
            </SelectTrigger>
            <SelectContent className="w-[var(--radix-select-trigger-width)]">
              {toOptions.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Kiểu chia cột biểu đồ xu hướng — chỉ ý nghĩa khi có NHIỀU đợt (tất cả đợt / khoảng đợt).
          Khi chọn đúng 1 đợt cụ thể thì "Theo đợt" = 1 cột (vô nghĩa) nên ẩn đi. */}
      {(mode === 'RANGE' || !selectedPeriod) && (
        <Select value={groupBy} onValueChange={v => setGroupBy(v as 'TIME' | 'PERIOD')}>
          <SelectTrigger className={cn(baseTrigger, "md:w-[200px]")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="w-[var(--radix-select-trigger-width)]">
            <SelectItem value="TIME">Hiển thị: Theo thời gian</SelectItem>
            <SelectItem value="PERIOD">Hiển thị: Theo đợt</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  )

  // Khi chọn 1 đợt cụ thể → ép TIME (chia theo mốc thời gian trong đợt) vì "theo đợt" chỉ ra 1 cột.
  const effectiveGroupBy = (mode === 'SINGLE' && selectedPeriod) ? 'TIME' : groupBy

  return { periodId: active.periodId, periodIdTo: active.periodIdTo, from: active.from, to: active.to, groupBy: effectiveGroupBy, controls }
}
