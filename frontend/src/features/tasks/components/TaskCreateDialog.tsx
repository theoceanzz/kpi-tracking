import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChevronDown, Link2, Loader2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import DraftNotice from '@/components/common/DraftNotice'
import GroupedPicker from './GroupedPicker'
import PeopleMultiPicker from './PeopleMultiPicker'
import TagPicker from './TagPicker'
import TaskDuePicker from './TaskDuePicker'
import { useStateDraft } from '@/hooks/useFormDraft'
import { useAuthStore } from '@/store/authStore'
import { useFormAssistStore } from '@/store/formAssistStore'
import { getApiErrorMessage } from '@/lib/apiError'
import { taskApi } from '../api/taskApi'
import { useTaskListDetail, useTaskMutations, useTaskSidebar } from '../hooks/useTasks'
import { taskFormSchema } from '../schemas/taskFormSchema'
import {
  TASK_PRIORITIES, type TaskCompletionMode, type TaskPriority, type TaskSourceRef, type TaskVisibility,
} from '../types'
import { blockedByTour } from '@/components/common/tours/guard'
import { tourAnchor } from '@/components/common/tours/anchors'

interface Form {
  title: string
  assigneeIds: string[]
  completionMode: TaskCompletionMode
  kpiId: string
  listId: string
  sectionId: string
  startDate: string
  dueDate: string
  dueTime: string
  priority: TaskPriority
  description: string
  visibility: TaskVisibility
  checklist: string
  tagIds: string[]
}

export interface TaskCreateDefaults {
  kpiId?: string
  dueDate?: string
  /** HH:mm — bấm ô giờ trên lưới tuần của Lịch. */
  dueTime?: string
  listId?: string
  sectionId?: string | null
  title?: string
  description?: string
  sourceRef?: TaskSourceRef | null
}

interface Props {
  open: boolean
  onClose: () => void
  /** Điền sẵn (đang lọc theo KPI / danh sách, bấm ô ngày trên Lịch, tạo từ bình luận / tài liệu). */
  defaults?: TaskCreateDefaults
  onCreated?: (taskId: string) => void
}

const NONE = '__none__'

/**
 * Hộp tạo việc: tên, người thực hiện (nhiều người nếu tổ chức bật), hạn, ưu tiên, KPI (TUỲ CHỌN), danh sách + nhóm;
 * "Thêm chi tiết" mở ngày bắt đầu, kiểu hoàn thành, mô tả, phạm vi xem, nhãn, checklist. Việc không KPI giao được cho
 * mọi người trong tổ chức; có KPI thì người thực hiện phải thuộc KPI (máy chủ kiểm). Giữ nháp; K.AI điền hộ được.
 */
export default function TaskCreateDialog({ open, onClose, defaults, onCreated }: Props) {
  const { t } = useTranslation('tasks')
  const myId = useAuthStore((s) => s.user?.id) ?? ''
  const { data: sidebar } = useTaskSidebar(open)
  const multi = sidebar?.multiAssignee ?? true
  const empty = (): Form => ({
    title: defaults?.title ?? '', assigneeIds: myId ? [myId] : [], completionMode: 'ANY', kpiId: defaults?.kpiId ?? '',
    listId: defaults?.listId ?? '', sectionId: defaults?.sectionId ?? '', startDate: '', dueDate: defaults?.dueDate ?? '', dueTime: '',
    priority: 'MEDIUM', description: defaults?.description ?? '', visibility: 'KPI_SCOPE', checklist: '', tagIds: [],
  })
  const [form, setForm] = useState<Form>(empty)
  const [more, setMore] = useState(false)
  const draft = useStateDraft(form, setForm, { key: 'task:new', enabled: open && !defaults?.sourceRef })
  const { create } = useTaskMutations()
  const formRef = useRef(form)
  useEffect(() => { formRef.current = form }, [form])

  // Mở lại với điền sẵn khác ⇒ áp điền sẵn lên form (chỉnh state trong render, không effect).
  const defaultsKey = open ? JSON.stringify(defaults ?? {}) + myId : ''
  const [lastDefaults, setLastDefaults] = useState('')
  if (defaultsKey !== lastDefaults) {
    setLastDefaults(defaultsKey)
    if (defaultsKey) {
      setForm((f) => ({
        ...f,
        kpiId: defaults?.kpiId ?? f.kpiId,
        dueDate: defaults?.dueDate ?? f.dueDate,
        dueTime: defaults?.dueTime ?? f.dueTime,
        listId: defaults?.listId ?? f.listId,
        sectionId: defaults?.sectionId ?? f.sectionId,
        title: defaults?.title ?? f.title,
        description: defaults?.description ?? f.description,
        assigneeIds: f.assigneeIds.length ? f.assigneeIds : myId ? [myId] : [],
      }))
      if (defaults?.description) setMore(true)
    }
  }

  // Có KPI ⇒ chỉ người mình được giao trên KPI; không KPI ⇒ cả tổ chức.
  const { data: people = [] } = useQuery({
    queryKey: ['kpi-tasks', 'assignable-users', form.kpiId ? 'kpi' : 'all'],
    queryFn: () => taskApi.assignableUsers('', !form.kpiId),
    enabled: open,
    staleTime: 60_000,
  })
  const primary = form.assigneeIds[0] || myId
  const { data: kpis = [] } = useQuery({
    queryKey: ['kpi-tasks', 'assignable-kpis', primary],
    queryFn: () => taskApi.assignableKpis(primary),
    enabled: open,
    staleTime: 60_000,
  })
  const kpiValid = !form.kpiId || kpis.some((k) => k.id === form.kpiId)
  const lists = (sidebar?.lists ?? []).filter((l) => !l.archived && (l.role === 'OWNER' || l.role === 'EDITOR'))
  const { data: list } = useTaskListDetail(open && form.listId ? form.listId : null)

  // Giới thiệu hộp này với K.AI trong lúc mở (tool suggest_task_form).
  useEffect(() => {
    if (!open) return
    const { register, unregister } = useFormAssistStore.getState()
    register({
      formId: 'task_form',
      getValues: () => {
        const f = formRef.current
        return { title: f.title, description: f.description, startDate: f.startDate, dueDate: f.dueDate, priority: f.priority,
          assigneeIds: f.assigneeIds, kpiId: f.kpiId }
      },
      fillableFields: () => ['title', 'description', 'startDate', 'dueDate', 'priority', 'assigneeIds', 'kpiId'],
      setValue: (field, value) => {
        if (field === 'description' || field === 'startDate') setMore(true)
        setForm((f) => ({ ...f, [field]: field === 'assigneeIds' ? (multi ? value as string[] : (value as string[]).slice(0, 1)) : (value ?? '') }))
      },
    })
    return () => unregister('task_form')
  }, [open, multi])

  const submit = () => {
    if (blockedByTour()) return
    const parsed = taskFormSchema().safeParse({
      title: form.title, description: form.description || undefined, startDate: form.startDate || undefined,
      dueDate: form.dueDate || undefined, priority: form.priority, assigneeIds: form.assigneeIds, kpiId: form.kpiId || undefined,
    })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t('validation.titleRequired'))
      return
    }
    create.mutate({
      title: form.title,
      kpiId: form.kpiId || null,
      assigneeIds: form.assigneeIds.length ? form.assigneeIds : undefined,
      completionMode: form.assigneeIds.length > 1 ? form.completionMode : undefined,
      startDate: form.startDate || null,
      dueDate: form.dueDate || null,
      dueTime: form.dueDate && form.dueTime ? `${form.dueTime}:00` : null,
      priority: form.priority,
      description: form.description || null,
      visibility: form.visibility,
      checklist: form.checklist.split('\n').map((s) => s.trim()).filter(Boolean),
      listId: form.listId || undefined,
      sectionId: form.listId && form.sectionId ? form.sectionId : undefined,
      tagIds: form.tagIds.length ? form.tagIds : undefined,
      sourceRef: defaults?.sourceRef ?? undefined,
    }, {
      onSuccess: (task) => {
        draft.clear()
        setForm(empty())
        setMore(false)
        onClose()
        onCreated?.(task.id)
      },
      onError: (e) => toast.error(getApiErrorMessage(e)),
    })
  }

  const label = (text: string) => <span className="text-xs font-medium text-[var(--color-subtle-foreground)]">{text}</span>

  return (
    <Dialog {...tourAnchor('task.form')} open={open} onClose={onClose} size="lg" title={t('new.title')}
      footer={<DialogFooter
        secondary={<Button variant="outline" onClick={onClose}>{t('detail.close')}</Button>}
        primary={<Button {...tourAnchor('task.form.submit')} disabled={!form.title.trim() || !kpiValid || create.isPending} onClick={submit}>
          {create.isPending && <Loader2 className="animate-spin" />} {t('new.create')}
        </Button>}
      />}>
      <div className="space-y-4">
        <DraftNotice draft={draft} />
        {defaults?.sourceRef && (
          <p className="flex items-center gap-1.5 rounded-md bg-[var(--color-muted)] px-2 py-1.5 text-xs text-[var(--color-subtle-foreground)]">
            <Link2 size={12} /> {t(`source.${defaults.sourceRef.type}`)}{defaults.sourceRef.label ? `: ${defaults.sourceRef.label}` : ''}
          </p>
        )}
        <Input {...tourAnchor('task.form.title')} autoFocus value={form.title} maxLength={255} placeholder={t('new.titlePlaceholder')}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && form.title.trim() && kpiValid) submit() }} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div {...tourAnchor('task.form.owner')} className="space-y-1 sm:col-span-2">
            {label(multi ? t('detail.assignees') : t('detail.owner'))}
            <PeopleMultiPicker options={people} value={form.assigneeIds} single={!multi} meId={myId}
              onChange={(ids) => setForm({ ...form, assigneeIds: ids, kpiId: ids[0] !== form.assigneeIds[0] ? '' : form.kpiId })} />
            {!form.kpiId && <p className="text-[11px] text-[var(--color-subtle-foreground)]">{t('new.anyoneHint')}</p>}
          </div>
          <label {...tourAnchor('task.form.due')} className="block space-y-1">
            {label(t('detail.dueDate'))}
            <TaskDuePicker value={{ date: form.dueDate || null, time: form.dueTime || null }}
              onChange={(v) => setForm({ ...form, dueDate: v.date ?? '', dueTime: v.time ?? '' })} />
          </label>
          <label {...tourAnchor('task.form.priority')} className="block space-y-1">
            {label(t('detail.priority'))}
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TaskPriority })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TASK_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{t(`priority.${p}`)}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <label {...tourAnchor('task.form.kpi')} className="block space-y-1">
            {label(t('new.kpiOptional'))}
            <GroupedPicker options={kpis} value={kpiValid && form.kpiId ? form.kpiId : null} onChange={(v) => setForm({ ...form, kpiId: v ?? '' })}
              clearable clearLabel={t('new.noKpi')} placeholder={t('new.kpiPlaceholderOptional')} searchPlaceholder={t('picker.searchKpi')}
              collapseNonCurrent groupOrder="desc" moreLabel={(n) => t('picker.morePeriods', { count: n })} emptyLabel={t('new.noKpiOptions')} />
          </label>
          <label className="block space-y-1">
            {label(t('new.list'))}
            <Select value={form.listId || NONE} onValueChange={(v) => setForm({ ...form, listId: v === NONE ? '' : v, sectionId: '' })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t('new.noList')}</SelectItem>
                {lists.map((l) => <SelectItem key={l.listId} value={l.listId}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          {form.listId && (list?.sections.length ?? 0) > 0 && (
            <label className="block space-y-1">
              {label(t('new.section'))}
              <Select value={form.sectionId || NONE} onValueChange={(v) => setForm({ ...form, sectionId: v === NONE ? '' : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t('group.noSection')}</SelectItem>
                  {list!.sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
          )}
        </div>

        {!more ? (
          <Button {...tourAnchor('task.form.more')} variant="ghost" size="sm" onClick={() => setMore(true)}><ChevronDown /> {t('new.moreDetails')}</Button>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                {label(t('detail.startDate'))}
                <Input type="date" value={form.startDate} max={form.dueDate || undefined} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </label>
              <label className="block space-y-1">
                {label(t('detail.visibility'))}
                <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v as TaskVisibility })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KPI_SCOPE">{t('visibility.KPI_SCOPE')}</SelectItem>
                    <SelectItem value="PRIVATE">{t('visibility.PRIVATE')}</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              {form.assigneeIds.length > 1 && (
                <label className="block space-y-1 sm:col-span-2">
                  {label(t('detail.completionMode'))}
                  <Select value={form.completionMode} onValueChange={(v) => setForm({ ...form, completionMode: v as TaskCompletionMode })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ANY">{t('completion.ANY')}</SelectItem>
                      <SelectItem value="ALL">{t('completion.ALL')}</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              )}
            </div>
            <div className="space-y-1">
              {label(t('detail.tags'))}
              <TagPicker value={form.tagIds} onChange={(ids) => setForm({ ...form, tagIds: ids })} />
            </div>
            <label className="block space-y-1">
              {label(t('detail.description'))}
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <label className="block space-y-1">
              {label(t('new.checklistLines'))}
              <Textarea rows={3} value={form.checklist} placeholder={t('new.checklistPlaceholder')} onChange={(e) => setForm({ ...form, checklist: e.target.value })} />
            </label>
          </div>
        )}
      </div>
    </Dialog>
  )
}
