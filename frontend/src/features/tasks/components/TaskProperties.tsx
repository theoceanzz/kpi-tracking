import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Bell, CalendarClock, CircleDot, Eye, Flag, Plus, Repeat, Search, Target, User as UserIcon, Users, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import UserAvatar from '@/components/common/UserAvatar'
import { useAuthStore } from '@/store/authStore'
import { formatDateTime, formatDate } from '@/i18n/format'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { taskApi } from '../api/taskApi'
import TaskDuePicker from './TaskDuePicker'
import { useTaskMutations } from '../hooks/useTasks'
import { dueTone, PRIORITY_COLOR } from '../taskUtils'
import { TASK_PRIORITIES, TASK_STATUSES, type KpiTask, type ReminderInput, type TaskRecurrence, type UpdateTaskInput } from '../types'

interface Props {
  task: KpiTask
  editable: boolean
  /** Lưu một thay đổi (bảng chi tiết lo version + hỏi "lần này / các lần sau" với việc lặp). */
  save: (input: Omit<UpdateTaskInput, 'version'>) => void
  onStatus: (status: KpiTask['status']) => void
  onAssign: () => void
}

/** Một dòng thuộc tính kiểu Lark: icon bên trái, nhãn, giá trị bấm vào để sửa. */
function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[36px] items-center gap-3">
      <span className="flex w-32 shrink-0 items-center gap-2 text-xs text-[var(--color-subtle-foreground)]">{icon} {label}</span>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
    </div>
  )
}

const valueBtn = 'inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-[var(--color-muted)] disabled:cursor-default disabled:hover:bg-transparent'

/** Các dòng thuộc tính của bảng chi tiết: người phụ trách · theo dõi · hạn · nhắc · lặp · ưu tiên · KPI · trạng thái · phạm vi xem. */
export default function TaskProperties({ task, editable, save, onStatus, onAssign }: Props) {
  const { t } = useTranslation('tasks')
  return (
    <div className="space-y-0.5">
      <Row icon={<UserIcon size={14} />} label={t('detail.owner')}>
        <button type="button" className={valueBtn} disabled={!task.canReassign} onClick={onAssign}>
          <UserAvatar fullName={task.ownerName} avatarUrl={task.ownerAvatarUrl} className="h-6 w-6 rounded-full text-[10px]" />
          <span className="truncate">{task.ownerName}</span>
        </button>
        {task.createdById && task.createdById !== task.ownerId && (
          <span className="ml-2 text-xs text-[var(--color-subtle-foreground)]">{t('detail.assignedBy', { name: task.createdByName ?? '' })}</span>
        )}
      </Row>
      <Row icon={<Users size={14} />} label={t('detail.followers')}>
        <FollowersEditor task={task} />
      </Row>
      <Row icon={<CalendarClock size={14} />} label={t('detail.dueDate')}>
        <DueEditor task={task} editable={editable} save={save} />
      </Row>
      <Row icon={<Bell size={14} />} label={t('detail.reminder')}>
        <ReminderEditor task={task} editable={editable} />
      </Row>
      <Row icon={<Repeat size={14} />} label={t('detail.repeat')}>
        <RecurrenceEditor task={task} editable={editable} save={save} />
      </Row>
      <Row icon={<Flag size={14} />} label={t('detail.priority')}>
        <Select value={task.priority} disabled={!editable} onValueChange={(v) => save({ priority: v as KpiTask['priority'] })}>
          <SelectTrigger className="h-8 w-40 border-transparent shadow-none hover:border-[var(--color-border)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                <span className="inline-flex items-center gap-2"><Flag size={12} style={{ color: PRIORITY_COLOR[p] }} /> {t(`priority.${p}`)}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>
      <Row icon={<Target size={14} />} label={t('detail.kpi')}>
        {task.kpiDeleted ? (
          <span className="text-[var(--color-subtle-foreground)]">{t('row.kpiDeleted', { name: task.kpiName ?? '' })}</span>
        ) : (
          <Link to={`/kpi/${task.kpiId}?tab=tasks`} className="truncate text-[var(--color-primary)] hover:underline">
            {task.kpiName}{task.kpiPeriodName ? ` · ${task.kpiPeriodName}` : ''}
          </Link>
        )}
      </Row>
      <Row icon={<CircleDot size={14} />} label={t('detail.status')}>
        <Select value={task.status} disabled={!editable} onValueChange={(v) => onStatus(v as KpiTask['status'])}>
          <SelectTrigger className="h-8 w-40 border-transparent shadow-none hover:border-[var(--color-border)]"><SelectValue /></SelectTrigger>
          <SelectContent>{TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>)}</SelectContent>
        </Select>
      </Row>
      {!task.parentTaskId && (
        <Row icon={<Eye size={14} />} label={t('detail.visibility')}>
          <Select value={task.visibility} disabled={!editable} onValueChange={(v) => save({ visibility: v as KpiTask['visibility'] })}>
            <SelectTrigger className="h-8 w-64 border-transparent shadow-none hover:border-[var(--color-border)]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="KPI_SCOPE">{t('visibility.KPI_SCOPE')}</SelectItem>
              <SelectItem value="PRIVATE">{t('visibility.PRIVATE')}</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      )}
    </div>
  )
}

// ── Người theo dõi ───────────────────────────────────────────────────────────────────────────────

function FollowersEditor({ task }: { task: KpiTask }) {
  const { t } = useTranslation('tasks')
  const myId = useAuthStore((s) => s.user?.id)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const m = useTaskMutations()
  const { data: candidates = [] } = useQuery({
    queryKey: ['kpi-tasks', 'follower-candidates', task.id, q],
    queryFn: () => taskApi.followerCandidates(task.id, q),
    enabled: open,
  })
  const onError = (e: unknown) => toast.error(getApiErrorMessage(e))
  const isEditorOnly = task.canManageFollowers

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {task.followers.map((f) => (
        <span key={f.id} className="group inline-flex items-center gap-1 rounded-full bg-[var(--color-muted)] py-0.5 pl-0.5 pr-2 text-xs">
          <UserAvatar fullName={f.fullName} avatarUrl={f.avatarUrl} className="h-5 w-5 rounded-full text-[9px]" />
          {f.fullName}
          {(isEditorOnly || f.id === myId) && (
            <button type="button" aria-label={t('detail.removeFollower')} className="opacity-60 hover:opacity-100"
              onClick={() => m.removeFollower.mutate({ id: task.id, userId: f.id }, { onError })}>
              <X size={11} />
            </button>
          )}
        </span>
      ))}
      {isEditorOnly && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button type="button" aria-label={t('detail.addFollower')} className="rounded-full border border-dashed border-[var(--color-border-strong)] p-1 text-[var(--color-subtle-foreground)] hover:text-[var(--color-foreground)]">
              <Plus size={12} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <Input size="sm" value={q} autoFocus onChange={(e) => setQ(e.target.value)} prefix={<Search size={13} />} placeholder={t('assign.searchPeople')} />
            <div className="mt-2 max-h-60 overflow-y-auto">
              {candidates.map((c) => (
                <button key={c.id} type="button"
                  onClick={() => m.addFollower.mutate({ id: task.id, userId: c.id }, { onError, onSuccess: () => setOpen(false) })}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-[var(--color-muted)]">
                  <UserAvatar fullName={c.name} avatarUrl={c.avatarUrl} className="h-6 w-6 rounded-full text-[9px]" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{c.name}</span>
                    <span className="block truncate text-[11px] text-[var(--color-subtle-foreground)]">{c.detail}</span>
                  </span>
                </button>
              ))}
              {candidates.length === 0 && <p className="p-2 text-xs text-[var(--color-subtle-foreground)]">{t('detail.noFollowerCandidates')}</p>}
            </div>
          </PopoverContent>
        </Popover>
      )}
      {!isEditorOnly && myId && myId !== task.ownerId && (
        <Button size="sm" variant="ghost"
          onClick={() => task.following
            ? m.removeFollower.mutate({ id: task.id, userId: myId }, { onError })
            : m.addFollower.mutate({ id: task.id, userId: myId }, { onError })}>
          {task.following ? t('detail.unfollow') : t('detail.follow')}
        </Button>
      )}
      {task.followers.length === 0 && !isEditorOnly && <span className="text-xs text-[var(--color-subtle-foreground)]">—</span>}
    </div>
  )
}

// ── Hạn (kèm giờ) ────────────────────────────────────────────────────────────────────────────────

function DueEditor({ task, editable, save }: { task: KpiTask; editable: boolean; save: Props['save'] }) {
  const { t } = useTranslation('tasks')
  if (!editable) {
    return <span className={dueTone(task)}>{task.dueDate ? `${formatDate(task.dueDate)}${task.dueTime ? ' ' + task.dueTime.slice(0, 5) : ''}` : '—'}</span>
  }
  const current = { date: task.dueDate, time: task.dueTime?.slice(0, 5) ?? null }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-60">
        <TaskDuePicker size="sm" value={current} tone={dueTone(task)}
          className="border-transparent hover:border-[var(--color-border)]"
          onChange={(v) => {
            // Một lần chọn ngày + giờ = MỘT lần lưu.
            if (!v.date) { if (task.dueDate) save({ clearDueDate: true }); return }
            const patch = {
              ...(v.date !== task.dueDate ? { dueDate: v.date } : {}),
              ...(v.time ? (v.time !== current.time ? { dueTime: `${v.time}:00` } : {}) : (task.dueTime ? { clearDueTime: true } : {})),
            }
            if (Object.keys(patch).length) save(patch)
          }} />
      </div>
      {task.overdue && <span className="text-xs font-medium text-[var(--color-error)]">{t('due.overdue')}</span>}
    </div>
  )
}

// ── Nhắc ─────────────────────────────────────────────────────────────────────────────────────────

const PRESETS: { key: string; input: ReminderInput; timedOnly?: boolean }[] = [
  { key: 'atDue', input: { kind: 'AT_DUE' } },
  { key: 'before15', input: { kind: 'BEFORE', offsetMinutes: 15 }, timedOnly: true },
  { key: 'before60', input: { kind: 'BEFORE', offsetMinutes: 60 }, timedOnly: true },
  { key: 'before1440', input: { kind: 'BEFORE', offsetMinutes: 1440 } },
]

function sameReminder(a: ReminderInput, b: { kind: string; offsetMinutes: number | null }) {
  return a.kind === b.kind && (a.kind !== 'BEFORE' || a.offsetMinutes === b.offsetMinutes)
}

function ReminderEditor({ task, editable }: { task: KpiTask; editable: boolean }) {
  const { t } = useTranslation('tasks')
  const m = useTaskMutations()
  const [custom, setCustom] = useState('')
  const current = task.reminders ?? []
  const timed = !!task.dueTime
  const summary = current.length === 0 ? t('reminder.none') : current.map((r) =>
    r.kind === 'CUSTOM' ? formatDateTime(r.customAt) : t(`reminder.${r.kind === 'AT_DUE' ? 'atDue' : `before${r.offsetMinutes}`}`, { defaultValue: t('reminder.beforeMinutes', { count: r.offsetMinutes ?? 0 }) }),
  ).join(', ')

  const apply = (next: ReminderInput[]) =>
    m.setReminders.mutate({ id: task.id, reminders: next }, { onError: (e) => toast.error(getApiErrorMessage(e)) })
  const asInputs = (): ReminderInput[] => current.map((r) => ({ kind: r.kind, offsetMinutes: r.offsetMinutes, customAt: r.customAt }))

  if (!editable) return <span className="text-[var(--color-subtle-foreground)]">{summary}</span>
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={valueBtn}><span className="truncate">{summary}</span></button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2 p-3" align="start">
        {!task.dueDate && <p className="text-xs text-[var(--color-subtle-foreground)]">{t('reminder.needDue')}</p>}
        {PRESETS.filter((p) => timed || !p.timedOnly).map((p) => {
          const on = current.some((r) => sameReminder(p.input, r))
          return (
            <label key={p.key} className={cn('flex items-center gap-2 text-sm', !task.dueDate && 'opacity-50')}>
              <Checkbox checked={on} disabled={!task.dueDate}
                onCheckedChange={(v) => apply(v ? [...asInputs(), p.input] : asInputs().filter((r) => !sameReminder(r, { kind: p.input.kind, offsetMinutes: p.input.offsetMinutes ?? null })))} />
              {t(`reminder.${p.key}`)}{!timed && (p.key === 'atDue' || p.key === 'before1440') ? ` (09:00)` : ''}
            </label>
          )
        })}
        <div className="border-t border-[var(--color-border)] pt-2">
          <span className="text-xs text-[var(--color-subtle-foreground)]">{t('reminder.custom')}</span>
          <div className="mt-1 flex gap-2">
            <Input type="datetime-local" size="sm" value={custom} onChange={(e) => setCustom(e.target.value)} />
            <Button size="sm" disabled={!custom}
              onClick={() => { apply([...asInputs(), { kind: 'CUSTOM', customAt: new Date(custom).toISOString() }]); setCustom('') }}>
              {t('reminder.add')}
            </Button>
          </div>
          {current.filter((r) => r.kind === 'CUSTOM').map((r) => (
            <div key={r.id} className="mt-1 flex items-center justify-between text-xs">
              {formatDateTime(r.customAt)}
              <button type="button" aria-label={t('reminder.remove')}
                onClick={() => apply(asInputs().filter((x) => !(x.kind === 'CUSTOM' && x.customAt === r.customAt)))}><X size={12} /></button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ── Lặp lại ──────────────────────────────────────────────────────────────────────────────────────

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

function RecurrenceEditor({ task, editable, save }: { task: KpiTask; editable: boolean; save: Props['save'] }) {
  const { t } = useTranslation('tasks')
  const r = task.recurrence
  const [open, setOpen] = useState(false)
  const [freq, setFreq] = useState<string>(r?.freq ?? 'NONE')
  const [interval, setInterval] = useState<number>(r?.interval ?? 1)
  const [days, setDays] = useState<number[]>(r?.byWeekday ?? [])
  const [monthDay, setMonthDay] = useState<number | ''>(r?.byMonthDay ?? '')
  const [endDate, setEndDate] = useState(task.recurrenceEndDate ?? '')

  const summary = !r ? t('repeat.none')
    : r.freq === 'DAILY' ? t('repeat.summaryDaily', { count: r.interval ?? 1 })
    : r.freq === 'WEEKLY' ? t('repeat.summaryWeekly', { count: r.interval ?? 1, days: (r.byWeekday ?? []).map((d) => t(`weekday.${d}`)).join(', ') })
    : t('repeat.summaryMonthly', { count: r.interval ?? 1, day: r.byMonthDay ?? '' })

  const reset = () => {
    setFreq(r?.freq ?? 'NONE'); setInterval(r?.interval ?? 1); setDays(r?.byWeekday ?? [])
    setMonthDay(r?.byMonthDay ?? ''); setEndDate(task.recurrenceEndDate ?? '')
  }
  const apply = () => {
    if (freq === 'NONE') {
      if (r) save({ clearRecurrence: true })
    } else {
      const rule: TaskRecurrence = {
        freq: freq as TaskRecurrence['freq'],
        interval: Math.max(1, Number(interval) || 1),
        byWeekday: freq === 'WEEKLY' ? (days.length ? days : null) : null,
        byMonthDay: freq === 'MONTHLY' && monthDay !== '' ? Number(monthDay) : null,
      }
      save({ recurrence: rule, ...(endDate ? { recurrenceEndDate: endDate } : { clearRecurrenceEndDate: true }) })
    }
    setOpen(false)
  }

  if (!editable) return <span className="text-[var(--color-subtle-foreground)]">{summary}</span>
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) reset() }}>
      <PopoverTrigger asChild>
        <button type="button" className={valueBtn}><span className="truncate">{summary}</span></button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3 p-3" align="start">
        {!task.dueDate && <p className="text-xs text-[var(--color-warning)]">{t('repeat.needDue')}</p>}
        <Select value={freq} onValueChange={setFreq}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">{t('repeat.none')}</SelectItem>
            <SelectItem value="DAILY">{t('repeat.daily')}</SelectItem>
            <SelectItem value="WEEKLY">{t('repeat.weekly')}</SelectItem>
            <SelectItem value="MONTHLY">{t('repeat.monthly')}</SelectItem>
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
              <div className="flex items-center gap-2 text-sm">
                {t('repeat.onDay')}
                <div className="w-20"><Input type="number" size="sm" min={1} max={31} value={monthDay} onChange={(e) => setMonthDay(e.target.value === '' ? '' : Number(e.target.value))} /></div>
              </div>
            )}
            <label className="block space-y-1 text-xs text-[var(--color-subtle-foreground)]">
              {t('repeat.endDate')}
              <Input type="date" size="sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
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
