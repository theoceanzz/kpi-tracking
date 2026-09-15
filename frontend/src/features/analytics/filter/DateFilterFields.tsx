import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, History, Search } from 'lucide-react'
import { format, getQuarter, startOfWeek, endOfWeek } from 'date-fns'
import ScopeSelectItems from '@/components/common/ScopeSelectItems'
import { pickCurrentOrNearest, splitByTime } from '@/components/common/dateScope'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { KpiCycle, KpiPeriod } from '@/types/kpi'
import {
  DEFAULT_DATE_INTENT,
  LEGACY_OPTIONS,
  PERIOD_MODE_LABEL,
  clamp,
  fmtInput,
  periodModeOptions,
  periodSubUnits,
  type DateFilterIntent,
  type FilterMode,
  type GroupBy,
  type LegacyMode,
  type PeriodMode,
} from './dateFilterModel'

/**
 * Các ô chọn của bộ lọc thời gian, KHÔNG giữ trạng thái.
 *
 * Tách khỏi `useAnalyticsDateFilter` để cùng một bộ ô dùng được ở hai chỗ có vòng đời khác hẳn
 * nhau: thanh lọc chung của trang (trạng thái nằm trong hook) và bảng cấu hình của từng widget
 * (trạng thái nằm trong bố cục đã lưu). Component tự giữ state thì chỗ thứ hai không dùng được.
 */
export default function DateFilterFields({
  value,
  onChange,
  periods,
  cycles,
  className,
  selectClassName,
}: {
  value: DateFilterIntent
  onChange: (next: DateFilterIntent) => void
  periods: KpiPeriod[]
  cycles: KpiCycle[]
  className?: string
  selectClassName?: string
}) {
  const mode = value.mode ?? DEFAULT_DATE_INTENT.mode
  const legacyMode = value.legacyMode ?? DEFAULT_DATE_INTENT.legacyMode
  const periodMode = value.periodMode ?? DEFAULT_DATE_INTENT.periodMode
  const subIndex = value.subIndex ?? DEFAULT_DATE_INTENT.subIndex
  const groupBy = value.groupBy ?? DEFAULT_DATE_INTENT.groupBy

  const patch = (next: Partial<DateFilterIntent>) => onChange({ ...value, ...next })

  const selectedPeriod = value.periodId ? periods.find(p => p.id === value.periodId) : undefined
  const pStartStr = selectedPeriod?.startDate ?? null
  const pEndStr = selectedPeriod?.endDate ?? null
  const periodStart = pStartStr ? new Date(pStartStr) : null
  const periodEnd = pEndStr ? new Date(pEndStr) : null
  // Không memo tay: React Compiler tự lo, còn memo tay ở đây thì nó phải bỏ tối ưu cả component
  // vì không chứng minh được phụ thuộc bất biến. Phép tính cũng chỉ là vài mốc lịch.
  const { weeks, months, quarters } = periodSubUnits(pStartStr, pEndStr)

  // Đổi đợt → về "Toàn đợt". Giữ lại lát cắt cũ là sai: "tuần thứ 5" của đợt trước có thể không
  // tồn tại ở đợt mới, và người dùng không hề chọn nó cho đợt này.
  const handlePeriodChange = (id: string | undefined) =>
    patch({ periodId: id, periodMode: 'WHOLE_PERIOD', subIndex: 0, dayValue: '', customFrom: '', customTo: '' })

  // Vào "Khoảng đợt"/"Theo kỳ" lần đầu thì mồi sẵn mục đang chạy, để người dùng thấy ngay số liệu
  // thay vì một ô trống.
  const switchMode = (m: FilterMode) => {
    const next: Partial<DateFilterIntent> = { mode: m }
    if (m === 'RANGE' && !value.rangeFromId && !value.rangeToId) {
      const current = pickCurrentOrNearest(periods)
      if (current) {
        next.rangeFromId = current.id
        next.rangeToId = current.id
      }
    }
    if (m === 'CYCLE' && (value.cycleIds ?? []).length === 0) {
      const currentCycle = pickCurrentOrNearest(cycles)
      if (currentCycle) next.cycleIds = [currentCycle.id]
    }
    patch(next)
  }

  // Đổi "Từ đợt": nếu "Đến đợt" đang trước → kéo "Đến" về bằng "Từ".
  const handleRangeFrom = (id: string) => {
    const f = periods.find(p => p.id === id)
    const t = value.rangeToId ? periods.find(p => p.id === value.rangeToId) : undefined
    const pullTo = f?.startDate && t?.startDate && new Date(t.startDate) < new Date(f.startDate)
    patch({ rangeFromId: id, ...(pullTo ? { rangeToId: id } : {}) })
  }

  // "Đến đợt" chỉ cho chọn đợt có startDate ≥ "Từ đợt".
  const rangeFromPeriod = value.rangeFromId ? periods.find(p => p.id === value.rangeFromId) : undefined
  const toOptions = useMemo(() => {
    if (!rangeFromPeriod?.startDate) return periods
    const lo = new Date(rangeFromPeriod.startDate).getTime()
    return periods.filter(p => p.startDate && new Date(p.startDate).getTime() >= lo)
  }, [periods, rangeFromPeriod])

  const baseTrigger = cn(
    'bg-[var(--color-muted)] border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 w-full sm:w-auto whitespace-nowrap [&>span]:truncate',
    selectClassName ?? 'h-10'
  )

  const modeBtn = (m: FilterMode, label: string) => (
    <button
      type="button"
      onClick={() => switchMode(m)}
      className={cn(
        'px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap',
        mode === m
          ? 'bg-white dark:bg-slate-700 text-[var(--color-primary)] dark:text-indigo-300 shadow-sm'
          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
      )}
    >
      {label}
    </button>
  )

  return (
    <div className={cn('flex flex-col sm:flex-row items-stretch sm:items-center gap-3', className)}>
      {/* Toggle chế độ */}
      <div className="flex bg-[var(--color-muted)] rounded-lg p-0.5 gap-0.5 shrink-0 self-start sm:self-auto">
        {modeBtn('SINGLE', 'Một đợt')}
        {modeBtn('RANGE', 'Khoảng đợt')}
        {modeBtn('CYCLE', 'Theo kỳ')}
      </div>

      {mode === 'SINGLE' ? (
        <>
          <Select
            value={value.periodId ?? 'ALL'}
            onValueChange={v => handlePeriodChange(v === 'ALL' ? undefined : v)}
          >
            <SelectTrigger className={cn(baseTrigger, 'md:w-[300px]')}>
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
            <Select
              value={periodMode}
              onValueChange={v => patch({ periodMode: v as PeriodMode, subIndex: 0 })}
            >
              <SelectTrigger className={cn(baseTrigger, 'md:w-[220px]')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-[var(--radix-select-trigger-width)]">
                {periodModeOptions(selectedPeriod).map(m => (
                  <SelectItem key={m} value={m}>{PERIOD_MODE_LABEL[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={legacyMode} onValueChange={v => patch({ legacyMode: v as LegacyMode })}>
              <SelectTrigger className={cn(baseTrigger, 'md:w-[220px]')}>
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
              value={value.dayValue || (periodStart ? fmtInput(periodStart) : '')}
              onChange={e => patch({ dayValue: e.target.value })}
            />
          )}

          {selectedPeriod && periodMode === 'BY_WEEK' && (
            <Select value={subIndex.toString()} onValueChange={v => patch({ subIndex: Number(v) })}>
              <SelectTrigger className={baseTrigger}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-[var(--radix-select-trigger-width)]">
                {weeks.map((ws, i) => {
                  const f = clamp(startOfWeek(ws, { weekStartsOn: 1 }), periodStart, periodEnd)
                  const t = clamp(endOfWeek(ws, { weekStartsOn: 1 }), periodStart, periodEnd)
                  return (
                    <SelectItem key={i} value={i.toString()}>
                      {`Tuần ${i + 1} (${format(f, 'dd/MM')} - ${format(t, 'dd/MM')})`}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          )}

          {selectedPeriod && periodMode === 'BY_MONTH' && (
            <Select value={subIndex.toString()} onValueChange={v => patch({ subIndex: Number(v) })}>
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
            <Select value={subIndex.toString()} onValueChange={v => patch({ subIndex: Number(v) })}>
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
                value={value.customFrom ?? ''}
                onChange={e => patch({ customFrom: e.target.value })}
              />
              <span className="hidden sm:inline text-slate-400">-</span>
              <input
                type="date"
                className={baseTrigger}
                min={periodStart ? fmtInput(periodStart) : undefined}
                max={periodEnd ? fmtInput(periodEnd) : undefined}
                value={value.customTo ?? ''}
                onChange={e => patch({ customTo: e.target.value })}
              />
            </div>
          )}
        </>
      ) : mode === 'RANGE' ? (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Select value={value.rangeFromId} onValueChange={handleRangeFrom}>
            <SelectTrigger className={cn(baseTrigger, 'md:w-[240px]')}>
              <SelectValue placeholder="Từ đợt..." />
            </SelectTrigger>
            <SelectContent className="w-[var(--radix-select-trigger-width)]">
              <ScopeSelectItems items={periods} selectedId={value.rangeFromId} />
            </SelectContent>
          </Select>
          <span className="hidden sm:inline text-slate-400 self-center">→</span>
          <Select value={value.rangeToId} onValueChange={v => patch({ rangeToId: v })}>
            <SelectTrigger className={cn(baseTrigger, 'md:w-[240px]')}>
              <SelectValue placeholder="Đến đợt..." />
            </SelectTrigger>
            <SelectContent className="w-[var(--radix-select-trigger-width)]">
              <ScopeSelectItems items={toOptions} selectedId={value.rangeToId} />
            </SelectContent>
          </Select>
        </div>
      ) : (
        <CyclePicker
          cycles={cycles}
          selected={value.cycleIds ?? []}
          onChange={ids => patch({ cycleIds: ids })}
          triggerClass={cn(baseTrigger, 'md:w-[300px]')}
        />
      )}

      {/* Kiểu chia cột biểu đồ xu hướng — chỉ ý nghĩa khi có NHIỀU đợt (tất cả đợt / khoảng đợt).
          Khi chọn đúng 1 đợt cụ thể thì "Theo đợt" = 1 cột (vô nghĩa) nên ẩn đi. */}
      {(mode === 'RANGE' || mode === 'CYCLE' || !selectedPeriod) && (
        <Select value={groupBy} onValueChange={v => patch({ groupBy: v as GroupBy })}>
          <SelectTrigger className={cn(baseTrigger, 'md:w-[200px]')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="w-[var(--radix-select-trigger-width)]">
            <SelectItem value="TIME">Trục: theo thời gian</SelectItem>
            <SelectItem value="PERIOD">Trục: theo đợt</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

/** Chọn 1 hoặc NHIỀU kỳ (multi-select) — popover có ô tìm + danh sách checkbox. */
function CyclePicker({
  cycles,
  selected,
  onChange,
  triggerClass,
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
          <div className="p-2 border-b border-[var(--color-border)]">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Tìm kỳ…"
                className="w-full h-8 pl-8 pr-2 rounded-lg bg-[var(--color-muted)] text-xs border-none outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>
        )}
        <div className="max-h-64 overflow-auto p-1.5">
          {shown.length ? shown.map(c => (
            <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer">
              <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
              <span className="truncate text-[13px] font-semibold text-[var(--color-foreground)]">{c.name}</span>
            </label>
          )) : hiddenPastCount === 0 && (
            <p className="text-xs italic text-slate-400 p-2">Không có kỳ nào.</p>
          )}

          {hiddenPastCount > 0 && (
            <button
              type="button"
              onClick={() => setShowPast(true)}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
            >
              <History size={13} /> Xem {hiddenPastCount} kỳ đã qua
            </button>
          )}
          {showPast && !searching && past.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPast(false)}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
            >
              <ChevronUp size={13} /> Ẩn kỳ đã qua
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
