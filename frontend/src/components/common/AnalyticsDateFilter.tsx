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
import { ChevronDown, ChevronUp, History, Search } from 'lucide-react'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useKpiCycles } from '@/features/kpi/hooks/useKpiCycles'
import ScopeSelectItems from './ScopeSelectItems'
import { pickCurrentOrNearest, splitByTime } from './dateScope'
import { useAuthStore } from '@/store/authStore'
import type { KpiFrequency, KpiPeriod, KpiCycle } from '@/types/kpi'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
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
type FilterMode = 'SINGLE' | 'RANGE' | 'CYCLE'

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
  const { data: cyclesData } = useKpiCycles({ organizationId, size: 1000, sortBy: 'startDate', direction: 'desc' })
  const cycles = (cyclesData?.content ?? []) as KpiCycle[]

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

  // Chế độ "Theo kỳ" (chọn 1 hoặc nhiều kỳ)
  const [selectedCycleIds, setSelectedCycleIds] = useState<string[]>([])

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

  // Chuyển chế độ; khi vào "Khoảng đợt" lần đầu, mặc định chọn đợt đang chạy (giữa hai
  // đợt thì vẫn là đợt vừa kết thúc) cho cả hai biên.
  const switchMode = (m: FilterMode) => {
    setMode(m)
    const current = pickCurrentOrNearest(periods)
    if (m === 'RANGE' && !rangeFromId && !rangeToId && current) {
      setRangeFromId(current.id)
      setRangeToId(current.id)
    }
    const currentCycle = pickCurrentOrNearest(cycles)
    if (m === 'CYCLE' && selectedCycleIds.length === 0 && currentCycle) {
      setSelectedCycleIds([currentCycle.id])
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

  // Giá trị "Theo kỳ": gom các đợt thuộc kỳ được chọn → quy về periodId/periodIdTo (biên) + from/to (span).
  const cycleValue: AnalyticsDateFilterValue = useMemo(() => {
    if (selectedCycleIds.length === 0) return {}
    const sel = new Set(selectedCycleIds)
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
  }, [periods, cycles, selectedCycleIds])

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

  const active = mode === 'CYCLE' ? cycleValue : mode === 'RANGE' ? rangeValue : value

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
        {modeBtn('CYCLE', 'Theo kỳ')}
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
      ) : mode === 'RANGE' ? (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Select value={rangeFromId} onValueChange={handleRangeFrom}>
            <SelectTrigger className={cn(baseTrigger, "md:w-[240px]")}>
              <SelectValue placeholder="Từ đợt..." />
            </SelectTrigger>
            <SelectContent className="w-[var(--radix-select-trigger-width)]">
              <ScopeSelectItems items={periods} selectedId={rangeFromId} />
            </SelectContent>
          </Select>
          <span className="hidden sm:inline text-slate-400 self-center">→</span>
          <Select value={rangeToId} onValueChange={v => setRangeToId(v)}>
            <SelectTrigger className={cn(baseTrigger, "md:w-[240px]")}>
              <SelectValue placeholder="Đến đợt..." />
            </SelectTrigger>
            <SelectContent className="w-[var(--radix-select-trigger-width)]">
              <ScopeSelectItems items={toOptions} selectedId={rangeToId} />
            </SelectContent>
          </Select>
        </div>
      ) : (
        <CyclePicker
          cycles={cycles}
          selected={selectedCycleIds}
          onChange={setSelectedCycleIds}
          triggerClass={cn(baseTrigger, 'md:w-[300px]')}
        />
      )}

      {/* Kiểu chia cột biểu đồ xu hướng — chỉ ý nghĩa khi có NHIỀU đợt (tất cả đợt / khoảng đợt).
          Khi chọn đúng 1 đợt cụ thể thì "Theo đợt" = 1 cột (vô nghĩa) nên ẩn đi. */}
      {(mode === 'RANGE' || mode === 'CYCLE' || !selectedPeriod) && (
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

/** Chọn 1 hoặc NHIỀU kỳ (multi-select) — popover có ô tìm + danh sách checkbox. */
function CyclePicker({
  cycles, selected, onChange, triggerClass,
}: {
  cycles: KpiCycle[]
  selected: string[]
  onChange: (ids: string[]) => void
  triggerClass?: string
}) {
  const [open, setOpen] = useState(false)
  const [showPast, setShowPast] = useState(false)
  const [q, setQ] = useState('')
  const { upcoming, past } = useMemo(() => splitByTime(cycles), [cycles])

  // Mặc định chỉ liệt kê kỳ đang chạy và kỳ tương lai; kỳ đã qua nằm sau nút bung ra.
  // Kỳ đã qua mà đang được chọn thì vẫn hiện, không thì người dùng không bỏ chọn được nó.
  // Đang gõ tìm kiếm thì bỏ qua luật này — gõ tên ra là đang cố tìm một kỳ cụ thể.
  const searching = q.trim().length > 0
  const visible = searching || showPast
    ? [...upcoming, ...past]
    : [...upcoming, ...past.filter(c => selected.includes(c.id))]
  const hiddenPastCount = searching || showPast ? 0 : past.filter(c => !selected.includes(c.id)).length

  const shown = searching ? visible.filter(c => c.name.toLowerCase().includes(q.trim().toLowerCase())) : visible
  const selNames = cycles.filter(c => selected.includes(c.id)).map(c => c.name)
  const label = selNames.length === 0 ? 'Chọn kỳ...' : selNames.length === 1 ? selNames[0]! : `${selNames.length} kỳ đã chọn`
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn(triggerClass, 'flex items-center justify-between gap-2 px-3')}>
          <span className="truncate">{label}</span>
          <ChevronDown size={14} className="opacity-60 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] p-0">
        {cycles.length > 6 && (
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Tìm kỳ…"
                className="w-full h-8 pl-8 pr-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs border-none outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>
        )}
        <div className="max-h-64 overflow-auto p-1.5">
          {shown.length ? shown.map(c => (
            <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer">
              <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
              <span className="truncate text-[13px] font-bold text-slate-700 dark:text-slate-200">{c.name}</span>
            </label>
          )) : hiddenPastCount === 0 && (
            <p className="text-[11px] italic text-slate-400 p-2">Không có kỳ nào.</p>
          )}

          {hiddenPastCount > 0 && (
            <button
              type="button"
              onClick={() => setShowPast(true)}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
            >
              <History size={13} /> Xem {hiddenPastCount} kỳ đã qua
            </button>
          )}
          {showPast && !searching && past.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPast(false)}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
            >
              <ChevronUp size={13} /> Ẩn kỳ đã qua
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
