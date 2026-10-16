import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { DayPicker } from 'react-day-picker'
import { ArrowRightToLine, Bell, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Repeat, X } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { dateFnsLocale, formatDateTime } from '@/i18n/format'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { useTaskMutations } from '../hooks/useTasks'
import { addDays, dueTone, larkDay, larkRange, recurrenceSummary, todayIso } from '../taskUtils'
import type { KpiTask, ReminderInput, UpdateTaskInput } from '../types'
import TaskRecurrenceEditor from './TaskRecurrenceEditor'
import { DAY_PICKER_CLASS_NAMES } from './dayPickerStyles'

interface Props {
  task: KpiTask
  editable: boolean
  save: (input: Omit<UpdateTaskInput, 'version'>) => void
}

interface Draft { start: string | null; due: string | null; startTime: string; dueTime: string; timeOn: boolean }

/** Mốc nhắc chọn nhanh — đúng danh sách của Lark (When it's due … 2 days before). */
const ALERTS: { key: string; input: ReminderInput | null }[] = [
  { key: 'none', input: null },
  { key: 'atDue', input: { kind: 'AT_DUE' } },
  { key: 'b5', input: { kind: 'BEFORE', offsetMinutes: 5 } },
  { key: 'b15', input: { kind: 'BEFORE', offsetMinutes: 15 } },
  { key: 'b30', input: { kind: 'BEFORE', offsetMinutes: 30 } },
  { key: 'b60', input: { kind: 'BEFORE', offsetMinutes: 60 } },
  { key: 'b120', input: { kind: 'BEFORE', offsetMinutes: 120 } },
  { key: 'b1440', input: { kind: 'BEFORE', offsetMinutes: 1440 } },
  { key: 'b2880', input: { kind: 'BEFORE', offsetMinutes: 2880 } },
]
const OTHER = '__other__'

const Chevron = (props: { orientation?: string }) =>
  props.orientation === 'left' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />

/**
 * Dòng thời gian của bảng chi tiết, đúng như Lark: chưa có ngày ⇒ ba nút "Hôm nay · Ngày mai · Khác"; có rồi ⇒ MỘT dòng chữ
 * ("Hôm nay - Ngày mai, 18:00" + chuông nếu có nhắc + vòng nếu lặp). Bấm ⇒ hộp: lịch tháng, ô "Ngày bắt đầu (không bắt
 * buộc)", ô "Hạn", ☐ "Thêm giờ", dòng nhắc, chân hộp: icon Lặp lại + "Xoá tất cả". Ngày / giờ lưu MỘT lần khi đóng hộp;
 * nhắc và lặp lưu ngay khi chọn.
 */
export default function TaskTimeField({ task, editable, save }: Props) {
  const { t } = useTranslation('tasks')
  const m = useTaskMutations()
  const [open, setOpen] = useState(false)
  const [field, setField] = useState<'start' | 'due'>('due')
  const fresh = (): Draft => ({
    start: task.startDate, due: task.dueDate,
    startTime: task.startTime?.slice(0, 5) ?? '09:00', dueTime: task.dueTime?.slice(0, 5) ?? '18:00',
    timeOn: !!task.dueTime || !!task.startTime,
  })
  const [draft, setDraft] = useState<Draft>(fresh)
  const empty = !task.startDate && !task.dueDate
  const reminders = task.reminders ?? []
  const label = larkRange(task)

  const commit = (d: Draft) => {
    const p: Omit<UpdateTaskInput, 'version'> = {}
    let start = d.start, due = d.due
    if (start && due && start > due) [start, due] = [due, start]
    if (start !== task.startDate) Object.assign(p, start ? { startDate: start } : { clearStartDate: true })
    if (due !== task.dueDate) Object.assign(p, due ? { dueDate: due } : { clearDueDate: true })
    const dueT = d.timeOn && due ? `${d.dueTime}:00` : null
    const startT = d.timeOn && start ? `${d.startTime}:00` : null
    if ((dueT ?? null) !== (task.dueTime ?? null)) Object.assign(p, dueT ? { dueTime: dueT } : { clearDueTime: true })
    if ((startT ?? null) !== (task.startTime ?? null)) Object.assign(p, startT ? { startTime: startT } : { clearStartTime: true })
    if (Object.keys(p).length) save(p)
  }
  const openWith = (o: boolean) => {
    if (o) { setDraft(fresh()); setField(task.dueDate || !task.startDate ? 'due' : 'start') }
    else commit(draft)
    setOpen(o)
  }
  const onError = (e: unknown) => toast.error(getApiErrorMessage(e))
  const setAlert = (key: string) => {
    if (key === OTHER) return
    const a = ALERTS.find((x) => x.key === key)
    m.setReminders.mutate({ id: task.id, reminders: a?.input ? [a.input] : [] }, { onError })
  }
  const alertKey = reminders.length === 0 ? 'none'
    : reminders.length === 1 ? (ALERTS.find((a) => a.input && a.input.kind === reminders[0]!.kind
      && (a.input.kind !== 'BEFORE' || a.input.offsetMinutes === reminders[0]!.offsetMinutes))?.key ?? OTHER) : OTHER
  const otherLabel = reminders.map((r) => r.kind === 'CUSTOM' ? formatDateTime(r.customAt)
    : r.kind === 'AT_DUE' ? t('alert.atDue') : t('reminder.beforeMinutes', { count: r.offsetMinutes ?? 0 })).join(', ')
  const clearAll = () => {
    save({ clearStartDate: true, clearDueDate: true, clearStartTime: true, clearDueTime: true, ...(task.recurrence ? { clearRecurrence: true } : {}) })
    if (reminders.length) m.setReminders.mutate({ id: task.id, reminders: [] }, { onError })
    setDraft({ ...draft, start: null, due: null, timeOn: false })
    setOpen(false)
  }

  const text = (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', dueTone(task), !task.overdue && !task.dueToday && 'text-[var(--color-foreground)]')}
      title={task.overdue ? t('due.overdue') : undefined}>
      <span className="truncate">{label}</span>
      {reminders.length > 0 && <Bell size={13} className="shrink-0 text-[var(--color-subtle-foreground)]" aria-label={t('detail.reminder')} />}
      {task.recurrence && <Repeat size={13} className="shrink-0 text-[var(--color-subtle-foreground)]" aria-label={t('detail.repeat')} />}
    </span>
  )
  if (!editable) return empty ? <span className="px-1.5 text-[var(--color-muted-foreground)]">-</span> : <span className="px-1.5">{text}</span>

  const quick = 'inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--color-muted)] px-2.5 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-border)]'
  const fieldBox = (k: 'start' | 'due') => cn('flex h-9 w-full items-center gap-2 rounded-control border px-3 text-left text-sm',
    field === k ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-ring)]' : 'border-[var(--color-input)] hover:border-[var(--color-border-strong)]')
  const between = draft.start && draft.due && draft.start < draft.due
    ? { after: new Date(`${draft.start}T00:00:00`), before: new Date(`${draft.due}T00:00:00`) } : undefined

  return (
    <Popover open={open} onOpenChange={openWith}>
      {empty ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={quick} onClick={() => save({ dueDate: todayIso() })}>
            <CalendarDays size={14} className="text-[var(--color-primary)]" /> {t('due.today')}
          </button>
          <button type="button" className={quick} onClick={() => save({ dueDate: addDays(todayIso(), 1) })}>
            <ArrowRightToLine size={14} className="text-[var(--color-success)]" /> {t('due.tomorrow')}
          </button>
          <PopoverTrigger asChild>
            <button type="button" className={quick}><CalendarRange size={14} className="text-[var(--color-subtle-foreground)]" /> {t('due.other')}</button>
          </PopoverTrigger>
        </div>
      ) : (
        <PopoverTrigger asChild>
          <button type="button" className="max-w-full rounded-md px-1.5 py-1 text-left hover:bg-[var(--color-muted)]">{text}</button>
        </PopoverTrigger>
      )}
      <PopoverContent className="w-[300px] max-w-[calc(100vw-24px)] p-0" align="start" collisionPadding={12} sideOffset={6}>
        <div className="relative px-3 pt-3">
          <DayPicker
            locale={dateFnsLocale()}
            weekStartsOn={1}
            defaultMonth={new Date(`${(field === 'start' ? draft.start : draft.due) ?? draft.due ?? draft.start ?? todayIso()}T00:00:00`)}
            onDayClick={(day) => {
              const iso = format(day, 'yyyy-MM-dd')
              setDraft((d) => ({ ...d, [field]: iso }))
              if (field === 'start') setField('due')
            }}
            modifiers={{
              start: draft.start ? new Date(`${draft.start}T00:00:00`) : [],
              due: draft.due ? new Date(`${draft.due}T00:00:00`) : [],
              between: between ?? [],
            }}
            modifiersClassNames={{
              start: '[&>button]:bg-[var(--color-primary-soft)] [&>button]:text-[var(--color-primary)] [&>button]:ring-1 [&>button]:ring-[var(--color-primary)]',
              due: '[&>button]:bg-[var(--color-primary)] [&>button]:text-[var(--color-primary-foreground)]',
              between: '[&>button]:bg-[var(--color-primary-soft)]',
            }}
            classNames={DAY_PICKER_CLASS_NAMES}
            components={{ Chevron }}
          />
        </div>
        <div className="space-y-2 px-3 pb-3 pt-1">
          {(['start', 'due'] as const).map((k) => (
            <div key={k} className="flex items-center gap-2">
              <button type="button" onClick={() => setField(k)} className={fieldBox(k)}>
                <span className={cn('flex-1 truncate', !draft[k] && 'text-[var(--color-muted-foreground)]')}>
                  {draft[k] ? larkDay(draft[k]!) : t(k === 'start' ? 'time.startOptional' : 'time.due')}
                </span>
                {draft[k] && (
                  <span role="button" tabIndex={0} aria-label={t('time.clearField')}
                    onClick={(e) => { e.stopPropagation(); setDraft((d) => ({ ...d, [k]: null })) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setDraft((d) => ({ ...d, [k]: null })) } }}
                    className="rounded p-0.5 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"><X size={13} /></span>
                )}
              </button>
              {draft.timeOn && draft[k] && (
                <div className="w-[88px] shrink-0">
                  <Input type="time" size="sm" step={300} aria-label={t('time.time')} className="no-edit-hint"
                    value={k === 'start' ? draft.startTime : draft.dueTime}
                    onChange={(e) => setDraft((d) => ({ ...d, [k === 'start' ? 'startTime' : 'dueTime']: e.target.value || d[k === 'start' ? 'startTime' : 'dueTime'] }))} />
                </div>
              )}
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm text-[var(--color-foreground)]">
            <Checkbox checked={draft.timeOn} onCheckedChange={(v) => setDraft((d) => ({ ...d, timeOn: !!v, due: d.due ?? (v ? todayIso() : null) }))} />
            {t('time.addTime')}
          </label>
        </div>
        <div className="flex items-center gap-2 border-t border-[var(--color-border)] px-3 py-2">
          <Bell size={15} className="shrink-0 text-[var(--color-subtle-foreground)]" />
          <Select value={alertKey} disabled={!task.dueDate} onValueChange={setAlert}>
            <SelectTrigger className="h-8 w-fit min-w-0 gap-2 border-transparent px-1.5 shadow-none hover:border-[var(--color-border)]">
              <SelectValue>{alertKey === OTHER ? otherLabel : t(`alert.${alertKey}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ALERTS.map((a) => <SelectItem key={a.key} value={a.key}>{t(`alert.${a.key}`)}</SelectItem>)}
              {alertKey === OTHER && <SelectItem value={OTHER}>{otherLabel}</SelectItem>}
            </SelectContent>
          </Select>
          {!task.dueDate && <span className="text-xs text-[var(--color-subtle-foreground)]">{t('reminder.needDue')}</span>}
        </div>
        <div className="flex items-center gap-2 border-t border-[var(--color-border)] px-2 py-1.5">
          <TaskRecurrenceEditor task={task} editable save={save}>
            <button type="button" title={t('detail.repeat')} aria-label={t('detail.repeat')}
              className={cn('inline-flex h-8 max-w-[180px] items-center gap-1.5 rounded-md px-2 text-sm hover:bg-[var(--color-muted)]',
                task.recurrence ? 'text-[var(--color-primary)]' : 'text-[var(--color-subtle-foreground)]')}>
              <Repeat size={15} className="shrink-0" />
              {task.recurrence && <span className="truncate">{recurrenceSummary(task.recurrence, t)}</span>}
            </button>
          </TaskRecurrenceEditor>
          <div className="flex-1" />
          <button type="button" onClick={clearAll} className="rounded-md px-2 py-1.5 text-sm text-[var(--color-subtle-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]">
            {t('time.clearAll')}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
