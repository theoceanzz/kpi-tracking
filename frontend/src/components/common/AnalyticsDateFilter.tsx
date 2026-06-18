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

/**
 * Hook bộ lọc thời gian dùng chung cho các trang thống kê.
 *
 * State sống trong component gọi hook (tab) nên KHÔNG bị mất khi tab render skeleton
 * lúc loading. `from`/`to` là **giá trị dẫn xuất** (không dùng onChange/effect ngược về
 * cha) nên không gây vòng lặp gọi API. Preset được chuẩn hoá theo ngày để ổn định.
 *
 * - Chưa chọn đợt: dropdown preset cũ (Tuần này / Tháng này / ...).
 * - Đã chọn đợt: options phụ thuộc loại đợt (periodType) + bộ chọn phụ để thu hẹp
 *   vào một ngày/tuần/tháng/quý cụ thể bên trong đợt.
 *
 * Trả về `{ periodId, from, to, controls }` — `controls` là JSX để render trực tiếp.
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

  // Tính from/to (chuẩn hoá theo ngày để ổn định giữa các lần render)
  const value: AnalyticsDateFilterValue = useMemo(() => {
    // Chưa chọn đợt → preset cũ
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

    // Đã chọn đợt
    const lo = new Date(pStartStr)
    const hi = pEndStr ? new Date(pEndStr) : null
    const base: AnalyticsDateFilterValue = { periodId }
    switch (periodMode) {
      case 'WHOLE_PERIOD':
        return base // backend dùng biên đợt
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
      default:
        return base
    }
  }, [periodId, pStartStr, pEndStr, legacyMode, periodMode, subIndex, dayValue, customRange, weeks, months, quarters])

  const baseSelect = cn(
    'px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-violet-500/50',
    selectClassName ?? 'h-10'
  )

  const controls = (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {/* Bộ chọn đợt */}
      <select className={baseSelect} value={periodId ?? ''} onChange={e => handlePeriodChange(e.target.value || undefined)}>
        <option value="">Tất cả các đợt</option>
        {periods.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {/* Dropdown granularity */}
      {selectedPeriod ? (
        <select
          className={baseSelect}
          value={periodMode}
          onChange={e => { setPeriodMode(e.target.value as PeriodMode); setSubIndex(0) }}
        >
          {periodModeOptions.map(m => (
            <option key={m} value={m}>{PERIOD_MODE_LABEL[m]}</option>
          ))}
        </select>
      ) : (
        <select className={baseSelect} value={legacyMode} onChange={e => setLegacyMode(e.target.value as LegacyMode)}>
          {LEGACY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}

      {/* Bộ chọn phụ */}
      {selectedPeriod && periodMode === 'BY_DAY' && (
        <input
          type="date"
          className={baseSelect}
          min={periodStart ? fmtInput(periodStart) : undefined}
          max={periodEnd ? fmtInput(periodEnd) : undefined}
          value={dayValue || (periodStart ? fmtInput(periodStart) : '')}
          onChange={e => setDayValue(e.target.value)}
        />
      )}

      {selectedPeriod && periodMode === 'BY_WEEK' && (
        <select className={baseSelect} value={subIndex} onChange={e => setSubIndex(Number(e.target.value))}>
          {weeks.map((ws, i) => {
            const f = clamp(startOfWeek(ws, { weekStartsOn: 1 }), periodStart, periodEnd)
            const t = clamp(endOfWeek(ws, { weekStartsOn: 1 }), periodStart, periodEnd)
            return <option key={i} value={i}>{`Tuần ${i + 1} (${format(f, 'dd/MM')} – ${format(t, 'dd/MM')})`}</option>
          })}
        </select>
      )}

      {selectedPeriod && periodMode === 'BY_MONTH' && (
        <select className={baseSelect} value={subIndex} onChange={e => setSubIndex(Number(e.target.value))}>
          {months.map((ms, i) => (
            <option key={i} value={i}>{`Tháng ${format(ms, 'MM/yyyy')}`}</option>
          ))}
        </select>
      )}

      {selectedPeriod && periodMode === 'BY_QUARTER' && (
        <select className={baseSelect} value={subIndex} onChange={e => setSubIndex(Number(e.target.value))}>
          {quarters.map((qs, i) => (
            <option key={i} value={i}>{`Quý ${getQuarter(qs)}/${format(qs, 'yyyy')}`}</option>
          ))}
        </select>
      )}

      {((selectedPeriod && periodMode === 'CUSTOM') || (!selectedPeriod && legacyMode === 'CUSTOM')) && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            className={baseSelect}
            min={periodStart ? fmtInput(periodStart) : undefined}
            max={periodEnd ? fmtInput(periodEnd) : undefined}
            value={customRange.from}
            onChange={e => setCustomRange(prev => ({ ...prev, from: e.target.value }))}
          />
          <span className="text-slate-400">-</span>
          <input
            type="date"
            className={baseSelect}
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
