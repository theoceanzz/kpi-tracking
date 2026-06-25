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
  from?: string
  to?: string
}

interface Options {
  className?: string
  selectClassName?: string
}

type LegacyMode = 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_QUARTER' | '6_MONTHS' | 'THIS_YEAR' | 'CUSTOM'
type PeriodMode = 'WHOLE_PERIOD' | 'BY_DAY' | 'BY_WEEK' | 'BY_MONTH' | 'BY_QUARTER' | 'CUSTOM'

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
 */
export function useAnalyticsDateFilter(opts: Options = {}): AnalyticsDateFilterValue & { controls: ReactNode } {
  const { className, selectClassName } = opts
  const user = useAuthStore(s => s.user)
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data } = useKpiPeriods({ organizationId, size: 1000, sortBy: 'startDate', direction: 'desc' })
  const periods = (data?.content ?? []) as KpiPeriod[]

  const [periodId, setPeriodId] = useState<string | undefined>(undefined)
  const [legacyMode, setLegacyMode] = useState<LegacyMode>('THIS_YEAR')
  const [periodMode, setPeriodMode] = useState<PeriodMode>('WHOLE_PERIOD')
  const [subIndex, setSubIndex] = useState(0)
  const [dayValue, setDayValue] = useState('')
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>({ from: '', to: '' })

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

  // Tính from/to
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

  const baseTrigger = cn(
    'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-violet-500/50 w-full sm:w-auto',
    selectClassName ?? 'h-10'
  )

  const controls = (
    <div className={cn('flex flex-col sm:flex-row items-stretch sm:items-center gap-3', className)}>
      <Select value={periodId ?? 'ALL'} onValueChange={v => handlePeriodChange(v === 'ALL' ? undefined : v)}>
        <SelectTrigger className={cn(baseTrigger, "md:w-[320px]")}>
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
          <SelectTrigger className={cn(baseTrigger, "md:w-[240px]")}>
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
          <SelectTrigger className={cn(baseTrigger, "md:w-[240px]")}>
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
    </div>
  )

  return { periodId: value.periodId, from: value.from, to: value.to, controls }
}
