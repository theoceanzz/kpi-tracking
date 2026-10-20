import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Ban, Bell, CalendarDays, ChevronsRightLeft, Flag, ListTree, MessageSquare, MoreHorizontal, Pencil, Repeat, Trash2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { listApi } from '../api/listApi'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { useGroupDrop } from '../hooks/useGroupDrop'
import { taskKeys, useMySections, useSetTaskList, useTaskMutations } from '../hooks/useTasks'
import { mySectionApi } from '../api/listApi'
import { useQueryClient } from '@tanstack/react-query'
import { dueCountdown, groupTasks, isClosed, larkDay, PRIORITY_COLOR, statusStyleOf, type GroupPreset, type TaskGroup } from '../taskUtils'
import { useNow } from '../hooks/useNow'
import { isReorderableGroup, useReorderGroup } from '../hooks/useReorderGroup'
import type { KpiTask, TaskGroupBy, TaskListDetail, TaskTag } from '../types'
import { AssigneeStack, FieldChips, TagChip } from './TaskBits'
import TaskQuickAddRow from './TaskQuickAddRow'
import AddSectionInline from './AddSectionInline'
import TaskRowMenu, { type MenuAnchor } from './TaskRowMenu'

interface Props {
  tasks: KpiTask[]
  groupBy: TaskGroupBy
  activeTaskId?: string | null
  onOpen: (task: KpiTask) => void
  defaultKpiId?: string
  onRequestAssign?: (task: KpiTask, ownerId: string) => void
  list?: TaskListDetail | null
  tags?: TaskTag[]
  /** Dưới bảng (vd. "Tải thêm" của danh sách tải dần). */
  footer?: ReactNode
}

/**
 * Chế độ Kanban: cột theo nhóm đang chọn (mặc định theo trạng thái; trong danh sách: theo nhóm của danh sách hoặc trường
 * chọn một), thẻ kiểu Lark (vòng tích + tên, hạn, người thực hiện), "+ Thêm việc" cuối cột, kéo thẻ sang cột khác để
 * đổi thuộc tính của cột. Cột rộng cố định 288px xếp một hàng, nhiều cột thì cuộn ngang; mỗi cột tự cuộn dọc.
 */
export default function TaskKanbanView({ tasks, groupBy, activeTaskId, onOpen, defaultKpiId, onRequestAssign, list, tags, footer }: Props) {
  const { t } = useTranslation('tasks')
  const by = groupBy === 'none' ? 'status' : groupBy
  const qc = useQueryClient()
  const { data: mySections } = useMySections(by === 'mysection')
  const columns = useMemo(() => groupTasks(tasks, by, (k) => t(k), { list, tags, mySections, manual: true }), [tasks, by, t, list, tags, mySections])
  const [dragging, setDragging] = useState<KpiTask | null>(null)
  const { drop, dialog } = useGroupDrop(onRequestAssign)
  // Cột thu gọn: nhớ theo trình duyệt cho từng ngữ cảnh (danh sách / cách nhóm).
  const collapseKey = `tasks.kanban.collapsed.${list?.id ?? 'all'}.${by}`
  const [collapsed, setCollapsedState] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(collapseKey) ?? '[]') } catch { return [] } })
  const [collapsedFor, setCollapsedFor] = useState(collapseKey)
  if (collapsedFor !== collapseKey) {
    setCollapsedFor(collapseKey)
    try { setCollapsedState(JSON.parse(localStorage.getItem(collapseKey) ?? '[]')) } catch { setCollapsedState([]) }
  }
  const toggleCollapsed = (key: string) => {
    const next = collapsed.includes(key) ? collapsed.filter((k) => k !== key) : [...collapsed, key]
    setCollapsedState(next)
    try { localStorage.setItem(collapseKey, JSON.stringify(next)) } catch { /* bỏ qua */ }
  }
  const sectionEditable = by === 'section' && !!list && !list.archived && list.role !== 'VIEWER'
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor))

  const reorder = useReorderGroup(list, mySections)
  const [draggingCol, setDraggingCol] = useState<TaskGroup | null>(null)
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null)
    setDraggingCol(null)
    // Kéo đầu cột ⇒ đổi thứ tự nhóm.
    const activeId = String(e.active.id)
    if (activeId.startsWith('colhandle:')) {
      if (e.over?.id) reorder(activeId.slice(10), String(e.over.id))
      return
    }
    const task = tasks.find((x) => x.id === e.active.id)
    const col = columns.find((c) => c.key === e.over?.id)
    if (!task || !col || col.tasks.some((x) => x.id === task.id)) return
    drop(task, col.preset)
  }

  return (
    <DndContext sensors={sensors}
      onDragStart={(e) => {
        const id = String(e.active.id)
        if (id.startsWith('colhandle:')) setDraggingCol(columns.find((c) => c.key === id.slice(10)) ?? null)
        else setDragging(tasks.find((x) => x.id === id) ?? null)
      }}
      onDragEnd={onDragEnd} onDragCancel={() => { setDragging(null); setDraggingCol(null) }}>
      {/* Như Lark: cột rộng cố định xếp MỘT hàng, nhiều cột thì cuộn ngang (không xuống hàng). */}
      <div className="custom-scrollbar flex items-start gap-3 overflow-x-auto pb-4">
        {columns.map((c) => (
          <Column key={c.key} column={c} activeTaskId={activeTaskId} onOpen={onOpen} defaultKpiId={defaultKpiId} list={list}
            collapsed={collapsed.includes(c.key)} onToggleCollapsed={() => toggleCollapsed(c.key)}
            sectionEditable={sectionEditable && c.key.startsWith('section:') && c.key !== 'section:none'} />
        ))}
        {by === 'section' && list && !list.archived && list.role !== 'VIEWER' && <AddSectionInline list={list} variant="column" />}
        {by === 'mysection' && (
          <AddSectionInline variant="column"
            onCreate={(name) => mySectionApi.create(name).then(() => qc.invalidateQueries({ queryKey: taskKeys.mySections }))} />
        )}
      </div>
      {footer}
      <DragOverlay>
        {dragging && <Card task={dragging} onOpen={() => {}} overlay list={list} />}
        {draggingCol && (
          <div className="w-72 rotate-1 rounded-card bg-[var(--color-muted)] px-3 py-2.5 text-sm font-medium shadow-xl ring-2 ring-[var(--color-primary)]">
            {draggingCol.label} <span className="text-xs font-normal text-[var(--color-subtle-foreground)]">{draggingCol.tasks.length}</span>
          </div>
        )}
      </DragOverlay>
      {dialog}
    </DndContext>
  )
}

function Column({ column, activeTaskId, onOpen, defaultKpiId, list, collapsed, onToggleCollapsed, sectionEditable }: {
  column: TaskGroup; activeTaskId?: string | null; onOpen: (t: KpiTask) => void; defaultKpiId?: string; list?: TaskListDetail | null
  collapsed: boolean; onToggleCollapsed: () => void; sectionEditable: boolean
}) {
  const { t } = useTranslation('tasks')
  const { setNodeRef, isOver } = useDroppable({ id: column.key, disabled: !column.preset })
  // Đầu cột kéo được để đổi thứ tự nhóm (nhóm của danh sách / nhóm riêng của tôi).
  const { setNodeRef: setHandleRef, attributes: handleAttrs, listeners: handleListeners, isDragging: handleDragging } =
    useDraggable({ id: `colhandle:${column.key}`, disabled: !isReorderableGroup(column.key, list) })
  const preset: GroupPreset | undefined = column.preset && list ? { listId: list.id, ...column.preset } : column.preset

  if (collapsed) {
    // Cột thu gọn: dải dọc tên + số việc, vẫn nhận thả thẻ; bấm để mở lại.
    return (
      <button ref={setNodeRef as unknown as React.Ref<HTMLButtonElement>} type="button" onClick={onToggleCollapsed} title={t('kanban.expand')}
        className={cn('flex w-10 shrink-0 flex-col items-center gap-2 self-stretch rounded-card bg-[var(--color-muted)] py-3 ring-2 transition-shadow hover:bg-[var(--color-border)]',
          isOver ? 'ring-[var(--color-primary)]' : 'ring-transparent')}>
        <span className="text-xs text-[var(--color-subtle-foreground)]">{column.tasks.length}</span>
        <span className={cn('text-sm font-medium text-[var(--color-foreground)] [writing-mode:vertical-rl]', column.tone)}>{column.label}</span>
      </button>
    )
  }
  return (
    <div ref={setNodeRef}
      className={cn('flex w-72 shrink-0 flex-col rounded-card transition-colors',
        isOver ? 'bg-[var(--color-primary-soft)]' : 'bg-transparent')}>
      <div ref={setHandleRef} {...handleAttrs} {...handleListeners}
        className={cn('group/col flex items-center gap-2 px-1 pb-2 pt-1', isReorderableGroup(column.key, list) && 'cursor-grab active:cursor-grabbing',
          handleDragging && 'opacity-40')}>
        {column.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: column.color }} />}
        <span className={cn('truncate text-[15px] font-medium text-[var(--color-foreground)]', column.tone)}>{column.label}</span>
        <span className="text-sm text-[var(--color-subtle-foreground)]">{column.tasks.length}</span>
        <div className="flex-1" />
        <ColumnMenu column={column} list={list} sectionEditable={sectionEditable} onCollapse={onToggleCollapsed} />
      </div>
      <div className="flex max-h-[calc(100vh-280px)] min-h-[60px] flex-col gap-2 overflow-y-auto pb-1">
        {column.tasks.map((task) => <DraggableCard key={task.id} task={task} active={task.id === activeTaskId} onOpen={onOpen} list={list} />)}
      </div>
      {preset && !column.completed && (
        <div className="[&_button]:rounded-md [&_button]:border-0 [&_button]:pl-2">
          <TaskQuickAddRow preset={preset} defaultKpiId={defaultKpiId} />
        </div>
      )}
    </div>
  )
}

/** Menu "…" đầu cột: thu gọn; với nhóm của danh sách thêm đổi tên, sang trái / phải, xoá nhóm. */
function ColumnMenu({ column, list, sectionEditable, onCollapse }: {
  column: TaskGroup; list?: TaskListDetail | null; sectionEditable: boolean; onCollapse: () => void
}) {
  const { t } = useTranslation('tasks')
  const setList = useSetTaskList()
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const sectionId = column.key.startsWith('section:') ? column.key.slice(8) : null
  const sections = [...(list?.sections ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
  const idx = sections.findIndex((x) => x.id === sectionId)
  const call = (p: Promise<TaskListDetail>) => p.then(setList).catch((e) => toast.error(getApiErrorMessage(e)))
  const move = (dir: -1 | 1) => {
    if (!list || !sectionId) return
    const j = idx + dir
    const b = sections[j]
    if (!b) return
    const beyond = sections[j + dir]
    const target = beyond ? (b.sortOrder + beyond.sortOrder) / 2 : b.sortOrder + dir * 1024
    void call(listApi.updateSection(list.id, sectionId, { sortOrder: target }))
    setOpen(false)
  }
  const item = 'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--color-muted)] disabled:opacity-40 disabled:hover:bg-transparent'
  return (
    <>
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setRenaming(null) }}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={t('menu.more')}
            className="rounded p-1 text-[var(--color-subtle-foreground)] opacity-0 hover:bg-[var(--color-card)] hover:text-[var(--color-foreground)] focus:opacity-100 group-hover/col:opacity-100 data-[state=open]:opacity-100">
            <MoreHorizontal size={15} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-1" align="end">
          {renaming != null ? (
            <div className="p-1">
              {/* Ô sửa tên nhóm trong menu — ngoại lệ có chủ đích của quy ước Input. */}
              <input autoFocus value={renaming} maxLength={120} onChange={(e) => setRenaming(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && renaming.trim() && list && sectionId) {
                    void call(listApi.updateSection(list.id, sectionId, { name: renaming.trim() }))
                    setOpen(false); setRenaming(null)
                  }
                  if (e.key === 'Escape') setRenaming(null)
                }}
                className="no-edit-hint w-full rounded border border-[var(--color-ring)] bg-[var(--color-card)] px-2 py-1 text-sm outline-none" />
            </div>
          ) : (
            <>
              {sectionEditable && (
                <>
                  <button type="button" className={item} onClick={() => setRenaming(column.label)}><Pencil size={14} /> {t('kanban.rename')}</button>
                  <button type="button" className={item} disabled={idx <= 0} onClick={() => move(-1)}><ArrowLeft size={14} /> {t('kanban.moveLeft')}</button>
                  <button type="button" className={item} disabled={idx < 0 || idx >= sections.length - 1} onClick={() => move(1)}><ArrowRight size={14} /> {t('kanban.moveRight')}</button>
                </>
              )}
              <button type="button" className={item} onClick={() => { setOpen(false); onCollapse() }}><ChevronsRightLeft size={14} /> {t('kanban.collapse')}</button>
              {sectionEditable && (
                <button type="button" className={cn(item, 'text-[var(--color-error)]')} onClick={() => { setOpen(false); setConfirmDelete(true) }}>
                  <Trash2 size={14} /> {t('lists.deleteSection')}
                </button>
              )}
            </>
          )}
        </PopoverContent>
      </Popover>
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title={t('lists.deleteSection')}
        description={t('lists.sectionDeleteHint')} confirmLabel={t('lists.deleteSection')}
        onConfirm={() => { setConfirmDelete(false); if (list && sectionId) void call(listApi.deleteSection(list.id, sectionId)) }} />
    </>
  )
}

function DraggableCard({ task, active, onOpen, list }: { task: KpiTask; active: boolean; onOpen: (t: KpiTask) => void; list?: TaskListDetail | null }) {
  const canDrag = task.canEdit || (!!list && (list.role === 'OWNER' || list.role === 'EDITOR'))
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: !canDrag })
  return (
    // Không kéo được ⇒ bỏ thuộc tính dnd-kit (aria-disabled="true" làm thẻ bị coi là vô hiệu dù bấm vẫn mở).
    <div ref={setNodeRef} {...(canDrag ? attributes : {})} {...(canDrag ? listeners : {})} className={cn(isDragging && 'opacity-40')}>
      <Card task={task} active={active} onOpen={onOpen} list={list} />
    </div>
  )
}

function Card({ task, active, onOpen, overlay, list }: {
  task: KpiTask; active?: boolean; onOpen: (t: KpiTask) => void; overlay?: boolean; list?: TaskListDetail | null
}) {
  const { t } = useTranslation('tasks')
  const { changeStatus } = useTaskMutations()
  const [menu, setMenu] = useState<MenuAnchor | null>(null)
  const countdown = dueCountdown(task, useNow())
  const S = statusStyleOf(task)
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!task.canEdit || task.status === 'CANCELLED') return
    changeStatus.mutate({ id: task.id, status: task.status === 'DONE' ? 'TODO' : 'DONE', version: task.version }, {
      // Còn việc con / bị chặn: mở chi tiết để xác nhận ở đó.
      onError: (er) => { toast.error(getApiErrorMessage(er)); onOpen(task) },
    })
  }
  return (
    <div role="button" tabIndex={0} onClick={() => onOpen(task)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(task) }}
      onContextMenu={(e) => { if (overlay) return; e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }) }}
      className={cn('rounded-lg border bg-[var(--color-card)] px-3 py-2.5 text-left shadow-sm transition-shadow hover:shadow-md',
        active ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]', overlay && 'rotate-2 shadow-xl',
        task.canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer')}>
      <div className="flex items-start gap-2">
        <button type="button" onClick={toggle} onPointerDown={(e) => e.stopPropagation()}
          disabled={!task.canEdit || task.status === 'CANCELLED'}
          aria-label={task.status === 'DONE' ? t('row.markTodo') : t('row.markDone')}
          className={cn('mt-0.5 shrink-0 transition-transform hover:scale-110 disabled:cursor-default disabled:hover:scale-100', S.className)}>
          <S.icon size={16} />
        </button>
        <p className={cn('min-w-0 flex-1 text-[15px] text-[var(--color-foreground)] [overflow-wrap:anywhere]', isClosed(task) && 'text-[var(--color-subtle-foreground)] line-through')}>
          {task.title}
        </p>
      </div>
      {(task.tags.length > 0 || (list?.fields.length ?? 0) > 0 || task.kpiName) && (
        <div className="mt-1.5 flex flex-wrap gap-1 pl-6">
          {task.tags.slice(0, 3).map((g) => <TagChip key={g.id} tag={g} />)}
          {list && <FieldChips task={task} fields={list.fields} />}
          {task.kpiName && <span className="max-w-full truncate text-[11px] text-[var(--color-subtle-foreground)]">{task.kpiName}</span>}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2.5 pl-6 text-xs">
        {task.dueDate && (
          <span title={countdown?.label} className={cn('inline-flex items-center gap-1',
            (task.overdue || countdown?.overdue) && !isClosed(task) ? 'text-[var(--color-error)]' : 'text-[var(--color-subtle-foreground)]')}>
            <CalendarDays size={12} /> {larkDay(task.dueDate, task.dueTime)}
            {(task.reminders?.length ?? 0) > 0 && <Bell size={12} />}
          </span>
        )}
        {task.priority !== 'MEDIUM' && <Flag size={12} style={{ color: PRIORITY_COLOR[task.priority] }} aria-label={t(`priority.${task.priority}`)} />}
        {task.openBlockers > 0 && !isClosed(task) && <Ban size={12} className="text-[var(--color-warning)]" />}
        {task.subtaskTotal > 0 && (
          <span className="inline-flex items-center gap-1 text-[var(--color-subtle-foreground)]"><ListTree size={12} /> {task.subtaskDone}/{task.subtaskTotal}</span>
        )}
        {task.commentCount > 0 && (
          <span className={cn('inline-flex items-center gap-1', task.unreadComments ? 'font-semibold text-[var(--color-primary)]' : 'text-[var(--color-subtle-foreground)]')}>
            <MessageSquare size={12} /> {task.commentCount}
          </span>
        )}
        {task.recurrence && <Repeat size={12} className="text-[var(--color-subtle-foreground)]" />}
        <div className="flex-1" />
        <AssigneeStack task={task} size="sm" />
      </div>
      {!overlay && <TaskRowMenu task={task} anchor={menu} onClose={() => setMenu(null)} onOpen={onOpen} />}
    </div>
  )
}
