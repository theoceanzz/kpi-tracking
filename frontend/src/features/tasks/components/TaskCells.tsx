import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Bell, Check, Flag, Repeat, Search, Star, UserPlus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import UserAvatar from '@/components/common/UserAvatar'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { taskApi } from '../api/taskApi'
import { useTaskMutations, useTaskSidebar } from '../hooks/useTasks'
import { useFieldText } from '../hooks/useFieldText'
import type { TaskColumn } from '../hooks/useTaskColumns'
import { dueCountdown, formatDue, isClosed, larkDay, PRIORITY_COLOR } from '../taskUtils'
import { useNow } from '../hooks/useNow'
import { TASK_PRIORITIES, type KpiTask, type TaskListField } from '../types'
import { AssigneeLabel, PersonPill, TagChip } from './TaskBits'
import TagPicker from './TagPicker'
import TaskDuePicker from './TaskDuePicker'
import { FieldEditor } from './TaskProperties'

const onError = (e: unknown) => toast.error(getApiErrorMessage(e))

/** Ô sửa tại chỗ: chặn bấm / phím / kéo lan ra dòng (không mở chi tiết, không kích hoạt kéo thả). */
const stopRow = {
  onClick: (e: React.MouseEvent) => e.stopPropagation(),
  onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onDoubleClick: (e: React.MouseEvent) => e.stopPropagation(),
}

const dash = <span className="px-1.5 text-sm text-[var(--color-muted-foreground)]">-</span>
/** Nút trong ô: trong suốt, viền khi rê chuột (kiểu Lark). */
const cellBtn = 'flex h-8 w-full min-w-0 items-center gap-1 rounded-md border border-transparent px-1.5 text-left text-sm hover:border-[var(--color-border)] disabled:cursor-default disabled:hover:border-transparent'

function Cell({ column, children, stop = true, title }: { column: TaskColumn; children: ReactNode; stop?: boolean; title?: string }) {
  return (
    <div className="flex shrink-0 items-center px-1" style={{ width: column.width }} title={title} {...(stop ? stopRow : {})}>
      {children}
    </div>
  )
}

/** Một ô của bảng theo khoá cột. `editable` = được sửa việc này (và việc chưa xong). */
export function TaskCell({ task, column, fields }: { task: KpiTask; column: TaskColumn; fields?: TaskListField[] }) {
  const editable = task.canEdit && !isClosed(task)
  switch (column.key) {
    case 'assignee': return <Cell column={column}><AssigneeCell task={task} /></Cell>
    case 'start': return <Cell column={column}><DateCell task={task} kind="start" editable={editable} /></Cell>
    case 'due': return <Cell column={column} title={task.dueDate ? formatDue(task) : undefined}><DateCell task={task} kind="due" editable={editable} /></Cell>
    case 'priority': return <Cell column={column}><PriorityCell task={task} editable={editable} /></Cell>
    case 'kpi':
      return (
        <Cell column={column} stop={false} title={task.kpiName ?? undefined}>
          {task.kpiName ? <span className="truncate px-1.5 text-sm text-[var(--color-foreground)]">{task.kpiName}</span> : dash}
        </Cell>
      )
    case 'tags': return <Cell column={column}><TagsCell task={task} editable={task.canEdit} /></Cell>
    case 'creator':
      return (
        <Cell column={column} stop={false} title={task.createdByName ?? undefined}>
          {task.createdByName ? <PersonPill name={task.createdByName} avatarUrl={null} /> : dash}
        </Cell>
      )
    case 'created':
      return <Cell column={column} stop={false}><span className="truncate px-1.5 text-sm text-[var(--color-subtle-foreground)]">{larkDay(new Date(task.createdAt).toLocaleDateString('en-CA'), new Date(task.createdAt).toTimeString().slice(0, 5))}</span></Cell>
    default: {
      const field = fields?.find((f) => `field:${f.id}` === column.key)
      if (!field) return <Cell column={column} stop={false}>{dash}</Cell>
      return <Cell column={column}><FieldCellEditor task={task} field={field} editable={task.canEdit} /></Cell>
    }
  }
}

// ── Người thực hiện ──────────────────────────────────────────────────────────────────────────────

function AssigneeCell({ task }: { task: KpiTask }) {
  const { t } = useTranslation('tasks')
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const myId = useAuthStore((s) => s.user?.id)
  const { data: sidebar } = useTaskSidebar(open)
  const m = useTaskMutations()
  const noKpi = task.kpiState === 'NONE'
  const { data: people = [] } = useQuery({
    queryKey: ['kpi-tasks', 'assignable-users', noKpi ? 'all' : 'kpi'],
    queryFn: () => taskApi.assignableUsers('', noKpi),
    enabled: open,
    staleTime: 60_000,
  })
  const ids = task.assignees.map((a) => a.id)
  const multi = sidebar?.multiAssignee ?? true
  const options = useMemo(() => {
    const k = q.trim().toLowerCase()
    const merged = [...task.assignees.map((a) => ({ id: a.id, name: a.fullName ?? '', avatarUrl: a.avatarUrl, groupName: null as string | null })),
      ...people.filter((p) => !ids.includes(p.id)).map((p) => ({ id: p.id, name: p.name, avatarUrl: p.avatarUrl, groupName: p.groupName }))]
    return merged.filter((o) => !k || o.name.toLowerCase().includes(k)).slice(0, 60)
  }, [people, task.assignees, ids, q])

  const save = (next: string[]) => {
    if (!next.length) return
    m.setAssignees.mutate({ id: task.id, assigneeIds: next, version: task.version }, { onError })
  }
  const toggle = (id: string) => {
    if (!multi) { save([id]); setOpen(false); return }
    save(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])
  }

  if (!task.canReassign) return <div className="min-w-0 px-1.5"><AssigneeLabel task={task} /></div>
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cellBtn} aria-label={t('detail.assignees')}>
          {task.assignees.length ? <AssigneeLabel task={task} /> : <UserPlus size={16} className="text-[var(--color-muted-foreground)]" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <Input size="sm" autoFocus value={q} onChange={(e) => setQ(e.target.value)} prefix={<Search size={13} />} placeholder={t('picker.searchPerson')} />
        <div className="mt-2 max-h-72 overflow-y-auto">
          {options.map((o) => {
            const on = ids.includes(o.id)
            return (
              <button key={o.id} type="button" onClick={() => toggle(o.id)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-[var(--color-muted)]">
                <UserAvatar fullName={o.name} avatarUrl={o.avatarUrl} className="h-6 w-6 shrink-0 rounded-full text-[9px]"
                  fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{o.id === myId ? t('new.me', { name: o.name }) : o.name}</span>
                  {o.groupName && <span className="block truncate text-[11px] text-[var(--color-subtle-foreground)]">{o.groupName}</span>}
                </span>
                {ids[0] === o.id && ids.length > 1 && <Star size={12} className="text-[var(--color-warning)]" aria-label={t('assignees.makePrimary')} />}
                {on && <Check size={14} className="text-[var(--color-primary)]" />}
              </button>
            )
          })}
          {options.length === 0 && <p className="p-2 text-xs text-[var(--color-subtle-foreground)]">{t('assign.noPeople')}</p>}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ── Ngày bắt đầu / hạn ───────────────────────────────────────────────────────────────────────────

function DateCell({ task, kind, editable }: { task: KpiTask; kind: 'start' | 'due'; editable: boolean }) {
  const { update } = useTaskMutations()
  const now = useNow()
  // Như Lark: "Ngày mai, 18:00 🔔 ↻" (chuông khi có nhắc, vòng khi lặp); quá hạn chữ đỏ. Đếm ngược "Còn 2 giờ" chỉ ở chú thích.
  const countdown = kind === 'due' ? dueCountdown(task, now) : null
  const date = kind === 'due' ? task.dueDate : task.startDate
  const text = date ? larkDay(date, kind === 'due' ? task.dueTime : task.startTime) : ''
  const dueClass = kind === 'due' && (task.overdue || countdown?.overdue) && !isClosed(task) ? 'text-[var(--color-error)]' : 'text-[var(--color-foreground)]'
  const icons = kind === 'due' && date && (
    <span className="flex shrink-0 items-center gap-1 text-[var(--color-subtle-foreground)]">
      {(task.reminders?.length ?? 0) > 0 && <Bell size={13} />}
      {task.recurrence && <Repeat size={13} />}
    </span>
  )
  if (!editable) {
    if (!date) return dash
    return <span className={cn('flex min-w-0 items-center gap-1.5 px-1.5 text-sm', dueClass)} title={countdown?.label}><span className="truncate">{text}</span>{icons}</span>
  }
  const value = kind === 'due' ? { date: task.dueDate, time: task.dueTime?.slice(0, 5) ?? null } : { date: task.startDate, time: null }
  return (
    <TaskDuePicker size="sm" compact value={value} placeholder="" display={text} suffix={icons || undefined}
      tone={kind === 'due' ? dueClass : 'text-[var(--color-foreground)]'} title={countdown?.label}
      className="h-8 border-transparent bg-transparent px-1.5 text-sm shadow-none hover:border-[var(--color-border)]"
      onChange={(v) => {
        const input = kind === 'due'
          ? (v.date ? { version: task.version, dueDate: v.date, ...(v.time ? { dueTime: `${v.time}:00` } : { clearDueTime: true }) }
            : { version: task.version, clearDueDate: true })
          : (v.date ? { version: task.version, startDate: v.date } : { version: task.version, clearStartDate: true })
        update.mutate({ id: task.id, input }, { onError })
      }} />
  )
}

// ── Ưu tiên ──────────────────────────────────────────────────────────────────────────────────────

function PriorityCell({ task, editable }: { task: KpiTask; editable: boolean }) {
  const { t } = useTranslation('tasks')
  const { update } = useTaskMutations()
  return (
    <Select value={task.priority} disabled={!editable}
      onValueChange={(v) => update.mutate({ id: task.id, input: { version: task.version, priority: v as KpiTask['priority'] } }, { onError })}>
      <SelectTrigger className="h-8 w-full gap-1 border-transparent bg-transparent px-1.5 text-sm shadow-none hover:border-[var(--color-border)] disabled:opacity-100 relative [&>svg:last-child]:absolute [&>svg:last-child]:right-1 [&>svg:last-child]:opacity-0 hover:[&>svg:last-child]:opacity-100">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TASK_PRIORITIES.map((p) => (
          <SelectItem key={p} value={p}>
            <span className="inline-flex items-center gap-1.5"><Flag size={12} style={{ color: PRIORITY_COLOR[p] }} /> {t(`priority.${p}`)}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ── Nhãn ─────────────────────────────────────────────────────────────────────────────────────────

function TagsCell({ task, editable }: { task: KpiTask; editable: boolean }) {
  const m = useTaskMutations()
  const chips = task.tags.length ? (
    <span className="flex min-w-0 gap-1 overflow-hidden">{task.tags.map((g) => <TagChip key={g.id} tag={g} />)}</span>
  ) : dash
  if (!editable) return <div className="min-w-0 px-1.5">{chips}</div>
  return (
    <Popover>
      <PopoverTrigger asChild><button type="button" className={cellBtn}>{chips}</button></PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <TagPicker value={task.tags.map((g) => g.id)} onChange={(ids) => m.setTags.mutate({ id: task.id, tagIds: ids }, { onError })} />
      </PopoverContent>
    </Popover>
  )
}

// ── Trường tuỳ chỉnh ─────────────────────────────────────────────────────────────────────────────

function FieldCellEditor({ task, field, editable }: { task: KpiTask; field: TaskListField; editable: boolean }) {
  const text = useFieldText()
  const v = task.fieldValues.find((x) => x.fieldId === field.id)?.value
  const label = text(field, v)
  const color = field.type === 'SINGLE_SELECT' ? field.options.find((o) => o.id === v)?.color : null
  const shown = label == null ? dash : color ? (
    <span className="max-w-full truncate rounded px-1.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>{label}</span>
  ) : <span className="truncate text-xs text-[var(--color-foreground)]">{label}</span>
  if (!editable) return <div className="min-w-0 px-1.5">{shown}</div>
  return (
    <Popover>
      <PopoverTrigger asChild><button type="button" className={cellBtn} title={field.name}>{shown}</button></PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <p className="mb-2 text-xs font-medium text-[var(--color-subtle-foreground)]">{field.name}</p>
        <FieldEditor task={task} field={field} editable />
      </PopoverContent>
    </Popover>
  )
}
