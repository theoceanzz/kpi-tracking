import { useState, type ReactNode } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  CalendarClock, Check, ChevronDown, ChevronRight, CircleDot, Flag, Link2, ListChecks, Lock, Plus, Search, SlidersHorizontal, Tag,
  Target, User, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/store/authStore'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { taskApi } from '../api/taskApi'
import { listApi, mySectionApi } from '../api/listApi'
import GroupedPicker from './GroupedPicker'
import PeopleMultiPicker from './PeopleMultiPicker'
import TagPicker from './TagPicker'
import TaskTimeField from './TaskTimeField'
import { useFieldText } from '../hooks/useFieldText'
import { useFollowerRemovalConfirm } from '../hooks/useFollowerRemovalConfirm'
import { taskKeys, useMySections, useTaskListDetail, useTaskMutations, useTaskSidebar } from '../hooks/useTasks'
import { placeholderBtn, PRIORITY_COLOR } from '../taskUtils'
import {
  TASK_PRIORITIES, TASK_STATUSES, type KpiTask, type TaskCompletionMode, type TaskListField, type UpdateTaskInput,
} from '../types'

interface Props {
  task: KpiTask
  editable: boolean
  /** Lưu một thay đổi (bảng chi tiết lo version + hỏi "lần này / các lần sau" với việc lặp). */
  save: (input: Omit<UpdateTaskInput, 'version'>) => void
  onStatus: (status: KpiTask['status']) => void
}

/**
 * Một dòng thuộc tính đúng kiểu Lark: CHỈ icon ở cột trái (tên thuộc tính để ở chú thích khi rê chuột), giá trị bên phải;
 * ô trống là chữ xám mời bấm ("Thêm vào danh sách"…). Icon thẳng hàng với dòng đầu của giá trị.
 */
export function PropRow({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-start gap-3">
      <span className="flex h-8 w-5 shrink-0 items-center justify-center text-[var(--color-subtle-foreground)]" title={title} aria-label={title}>{icon}</span>
      <div className="flex min-h-8 min-w-0 flex-1 flex-wrap items-center gap-1.5 text-sm [&>*]:max-w-full">{children}</div>
    </div>
  )
}

const onError = (e: unknown) => toast.error(getApiErrorMessage(e))

/** Ô chọn trong dòng thuộc tính: rộng vừa chữ, viền chỉ hiện khi rê. */
const inlineSelect = 'h-8 w-fit max-w-full gap-2 border-transparent px-1.5 shadow-none hover:border-[var(--color-border)]'

/**
 * Các dòng thuộc tính của bảng chi tiết theo đúng thứ tự của Lark: người thực hiện | nhóm của tôi · thời gian · danh sách
 * — rồi các thuộc tính KeyGo buộc phải có (trạng thái, ưu tiên, KPI, nhãn, nguồn), cùng kiểu dòng chỉ-icon. Trường của
 * danh sách nằm trong khối thu gọn "Trường của danh sách" như "List field" của Lark (chỗ duy nhất có nhãn chữ).
 */
export default function TaskProperties({ task, editable, save, onStatus }: Props) {
  const { t } = useTranslation('tasks')
  const root = !task.parentTaskId
  return (
    <div className="space-y-0.5">
      <PropRow icon={<User size={16} />} title={t('detail.assignees')}>
        <AssigneesEditor task={task} editable={editable} save={save} />
        <span className="mx-1 h-4 w-px shrink-0 bg-[var(--color-border)]" aria-hidden />
        <MySectionPicker task={task} />
      </PropRow>
      <PropRow icon={<CalendarClock size={16} />} title={t('detail.time')}>
        <TaskTimeField task={task} editable={editable} save={save} />
      </PropRow>
      {root && (
        <PropRow icon={<ListChecks size={16} />} title={t('detail.lists')}>
          <ListsEditor task={task} />
        </PropRow>
      )}
      <PropRow icon={<CircleDot size={16} />} title={t('detail.status')}>
        <Select value={task.status} disabled={!editable} onValueChange={(v) => onStatus(v as KpiTask['status'])}>
          <SelectTrigger className={inlineSelect} aria-label={t('detail.status')}><SelectValue /></SelectTrigger>
          <SelectContent>{TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>)}</SelectContent>
        </Select>
      </PropRow>
      <PropRow icon={<Flag size={16} />} title={t('detail.priority')}>
        <Select value={task.priority} disabled={!editable} onValueChange={(v) => save({ priority: v as KpiTask['priority'] })}>
          <SelectTrigger className={inlineSelect} aria-label={t('detail.priority')}><SelectValue /></SelectTrigger>
          <SelectContent>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                <span className="inline-flex items-center gap-2"><Flag size={12} style={{ color: PRIORITY_COLOR[p] }} /> {t(`priority.${p}`)}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PropRow>
      <PropRow icon={<Target size={16} />} title={t('detail.kpi')}>
        <KpiEditor task={task} />
      </PropRow>
      <PropRow icon={<Tag size={16} />} title={t('detail.tags')}>
        <TagsEditor task={task} editable={editable} />
      </PropRow>
      {root && task.visibility === 'PRIVATE' && (
        <PropRow icon={<Lock size={16} />} title={t('detail.visibility')}>
          <span className="px-1.5 text-[var(--color-subtle-foreground)]">{t('visibility.PRIVATE')}</span>
        </PropRow>
      )}
      {task.sourceRef && (
        <PropRow icon={<Link2 size={16} />} title={t('detail.source')}>
          <SourceLink task={task} />
        </PropRow>
      )}
      {root && <ListFieldsBlock task={task} editable={editable} />}
    </div>
  )
}

/** Nhãn ghi thẳng (không đi qua "lần này / các lần sau" của việc lặp — nhãn không thuộc bản mẫu). */
function TagsEditor({ task, editable }: { task: KpiTask; editable: boolean }) {
  const m = useTaskMutations()
  return <TagPicker variant="lark" value={task.tags.map((g) => g.id)} disabled={!editable}
    onChange={(ids) => m.setTags.mutate({ id: task.id, tagIds: ids }, { onError })} />
}

// ── Nhóm của tôi (Lark: "Default Group ▾" cạnh người thực hiện) ─────────────────────────────────────

function MySectionPicker({ task }: { task: KpiTask }) {
  const { t } = useTranslation('tasks')
  const qc = useQueryClient()
  const m = useTaskMutations()
  const { data: sections = [] } = useMySections()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const current = sections.find((s) => s.id === task.mySectionId)
  const pick = (id: string | null) => {
    setOpen(false)
    if ((task.mySectionId ?? null) !== id) m.assignMySection.mutate({ taskId: task.id, sectionId: id }, { onError })
  }
  const name = q.trim()
  const exact = sections.some((s) => s.name.toLowerCase() === name.toLowerCase())
  const create = () => mySectionApi.create(name).then((s) => {
    qc.invalidateQueries({ queryKey: taskKeys.mySections })
    setQ('')
    pick(s.id)
  }).catch(onError)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" title={t('mySections.title')}
          className="inline-flex h-8 max-w-[200px] items-center gap-1 rounded-md px-1.5 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-muted)]">
          <span className="truncate">{current?.name ?? t('group.noMySection')}</span><ChevronDown size={14} className="shrink-0 text-[var(--color-subtle-foreground)]" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2" align="start">
        <Input size="sm" value={q} autoFocus onChange={(e) => setQ(e.target.value)} prefix={<Search size={13} />} placeholder={t('mySections.searchOrCreate')}
          onKeyDown={(e) => { if (e.key === 'Enter' && name && !exact) { e.preventDefault(); void create() } }} />
        <div className="mt-2 max-h-60 overflow-y-auto">
          {[{ id: null as string | null, name: t('group.noMySection') }, ...sections]
            .filter((s) => !name || s.name.toLowerCase().includes(name.toLowerCase()))
            .map((s) => (
              <button key={s.id ?? 'none'} type="button" onClick={() => pick(s.id)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--color-muted)]">
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                {(task.mySectionId ?? null) === s.id && <Check size={14} className="text-[var(--color-primary)]" />}
              </button>
            ))}
          {name && !exact && (
            <button type="button" onClick={() => void create()} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-[var(--color-primary)] hover:bg-[var(--color-muted)]">
              <Plus size={13} /> {t('mySections.createNamed', { name })}
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ── Người thực hiện ──────────────────────────────────────────────────────────────────────────────

function AssigneesEditor({ task, editable, save }: { task: KpiTask; editable: boolean; save: Props['save'] }) {
  const { t } = useTranslation('tasks')
  const myId = useAuthStore((s) => s.user?.id)
  const m = useTaskMutations()
  const { data: sidebar } = useTaskSidebar()
  const noKpi = task.kpiState === 'NONE'
  const single = !(sidebar?.multiAssignee ?? true)
  const { data: people = [] } = useQuery({
    queryKey: ['kpi-tasks', 'assignable-users', noKpi ? 'all' : 'kpi'],
    queryFn: () => taskApi.assignableUsers('', noKpi),
    enabled: task.canReassign,
    staleTime: 60_000,
  })
  // Người đang thực hiện luôn có trong ô chọn (dù người gọi không giao được cho họ).
  const options = [...people, ...task.assignees.filter((a) => !people.some((p) => p.id === a.id)).map((a) => ({
    id: a.id, name: a.fullName ?? '…', secondary: null, avatarUrl: a.avatarUrl, detail: null, groupId: null, groupName: null,
    groupCurrent: true, groupSort: '~',
  }))]
  const ids = task.assignees.map((a) => a.id)
  // Chân hộp chọn người như Lark: "Việc hoàn thành khi một người / tất cả hoàn thành ▾".
  const footer = single ? undefined : (
    <Select value={task.completionMode} disabled={!editable} onValueChange={(v) => save({ completionMode: v as TaskCompletionMode })}>
      <SelectTrigger className="h-8 w-full gap-2 border-transparent px-1.5 shadow-none hover:border-[var(--color-border)]"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="ANY">{t('completion.whenAny')}</SelectItem>
        <SelectItem value="ALL">{t('completion.whenAll')}</SelectItem>
      </SelectContent>
    </Select>
  )
  return (
    <PeopleMultiPicker variant="lark" options={options} value={ids} single={single} meId={myId} disabled={!task.canReassign}
      placeholder={t('assignees.addLark')} footer={footer}
      onChange={(next) => next.length && m.setAssignees.mutate({ id: task.id, assigneeIds: next, version: task.version }, { onError })} />
  )
}

// ── KPI (gắn / đổi / gỡ) ─────────────────────────────────────────────────────────────────────────

function KpiEditor({ task }: { task: KpiTask }) {
  const { t } = useTranslation('tasks')
  const m = useTaskMutations()
  const removal = useFollowerRemovalConfirm()
  const [editing, setEditing] = useState(false)
  const { data: kpis = [], isFetching } = useQuery({
    queryKey: ['kpi-tasks', 'assignable-kpis', task.ownerId],
    queryFn: () => taskApi.assignableKpis(task.ownerId),
    enabled: editing,
    staleTime: 30_000,
  })
  const change = (kpiId: string | null) => {
    setEditing(false)
    if (kpiId === task.kpiId) return
    void removal.start({
      preview: () => (kpiId ? taskApi.assignImpact(task.id, kpiId) : Promise.resolve([])),
      commit: (confirmed) => m.setKpi.mutateAsync({ id: task.id, kpiId, version: task.version, confirmedFollowerRemovals: confirmed }),
      onSuccess: () => toast.success(kpiId ? t('kpiLink.linked') : t('kpiLink.unlinked')),
      onError,
    })
  }

  // Chưa gắn KPI: chỉ một chữ xám mời bấm như các ô trống khác của Lark (không quyền gắn thì "Không gắn KPI").
  if (task.kpiState === 'NONE' && task.canSetKpi && !editing) {
    return <button type="button" onClick={() => setEditing(true)} className={placeholderBtn}>{t('kpiLink.link')}</button>
  }
  const current = task.kpiState === 'NONE'
    ? <span className="px-1.5 text-[var(--color-muted-foreground)]">{t('kpiLink.none')}</span>
    : task.kpiDeleted
      ? <span className="text-[var(--color-subtle-foreground)]">{t('row.kpiDeleted', { name: task.kpiName ?? '' })}</span>
      : <Link to={`/kpi/${task.kpiId}?tab=tasks`} className="truncate text-[var(--color-primary)] hover:underline">
          {task.kpiName}{task.kpiPeriodName ? ` · ${task.kpiPeriodName}` : ''}
        </Link>

  return (
    <div className="flex flex-wrap items-center gap-2">
      {editing ? (
        <div className="w-80">
          <GroupedPicker size="sm" options={kpis} value={task.kpiDeleted ? null : task.kpiId} loading={isFetching}
            onChange={(v) => change(v)} clearable={task.kpiState === 'ACTIVE'} clearLabel={t('kpiLink.unlink')}
            placeholder={t('kpiLink.pick')} searchPlaceholder={t('picker.searchKpi')} collapseNonCurrent groupOrder="desc"
            moreLabel={(n) => t('picker.morePeriods', { count: n })} emptyLabel={t('assign.noKpis')} />
        </div>
      ) : current}
      {task.canSetKpi && !editing && (
        <button type="button" onClick={() => setEditing(true)}
          className="rounded-md px-1.5 py-1 text-xs text-[var(--color-subtle-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]">
          {task.kpiState === 'NONE' ? t('kpiLink.link') : t('kpiLink.change')}
        </button>
      )}
      {editing && <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>{t('detail.close')}</Button>}
      {task.parentTaskId && task.kpiState !== 'NONE' && <span className="text-xs text-[var(--color-subtle-foreground)]">{t('kpiLink.followsRoot')}</span>}
      {removal.dialog}
    </div>
  )
}

// ── Danh sách ────────────────────────────────────────────────────────────────────────────────────

function ListsEditor({ task }: { task: KpiTask }) {
  const { t } = useTranslation('tasks')
  const m = useTaskMutations()
  const { data: sidebar } = useTaskSidebar()
  const editableLists = (sidebar?.lists ?? []).filter((l) => !l.archived && (l.role === 'OWNER' || l.role === 'EDITOR'))
  const canEditList = (listId: string) => editableLists.some((l) => l.listId === listId)
  const addable = editableLists.filter((l) => !task.lists.some((x) => x.listId === l.listId))
  const adder = (label: ReactNode) => (
    <Popover>
      <PopoverTrigger asChild><button type="button" className={placeholderBtn}>{label}</button></PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        {addable.map((l) => (
          <button key={l.listId} type="button" onClick={() => m.addToList.mutate({ listId: l.listId, taskId: task.id }, { onError })}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--color-muted)]">
            {l.icon ? <span className="w-4 text-center">{l.icon}</span> : <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color ?? 'var(--color-primary)' }} />} {l.name}
          </button>
        ))}
        {addable.length === 0 && <p className="p-2 text-xs text-[var(--color-subtle-foreground)]">{t('lists.noneToAdd')}</p>}
      </PopoverContent>
    </Popover>
  )
  if (task.lists.length === 0) return adder(t('lists.addToLark'))
  return (
    <div className="flex flex-col items-start gap-0.5">
      {task.lists.map((l) => (
        <ListChip key={l.listId} task={task} listId={l.listId} name={l.listName} color={l.color} sectionId={l.sectionId}
          sectionName={l.sectionName} editable={canEditList(l.listId)}
          onRemove={() => m.removeFromList.mutate({ listId: l.listId, taskId: task.id }, { onError })} />
      ))}
      {addable.length > 0 && adder(<span className="inline-flex items-center gap-1 text-xs"><Plus size={12} /> {t('lists.addToAnother')}</span>)}
    </div>
  )
}

function ListChip({ task, listId, name, color, sectionId, sectionName, editable, onRemove }: {
  task: KpiTask; listId: string; name: string; color: string | null; sectionId: string | null; sectionName: string | null
  editable: boolean; onRemove: () => void
}) {
  const { t } = useTranslation('tasks')
  const m = useTaskMutations()
  const [open, setOpen] = useState(false)
  const { data: list } = useTaskListDetail(open ? listId : null)
  // Lark: "A project  monitoring ▾" — tên danh sách rồi nhóm trong danh sách (bấm để chuyển nhóm).
  return (
    <span className="group inline-flex max-w-full items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[var(--color-muted)]">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color ?? 'var(--color-primary)' }} />
      <Link to={`/tasks?list=${listId}`} className="truncate hover:underline">{name}</Link>
      {editable ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="inline-flex items-center gap-0.5 text-[var(--color-subtle-foreground)] hover:text-[var(--color-foreground)]">
              {sectionName ?? t('group.noSection')} <ChevronDown size={13} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1" align="start">
            {[{ id: null as string | null, name: t('group.noSection') }, ...(list?.sections ?? [])].map((s) => (
              <button key={s.id ?? 'none'} type="button"
                onClick={() => { setOpen(false); m.moveInList.mutate({ listId, taskId: task.id, sectionId: s.id, clearSection: s.id === null }, { onError }) }}
                className={cn('flex w-full rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--color-muted)]', s.id === sectionId && 'font-medium text-[var(--color-primary)]')}>
                {s.name}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      ) : sectionName && <span className="text-[var(--color-subtle-foreground)]">{sectionName}</span>}
      {editable && (
        <button type="button" aria-label={t('lists.removeFrom')} onClick={onRemove}
          className="opacity-0 transition-opacity hover:text-[var(--color-error)] group-hover:opacity-60"><X size={12} /></button>
      )}
    </span>
  )
}

// ── Trường tuỳ chỉnh của một danh sách ───────────────────────────────────────────────────────────

/** "Trường của danh sách" (Lark: khối thu gọn "List field") — trường tuỳ chỉnh có NHÃN, gom theo từng danh sách. */
function ListFieldsBlock({ task, editable }: { task: KpiTask; editable: boolean }) {
  const { t } = useTranslation('tasks')
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('tasks.detail.listFields') !== '0' } catch { return true } })
  const lists = useQueries({ queries: task.lists.map((l) => ({ queryKey: taskKeys.taskList(l.listId), queryFn: () => listApi.get(l.listId), staleTime: 30_000 })) })
  const withFields = task.lists.filter((_, i) => (lists[i]?.data?.fields.length ?? 0) > 0)
  if (withFields.length === 0) return null
  const toggle = () => setOpen((v) => { try { localStorage.setItem('tasks.detail.listFields', v ? '0' : '1') } catch { /* bỏ qua */ } return !v })
  return (
    <div className="pt-1">
      <button type="button" onClick={toggle} className="inline-flex items-center gap-1 rounded-md px-0.5 py-1 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted)]">
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {t('detail.listFields')}
      </button>
      {open && withFields.map((l) => <ListFields key={l.listId} task={task} listId={l.listId} editable={editable} />)}
    </div>
  )
}

function ListFields({ task, listId, editable }: { task: KpiTask; listId: string; editable: boolean }) {
  const { data: list } = useTaskListDetail(listId)
  if (!list || list.fields.length === 0) return null
  return (
    <div className="space-y-0.5">
      {list.fields.map((f) => (
        <div key={f.id} className="flex min-h-9 items-center gap-3">
          <span className="flex w-32 shrink-0 items-center gap-2 truncate text-sm text-[var(--color-subtle-foreground)]" title={`${list.name} · ${f.name}`}>
            <SlidersHorizontal size={14} className="shrink-0" /> <span className="truncate">{f.name}</span>
          </span>
          <div className="min-w-0 flex-1 text-sm"><FieldEditor task={task} field={f} editable={editable} /></div>
        </div>
      ))}
    </div>
  )
}

export function FieldEditor({ task, field, editable }: { task: KpiTask; field: TaskListField; editable: boolean }) {
  const { t } = useTranslation('tasks')
  const m = useTaskMutations()
  const text = useFieldText()
  const value = task.fieldValues.find((v) => v.fieldId === field.id)?.value
  const set = (v: unknown) => m.setFieldValue.mutate({ id: task.id, fieldId: field.id, value: v }, { onError })
  const NONE = '__none__'
  const memberQuery = useQuery({
    queryKey: ['kpi-tasks', 'assignable-users', 'all'],
    queryFn: () => taskApi.assignableUsers('', true),
    enabled: field.type === 'MEMBER',
    staleTime: 60_000,
  })
  if (!editable) {
    const names = new Map((memberQuery.data ?? []).map((o) => [o.id, o.name]))
    return <span className="text-[var(--color-subtle-foreground)]">{text(field, value, names) ?? '—'}</span>
  }
  switch (field.type) {
    case 'SINGLE_SELECT':
      return (
        <Select value={(value as string) ?? NONE} onValueChange={(v) => set(v === NONE ? null : v)}>
          <SelectTrigger className="h-8 w-56 border-transparent shadow-none hover:border-[var(--color-border)]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            {field.options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                <span className="inline-flex items-center gap-2">{o.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: o.color }} />}{o.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    case 'MULTI_SELECT': {
      const cur = (value as string[] | undefined) ?? []
      return (
        <div className="flex flex-wrap gap-1">
          {field.options.map((o) => (
            <ChoiceChip key={o.id} size="sm" selected={cur.includes(o.id)}
              onClick={() => set(cur.includes(o.id) ? cur.filter((x) => x !== o.id) : [...cur, o.id])}>{o.label}</ChoiceChip>
          ))}
        </div>
      )
    }
    case 'CHECKBOX':
      return <Checkbox checked={value === true} onCheckedChange={(v) => set(!!v)} />
    case 'DATE':
      return <div className="w-48"><Input type="date" size="sm" value={(value as string) ?? ''} onChange={(e) => set(e.target.value || null)} /></div>
    case 'MEMBER':
      return (
        <PeopleMultiPicker options={memberQuery.data ?? []} value={(value as string[] | undefined) ?? []} placeholder={t('field.pickPeople')}
          onChange={(ids) => set(ids.length ? ids : null)} />
      )
    default:
      return <InlineText key={`${task.id}:${String(value ?? '')}`} value={value == null ? '' : String(value)} number={field.type === 'NUMBER'}
        onSave={(v) => set(v === '' ? null : field.type === 'NUMBER' ? Number(v) : v)} />
  }
}

function InlineText({ value, number, onSave }: { value: string; number?: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(value)
  return (
    <div className="w-64">
      <Input size="sm" type={number ? 'number' : 'text'} value={v} onChange={(e) => setV(e.target.value)}
        onBlur={() => { if (v !== value) onSave(v.trim()) }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
    </div>
  )
}

// ── Nguồn ────────────────────────────────────────────────────────────────────────────────────────

function SourceLink({ task }: { task: KpiTask }) {
  const { t } = useTranslation('tasks')
  const s = task.sourceRef!
  const href = s.type === 'COMMENT' && s.id ? `/discussions/c/${s.id}` : s.type === 'DOCUMENT' && s.id ? `/documents?doc=${s.id}` : null
  const label = `${t(`source.${s.type}`)}${s.label ? `: ${s.label}` : ''}`
  return href ? <Link to={href} className="truncate text-[var(--color-primary)] hover:underline">{label}</Link>
    : <span className="truncate text-[var(--color-subtle-foreground)]">{label}</span>
}
