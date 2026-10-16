import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CalendarClock, CheckCircle2, Flag, FolderInput, Loader2, RotateCcw, Tag, Trash2, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { getApiErrorMessage } from '@/lib/apiError'
import { taskApi } from '../api/taskApi'
import { useTaskMutations, useTaskSidebar, useTaskTags } from '../hooks/useTasks'
import { TASK_PRIORITIES, TASK_STATUSES, type TaskBatchInput, type TaskListDetail } from '../types'
import GroupedPicker from './GroupedPicker'
import { TagChip } from './TaskBits'

interface Props {
  ids: string[]
  onClear: () => void
  /** Danh sách đang xem — có thêm "Chuyển nhóm" và "Bỏ khỏi danh sách". */
  list?: TaskListDetail | null
}

/**
 * Thanh thao tác hàng loạt (hiện khi chọn ≥ 1 việc): hoàn thành, mở lại, trạng thái, ưu tiên, hạn / dời hạn, thêm người
 * thực hiện / theo dõi, thêm vào danh sách, chuyển nhóm, nhãn, xoá. Máy chủ áp từng việc theo đúng luật; việc nào không
 * được thì báo riêng (không làm hỏng việc khác).
 */
export default function TaskBatchBar({ ids, onClear, list }: Props) {
  const { t } = useTranslation('tasks')
  const m = useTaskMutations()
  const { data: sidebar } = useTaskSidebar()
  const { data: tags = [] } = useTaskTags()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [date, setDate] = useState('')
  const [days, setDays] = useState('1')
  const [peopleOpen, setPeopleOpen] = useState(false)
  const { data: people = [] } = useQuery({
    queryKey: ['kpi-tasks', 'assignable-users', 'all'],
    queryFn: () => taskApi.assignableUsers('', true),
    enabled: peopleOpen,
    staleTime: 60_000,
  })

  const run = (input: Omit<TaskBatchInput, 'taskIds'>) => {
    m.batch.mutate({ ...input, taskIds: ids }, {
      onSuccess: (r) => {
        const failed = r.results.filter((x) => !x.ok)
        if (failed.length === 0) toast.success(t('batch.done', { count: r.succeeded }))
        else {
          toast.warning(t('batch.partial', { ok: r.succeeded, failed: failed.length }), {
            description: [...new Set(failed.map((f) => f.message).filter(Boolean))].slice(0, 3).join(' · '),
            duration: 8000,
          })
        }
        if (input.action === 'DELETE' || input.action === 'REMOVE_FROM_LIST') onClear()
      },
      onError: (e) => toast.error(getApiErrorMessage(e)),
    })
  }

  const lists = (sidebar?.lists ?? []).filter((l) => !l.archived && (l.role === 'OWNER' || l.role === 'EDITOR'))
  const busy = m.batch.isPending

  return (
    <div className="sticky bottom-3 z-[5] mx-auto flex w-fit max-w-full flex-wrap items-center gap-1 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1.5 shadow-xl">
      <span className="px-2 text-sm font-medium">{t('batch.selected', { count: ids.length })}</span>
      {busy && <Loader2 size={14} className="animate-spin" />}
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => run({ action: 'COMPLETE' })}><CheckCircle2 /> {t('batch.complete')}</Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => run({ action: 'REOPEN' })}><RotateCcw /> {t('batch.reopen')}</Button>

      <Popover>
        <PopoverTrigger asChild><Button size="sm" variant="ghost" disabled={busy}><Flag /> {t('batch.statusPriority')}</Button></PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="start">
          {TASK_STATUSES.map((s) => <Item key={s} onClick={() => run({ action: 'SET_STATUS', status: s })}>{t(`status.${s}`)}</Item>)}
          <div className="my-1 border-t border-[var(--color-border)]" />
          {TASK_PRIORITIES.map((p) => <Item key={p} onClick={() => run({ action: 'SET_PRIORITY', priority: p })}>{t(`priority.${p}`)}</Item>)}
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild><Button size="sm" variant="ghost" disabled={busy}><CalendarClock /> {t('batch.due')}</Button></PopoverTrigger>
        <PopoverContent className="w-72 space-y-3 p-3" align="start">
          <div className="space-y-1">
            <p className="text-xs text-[var(--color-subtle-foreground)]">{t('batch.setDue')}</p>
            <div className="flex gap-2">
              <Input type="date" size="sm" value={date} onChange={(e) => setDate(e.target.value)} />
              <Button size="sm" disabled={!date} onClick={() => run({ action: 'SET_DUE', date })}>{t('batch.apply')}</Button>
            </div>
            <Button size="sm" variant="ghost" onClick={() => run({ action: 'SET_DUE', clear: true })}>{t('batch.clearDue')}</Button>
          </div>
          <div className="space-y-1 border-t border-[var(--color-border)] pt-2">
            <p className="text-xs text-[var(--color-subtle-foreground)]">{t('batch.shiftDue')}</p>
            <div className="flex items-center gap-2">
              <div className="w-24"><Input type="number" size="sm" value={days} onChange={(e) => setDays(e.target.value)} suffix={t('batch.days')} className="no-edit-hint" /></div>
              <Button size="sm" disabled={!Number(days)} onClick={() => run({ action: 'SHIFT_DUE', days: Number(days) })}>{t('batch.apply')}</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={peopleOpen} onOpenChange={setPeopleOpen}>
        <PopoverTrigger asChild><Button size="sm" variant="ghost" disabled={busy}><UserPlus /> {t('batch.people')}</Button></PopoverTrigger>
        <PopoverContent className="w-72 space-y-2 p-3" align="start">
          <p className="text-xs text-[var(--color-subtle-foreground)]">{t('batch.addAssignee')}</p>
          <GroupedPicker size="sm" people options={people} value={null} onChange={(v) => { if (v) { run({ action: 'ADD_ASSIGNEE', userId: v }); setPeopleOpen(false) } }}
            placeholder={t('picker.pickPerson')} searchPlaceholder={t('picker.searchPerson')} />
          <p className="text-xs text-[var(--color-subtle-foreground)]">{t('batch.addFollower')}</p>
          <GroupedPicker size="sm" people options={people} value={null} onChange={(v) => { if (v) { run({ action: 'ADD_FOLLOWER', userId: v }); setPeopleOpen(false) } }}
            placeholder={t('picker.pickPerson')} searchPlaceholder={t('picker.searchPerson')} />
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild><Button size="sm" variant="ghost" disabled={busy}><FolderInput /> {t('batch.lists')}</Button></PopoverTrigger>
        <PopoverContent className="w-64 p-1" align="start">
          {list && (list.role === 'OWNER' || list.role === 'EDITOR') && (
            <>
              <p className="px-2 py-1 text-xs text-[var(--color-subtle-foreground)]">{t('batch.moveSection')}</p>
              <Item onClick={() => run({ action: 'MOVE_SECTION', listId: list.id, sectionId: null })}>{t('group.noSection')}</Item>
              {list.sections.map((s) => <Item key={s.id} onClick={() => run({ action: 'MOVE_SECTION', listId: list.id, sectionId: s.id })}>{s.name}</Item>)}
              <Item danger onClick={() => run({ action: 'REMOVE_FROM_LIST', listId: list.id })}>{t('batch.removeFromList')}</Item>
              <div className="my-1 border-t border-[var(--color-border)]" />
            </>
          )}
          <p className="px-2 py-1 text-xs text-[var(--color-subtle-foreground)]">{t('batch.addToList')}</p>
          {lists.filter((l) => l.listId !== list?.id).map((l) => (
            <Item key={l.listId} onClick={() => run({ action: 'ADD_TO_LIST', listId: l.listId })}>{l.name}</Item>
          ))}
          {lists.length === 0 && <p className="px-2 py-1 text-xs text-[var(--color-subtle-foreground)]">{t('batch.noLists')}</p>}
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild><Button size="sm" variant="ghost" disabled={busy}><Tag /> {t('batch.tags')}</Button></PopoverTrigger>
        <PopoverContent className="w-64 space-y-2 p-3" align="start">
          <p className="text-xs text-[var(--color-subtle-foreground)]">{t('batch.addTagHint')}</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((g) => (
              <span key={g.id} className="inline-flex items-center gap-0.5">
                <button type="button" onClick={() => run({ action: 'ADD_TAG', tagId: g.id })}><TagChip tag={g} /></button>
                <button type="button" aria-label={t('batch.removeTag')} onClick={() => run({ action: 'REMOVE_TAG', tagId: g.id })}
                  className="text-[var(--color-subtle-foreground)] hover:text-[var(--color-error)]"><X size={11} /></button>
              </span>
            ))}
            {tags.length === 0 && <span className="text-xs text-[var(--color-subtle-foreground)]">{t('tags.none')}</span>}
          </div>
        </PopoverContent>
      </Popover>

      <Button size="sm" variant="ghost" disabled={busy} className="text-[var(--color-error)]" onClick={() => setConfirmDelete(true)}><Trash2 /> {t('batch.delete')}</Button>
      <Button size="icon-sm" variant="ghost" aria-label={t('batch.clear')} onClick={onClear}><X /></Button>

      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); run({ action: 'DELETE' }) }}
        title={t('batch.deleteTitle', { count: ids.length })} description={t('batch.deleteDescription')} confirmLabel={t('batch.delete')} />
    </div>
  )
}

function Item({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--color-muted)] ${danger ? 'text-[var(--color-error)]' : ''}`}>
      {children}
    </button>
  )
}
