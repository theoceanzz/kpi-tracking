import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChevronDown, Loader2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import DraftNotice from '@/components/common/DraftNotice'
import GroupedPicker from './GroupedPicker'
import TaskDuePicker from './TaskDuePicker'
import { useStateDraft } from '@/hooks/useFormDraft'
import { useAuthStore } from '@/store/authStore'
import { getApiErrorMessage } from '@/lib/apiError'
import { taskApi } from '../api/taskApi'
import { useTaskMutations } from '../hooks/useTasks'
import { TASK_PRIORITIES, type TaskPriority, type TaskVisibility } from '../types'
import { blockedByTour } from '@/components/common/tours/guard'
import { tourAnchor } from '@/components/common/tours/anchors'

interface Form {
  title: string
  ownerId: string
  kpiId: string
  dueDate: string
  dueTime: string
  priority: TaskPriority
  description: string
  visibility: TaskVisibility
  checklist: string
}

interface Props {
  open: boolean
  onClose: () => void
  /** Điền sẵn (đang lọc theo KPI / bấm ô ngày trên Lịch). */
  defaults?: { kpiId?: string; dueDate?: string }
  onCreated?: (taskId: string) => void
}

/**
 * Hộp tạo nhanh: tên, KPI, người phụ trách, hạn, ưu tiên; "Thêm chi tiết" mở thêm giờ hạn, mô tả, phạm vi xem,
 * checklist. Người phụ trách đổi ⇒ danh sách KPI đổi theo (task luôn gắn KPI của người phụ trách). Giữ nháp.
 */
export default function TaskCreateDialog({ open, onClose, defaults, onCreated }: Props) {
  const { t } = useTranslation('tasks')
  const myId = useAuthStore((s) => s.user?.id) ?? ''
  const empty = (): Form => ({
    title: '', ownerId: myId, kpiId: defaults?.kpiId ?? '', dueDate: defaults?.dueDate ?? '', dueTime: '',
    priority: 'MEDIUM', description: '', visibility: 'KPI_SCOPE', checklist: '',
  })
  const [form, setForm] = useState<Form>(empty)
  const [more, setMore] = useState(false)
  const draft = useStateDraft(form, setForm, { key: 'task:new', enabled: open })
  const { create } = useTaskMutations()

  // Mở lại với điền sẵn khác (ô ngày khác trên Lịch) ⇒ áp điền sẵn lên form (chỉnh state trong render, không effect).
  const defaultsKey = open ? `${defaults?.kpiId ?? ''}|${defaults?.dueDate ?? ''}|${myId}` : ''
  const [lastDefaults, setLastDefaults] = useState('')
  if (defaultsKey !== lastDefaults) {
    setLastDefaults(defaultsKey)
    if (defaultsKey) {
      setForm((f) => ({ ...f, kpiId: defaults?.kpiId ?? f.kpiId, dueDate: defaults?.dueDate ?? f.dueDate, ownerId: f.ownerId || myId }))
    }
  }

  const { data: people = [] } = useQuery({
    queryKey: ['kpi-tasks', 'assignable-users', ''],
    queryFn: () => taskApi.assignableUsers(''),
    enabled: open,
    staleTime: 60_000,
  })
  const { data: kpis = [] } = useQuery({
    queryKey: ['kpi-tasks', 'assignable-kpis', form.ownerId || myId],
    queryFn: () => taskApi.assignableKpis(form.ownerId || myId),
    enabled: open,
    staleTime: 60_000,
  })
  const kpiValid = kpis.some((k) => k.id === form.kpiId)

  const submit = () => {
    if (blockedByTour()) return
    create.mutate({
      title: form.title,
      kpiId: form.kpiId,
      ownerId: form.ownerId && form.ownerId !== myId ? form.ownerId : undefined,
      dueDate: form.dueDate || null,
      dueTime: form.dueDate && form.dueTime ? `${form.dueTime}:00` : null,
      priority: form.priority,
      description: form.description || null,
      visibility: form.visibility,
      checklist: form.checklist.split('\n').map((s) => s.trim()).filter(Boolean),
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
    <Dialog {...tourAnchor('task.form')} open={open} onClose={onClose} size="md" title={t('new.title')}
      footer={<DialogFooter
        secondary={<Button variant="outline" onClick={onClose}>{t('detail.close')}</Button>}
        primary={<Button {...tourAnchor('task.form.submit')} disabled={!form.title.trim() || !kpiValid || create.isPending} onClick={submit}>
          {create.isPending && <Loader2 className="animate-spin" />} {t('new.create')}
        </Button>}
      />}>
      <div className="space-y-4">
        <DraftNotice draft={draft} />
        <Input {...tourAnchor('task.form.title')} autoFocus value={form.title} maxLength={255} placeholder={t('new.titlePlaceholder')}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && form.title.trim() && kpiValid) submit() }} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label {...tourAnchor('task.form.owner')} className="block space-y-1">
            {label(t('detail.owner'))}
            <GroupedPicker people options={people} value={form.ownerId || myId}
              onChange={(v) => setForm({ ...form, ownerId: v ?? myId, kpiId: '' })}
              placeholder={t('picker.pickPerson')} searchPlaceholder={t('picker.searchPerson')}
              labelOf={(o) => (o.id === myId ? t('new.me', { name: o.name }) : o.name)} />
          </label>
          <label {...tourAnchor('task.form.kpi')} className="block space-y-1">
            {label(`${t('detail.kpi')} *`)}
            <GroupedPicker options={kpis} value={kpiValid ? form.kpiId : null} onChange={(v) => setForm({ ...form, kpiId: v ?? '' })}
              placeholder={t('new.kpiPlaceholder')} searchPlaceholder={t('picker.searchKpi')} collapseNonCurrent groupOrder="desc"
              moreLabel={(n) => t('picker.morePeriods', { count: n })} emptyLabel={t('new.noKpi')} />
          </label>
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
        </div>

        {!more ? (
          <Button {...tourAnchor('task.form.more')} variant="ghost" size="sm" onClick={() => setMore(true)}><ChevronDown /> {t('new.moreDetails')}</Button>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
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
