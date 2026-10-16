import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AtSign, CalendarDays, Clock, Flag, Hash, Loader2, Plus } from 'lucide-react'
import { formatDate } from '@/i18n/format'
import { getApiErrorMessage } from '@/lib/apiError'
import { taskApi } from '../api/taskApi'
import { useRefreshTasks, useTaskMutations, useTaskTags } from '../hooks/useTasks'
import { mySectionApi } from '../api/listApi'
import { PRIORITY_COLOR, todayIso, type GroupPreset } from '../taskUtils'
import { parseQuickAdd } from '../quickAddParser'
import { tourAnchor } from '@/components/common/tours/anchors'

interface Props {
  preset: GroupPreset
  /** KPI đang lọc (trang lọc theo KPI / tab Công việc của KPI) — gắn KPI này khi nhóm không tự biết KPI. */
  defaultKpiId?: string
  onCreated?: (taskId: string) => void
}

/**
 * Dòng "+ Thêm việc" ở cuối một nhóm: gõ tên, Enter là tạo, tự điền theo nhóm (hạn của nhóm "Hôm nay", KPI của nhóm KPI,
 * người của nhóm người, nhóm / trường của danh sách, nhãn…). KPI là TUỲ CHỌN: nhóm / trang không gợi KPI thì việc tạo ra
 * không gắn KPI. Gõ nhanh kiểu Lark: `@tên` người thực hiện, `ngày mai 15h` hạn, `!cao` ưu tiên, `#nhãn` — chip bên dưới cho
 * thấy đã hiểu những gì trước khi Enter.
 */
export default function TaskQuickAddRow({ preset, defaultKpiId, onCreated }: Props) {
  const { t } = useTranslation('tasks')
  const [active, setActive] = useState(false)
  const [title, setTitle] = useState('')
  const { create } = useTaskMutations()
  const refresh = useRefreshTasks()
  const kpiId = preset.kpiId !== undefined ? preset.kpiId : defaultKpiId
  const { data: people = [] } = useQuery({
    queryKey: ['kpi-tasks', 'assignable-users', 'all'],
    queryFn: () => taskApi.assignableUsers('', true),
    enabled: active,
    staleTime: 60_000,
  })
  const { data: tags = [] } = useTaskTags()
  const parsed = useMemo(() => parseQuickAdd(title, { people, tags, today: todayIso() }), [title, people, tags])

  const submit = () => {
    const v = parsed.title
    if (!v) return
    const presetTags = preset.tagId ? [preset.tagId] : []
    create.mutate({
      kpiId: kpiId ?? undefined,
      title: v,
      assigneeIds: parsed.assigneeIds.length ? parsed.assigneeIds : preset.ownerId ? [preset.ownerId] : undefined,
      priority: parsed.priority ?? preset.priority,
      dueDate: parsed.dueDate ?? preset.dueDate ?? undefined,
      dueTime: parsed.dueTime ? `${parsed.dueTime}:00` : undefined,
      listId: preset.listId,
      sectionId: preset.sectionId ?? undefined,
      tagIds: [...new Set([...presetTags, ...parsed.tagIds])].length ? [...new Set([...presetTags, ...parsed.tagIds])] : undefined,
      fieldValues: preset.fieldId && preset.fieldValue != null ? { [preset.fieldId]: preset.fieldValue } : undefined,
    }, {
      onSuccess: (task) => {
        setTitle('')
        onCreated?.(task.id)
        // Thêm trong một nhóm riêng của tôi ⇒ xếp luôn vào nhóm đó.
        if (preset.mySectionId) mySectionApi.assign(task.id, preset.mySectionId).then(() => refresh()).catch(() => {})
        // Tạo trong nhóm "Đã xong" không có nghĩa; trạng thái khác ⇒ đổi ngay sau khi tạo.
        if (preset.status && preset.status !== 'TODO') {
          taskApi.changeStatus(task.id, { status: preset.status, version: task.version }).catch(() => {})
        }
      },
      onError: (e) => toast.error(getApiErrorMessage(e)),
    })
  }

  if (!active) {
    return (
      <button {...tourAnchor('tasks.quick-add')}
        type="button"
        onClick={() => setActive(true)}
        className="flex h-11 w-full items-center border-b border-[var(--color-border)] pl-[52px] pr-3 text-left text-[15px] text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
      >
        {t('quickAdd.labelLark')}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-3 py-1.5">
      <Plus size={15} className="text-[var(--color-subtle-foreground)]" />
      {/* Ô nhập trong dòng danh sách — ngoại lệ có chủ đích của quy ước Input (giống ô sửa trong ô bảng). */}
      <input
        autoFocus
        value={title}
        maxLength={255}
        disabled={create.isPending}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); submit() }
          if (e.key === 'Escape') { setActive(false); setTitle('') }
        }}
        onBlur={() => { if (!title.trim()) setActive(false) }}
        placeholder={t('quickAdd.placeholder')}
        className="no-edit-hint min-w-[160px] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-[var(--color-muted-foreground)]"
      />
      {create.isPending && <Loader2 size={14} className="animate-spin text-[var(--color-subtle-foreground)]" />}
      {/* Chip xem trước: những gì đã hiểu từ câu gõ (người, hạn, giờ, ưu tiên, nhãn) */}
      {parsed.tokens.length > 0 ? (
        <div className="flex w-full flex-wrap gap-1.5 pl-6">
          {parsed.tokens.map((tk, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[11px] text-[var(--color-primary)]">
              {tk.kind === 'person' && <><AtSign size={11} /> {tk.label}</>}
              {tk.kind === 'tag' && <><Hash size={11} /> {tk.label}</>}
              {tk.kind === 'date' && <><CalendarDays size={11} /> {formatDate(tk.value)}</>}
              {tk.kind === 'time' && <><Clock size={11} /> {tk.value}</>}
              {tk.kind === 'priority' && <><Flag size={11} style={{ color: PRIORITY_COLOR[tk.value] }} /> {t(`priority.${tk.value}`)}</>}
            </span>
          ))}
        </div>
      ) : !title && <p className="w-full pl-6 text-[11px] text-[var(--color-subtle-foreground)]">{t('quickAdd.syntaxHint')}</p>}
    </div>
  )
}
