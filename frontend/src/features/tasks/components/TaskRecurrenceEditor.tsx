import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { recurrenceSummary } from '../taskUtils'
import type { KpiTask, TaskRecurrence, UpdateTaskInput } from '../types'

const valueBtn = 'inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-[var(--color-muted)] disabled:cursor-default disabled:hover:bg-transparent'

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]
type MonthlyMode = 'day' | 'nth'

/**
 * Tuỳ chỉnh lặp lại của một việc (mỗi ngày / ngày làm việc / tuần / tháng theo ngày hoặc "thứ n" / năm; kết thúc: không,
 * theo ngày, sau n lần). Trong hộp thời gian kiểu Lark nó mở từ icon "Lặp lại" ở chân hộp.
 */
export default function TaskRecurrenceEditor({ task, editable, save, children, align = 'start' }: {
  task: KpiTask; editable: boolean; save: (input: Omit<UpdateTaskInput, 'version'>) => void
  /** Nút mở tuỳ chỉnh (mặc định: chữ tóm tắt quy tắc). */
  children?: ReactNode
  align?: 'start' | 'end'
}) {
  const { t } = useTranslation('tasks')
  const r = task.recurrence
  const [open, setOpen] = useState(false)
  const [freq, setFreq] = useState<string>(r?.freq ?? 'NONE')
  const [interval, setInterval] = useState<number>(r?.interval ?? 1)
  const [days, setDays] = useState<number[]>(r?.byWeekday ?? [])
  const [monthDay, setMonthDay] = useState<number | ''>(r?.byMonthDay ?? '')
  const [monthlyMode, setMonthlyMode] = useState<MonthlyMode>(r?.bySetPos ? 'nth' : 'day')
  const [setPos, setSetPos] = useState<number>(r?.bySetPos ?? 1)
  const [nthDay, setNthDay] = useState<number>(r?.byWeekday?.[0] ?? 1)
  const [month, setMonth] = useState<number | ''>(r?.byMonth ?? '')
  const [endMode, setEndMode] = useState<'never' | 'date' | 'count'>(task.recurrenceEndDate ? 'date' : r?.count ? 'count' : 'never')
  const [endDate, setEndDate] = useState(task.recurrenceEndDate ?? '')
  const [count, setCount] = useState<number>(r?.count ?? 10)

  const summary = recurrenceSummary(r, t)

  const reset = () => {
    setFreq(r?.freq ?? 'NONE'); setInterval(r?.interval ?? 1); setDays(r?.byWeekday ?? [])
    setMonthDay(r?.byMonthDay ?? ''); setMonthlyMode(r?.bySetPos ? 'nth' : 'day'); setSetPos(r?.bySetPos ?? 1)
    setNthDay(r?.byWeekday?.[0] ?? 1); setMonth(r?.byMonth ?? ''); setEndDate(task.recurrenceEndDate ?? '')
    setEndMode(task.recurrenceEndDate ? 'date' : r?.count ? 'count' : 'never'); setCount(r?.count ?? 10)
  }
  const apply = () => {
    if (freq === 'NONE') {
      if (r) save({ clearRecurrence: true })
    } else {
      const rule: TaskRecurrence = {
        freq: freq as TaskRecurrence['freq'],
        interval: Math.max(1, Number(interval) || 1),
        byWeekday: freq === 'WEEKLY' ? (days.length ? days : null) : freq === 'MONTHLY' && monthlyMode === 'nth' ? [nthDay] : null,
        byMonthDay: (freq === 'MONTHLY' && monthlyMode === 'day') || freq === 'YEARLY' ? (monthDay === '' ? null : Number(monthDay)) : null,
        bySetPos: freq === 'MONTHLY' && monthlyMode === 'nth' ? setPos : null,
        byMonth: freq === 'YEARLY' && month !== '' ? Number(month) : null,
        count: endMode === 'count' ? Math.max(1, Number(count) || 1) : null,
      }
      save({ recurrence: rule, ...(endMode === 'date' && endDate ? { recurrenceEndDate: endDate } : { clearRecurrenceEndDate: true }) })
    }
    setOpen(false)
  }

  if (!editable) return <span className="text-[var(--color-subtle-foreground)]">{summary}</span>
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) reset() }}>
      <PopoverTrigger asChild>
        {children ?? <button type="button" className={valueBtn}><span className="truncate">{summary}</span></button>}
      </PopoverTrigger>
      <PopoverContent className="w-96 space-y-3 p-3" align={align}>
        {!task.dueDate && <p className="text-xs text-[var(--color-warning)]">{t('repeat.needDue')}</p>}
        <Select value={freq} onValueChange={(v) => { setFreq(v); if (v === 'WORKDAYS') { setFreq('WEEKLY'); setDays([1, 2, 3, 4, 5]); setInterval(1) } }}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">{t('repeat.none')}</SelectItem>
            <SelectItem value="DAILY">{t('repeat.daily')}</SelectItem>
            <SelectItem value="WORKDAYS">{t('repeat.workdays')}</SelectItem>
            <SelectItem value="WEEKLY">{t('repeat.weekly')}</SelectItem>
            <SelectItem value="MONTHLY">{t('repeat.monthly')}</SelectItem>
            <SelectItem value="YEARLY">{t('repeat.yearly')}</SelectItem>
          </SelectContent>
        </Select>
        {freq !== 'NONE' && (
          <>
            <div className="flex items-center gap-2 text-sm">
              {t('repeat.every')}
              <div className="w-20"><Input type="number" size="sm" min={1} max={365} value={interval} onChange={(e) => setInterval(Number(e.target.value))} /></div>
              {t(`repeat.unit.${freq}`)}
            </div>
            {freq === 'WEEKLY' && (
              <div className="flex flex-wrap gap-1">
                {WEEKDAYS.map((d) => (
                  <ChoiceChip key={d} size="sm" selected={days.includes(d)}
                    onClick={() => setDays((cur) => cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort())}>
                    {t(`weekday.${d}`)}
                  </ChoiceChip>
                ))}
              </div>
            )}
            {freq === 'MONTHLY' && (
              <div className="space-y-2 text-sm">
                <div className="flex gap-1">
                  <ChoiceChip size="sm" selected={monthlyMode === 'day'} onClick={() => setMonthlyMode('day')}>{t('repeat.byDay')}</ChoiceChip>
                  <ChoiceChip size="sm" selected={monthlyMode === 'nth'} onClick={() => setMonthlyMode('nth')}>{t('repeat.byNth')}</ChoiceChip>
                </div>
                {monthlyMode === 'day' ? (
                  <div className="flex items-center gap-2">
                    {t('repeat.onDay')}
                    <div className="w-20"><Input type="number" size="sm" min={1} max={31} value={monthDay} onChange={(e) => setMonthDay(e.target.value === '' ? '' : Number(e.target.value))} /></div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Select value={String(setPos)} onValueChange={(v) => setSetPos(Number(v))}>
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{[1, 2, 3, 4, -1].map((p) => <SelectItem key={p} value={String(p)}>{t(`repeat.pos.${p}`)}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={String(nthDay)} onValueChange={(v) => setNthDay(Number(v))}>
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{WEEKDAYS.map((d) => <SelectItem key={d} value={String(d)}>{t(`weekday.${d}`)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
            {freq === 'YEARLY' && (
              <div className="flex items-center gap-2 text-sm">
                {t('repeat.onDay')}
                <div className="w-16"><Input type="number" size="sm" min={1} max={31} value={monthDay} onChange={(e) => setMonthDay(e.target.value === '' ? '' : Number(e.target.value))} /></div>
                {t('repeat.month')}
                <div className="w-16"><Input type="number" size="sm" min={1} max={12} value={month} onChange={(e) => setMonth(e.target.value === '' ? '' : Number(e.target.value))} /></div>
              </div>
            )}
            <div className="space-y-1.5 text-xs text-[var(--color-subtle-foreground)]">
              {t('repeat.ends')}
              <div className="flex gap-1">
                {(['never', 'date', 'count'] as const).map((k) => (
                  <ChoiceChip key={k} size="sm" selected={endMode === k} onClick={() => setEndMode(k)}>{t(`repeat.end.${k}`)}</ChoiceChip>
                ))}
              </div>
              {endMode === 'date' && <Input type="date" size="sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />}
              {endMode === 'count' && (
                <div className="w-32"><Input type="number" size="sm" min={1} max={1000} value={count} onChange={(e) => setCount(Number(e.target.value))}
                  suffix={t('repeat.times')} className="no-edit-hint" /></div>
              )}
            </div>
            <p className="text-[11px] text-[var(--color-subtle-foreground)]">{t('repeat.hint')}</p>
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t('detail.close')}</Button>
          <Button size="sm" disabled={freq !== 'NONE' && !task.dueDate} onClick={apply}>{t('repeat.apply')}</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
