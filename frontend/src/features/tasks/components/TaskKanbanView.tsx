import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { ListTree, MessageSquare, Plus, Repeat } from 'lucide-react'
import UserAvatar from '@/components/common/UserAvatar'
import { cn } from '@/lib/utils'
import { useGroupDrop } from '../hooks/useGroupDrop'
import { dueTone, groupTasks, isClosed, PRIORITY_COLOR, shortDue, type TaskGroup } from '../taskUtils'
import type { KpiTask, TaskGroupBy } from '../types'
import TaskQuickAddRow from './TaskQuickAddRow'

interface Props {
  tasks: KpiTask[]
  groupBy: TaskGroupBy
  activeTaskId?: string | null
  onOpen: (task: KpiTask) => void
  defaultKpiId?: string
  onRequestAssign?: (task: KpiTask, ownerId: string) => void
}

/**
 * Chế độ Kanban: cột theo nhóm đang chọn (mặc định theo trạng thái), thẻ kiểu Lark (tên, KPI, hạn, người phụ trách, việc
 * con, bình luận), nút "+" đầu cột để thêm nhanh, kéo thẻ sang cột khác để đổi thuộc tính của cột. Cột chia đều bề ngang
 * (tối thiểu 240px) và xuống hàng khi nhiều cột; mỗi cột tự cuộn dọc. Điện thoại: mỗi cột một hàng.
 */
export default function TaskKanbanView({ tasks, groupBy, activeTaskId, onOpen, defaultKpiId, onRequestAssign }: Props) {
  const { t } = useTranslation('tasks')
  const by = groupBy === 'none' ? 'status' : groupBy
  const columns = useMemo(() => groupTasks(tasks, by, (k) => t(k)), [tasks, by, t])
  const [dragging, setDragging] = useState<KpiTask | null>(null)
  const drop = useGroupDrop(onRequestAssign)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor))

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null)
    const task = tasks.find((x) => x.id === e.active.id)
    const col = columns.find((c) => c.key === e.over?.id)
    if (!task || !col || col.tasks.some((x) => x.id === task.id)) return
    drop(task, col.preset)
  }

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setDragging(tasks.find((x) => x.id === e.active.id) ?? null)}
      onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      {/* Lưới tự co giãn: cột chia đều bề ngang, tối thiểu 240px; không đủ chỗ thì xuống hàng — không phải kéo ngang. */}
      <div className="grid grid-cols-1 gap-3 pb-4 sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
        {columns.map((c) => (
          <Column key={c.key} column={c} activeTaskId={activeTaskId} onOpen={onOpen} defaultKpiId={defaultKpiId} />
        ))}
      </div>
      <DragOverlay>{dragging && <Card task={dragging} onOpen={() => {}} overlay />}</DragOverlay>
    </DndContext>
  )
}

function Column({ column, activeTaskId, onOpen, defaultKpiId }: {
  column: TaskGroup; activeTaskId?: string | null; onOpen: (t: KpiTask) => void; defaultKpiId?: string
}) {
  const { t } = useTranslation('tasks')
  const { setNodeRef, isOver } = useDroppable({ id: column.key, disabled: !column.preset })
  const [adding, setAdding] = useState(false)
  return (
    <div ref={setNodeRef}
      className={cn('flex min-w-0 flex-col rounded-card border bg-[var(--color-muted)]',
        isOver ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]')}>
      <div className="flex items-center gap-2 px-3 py-2">
        <span className={cn('truncate text-sm font-medium text-[var(--color-foreground)]', column.tone)}>{column.label}</span>
        <span className="text-xs text-[var(--color-subtle-foreground)]">{column.tasks.length}</span>
        <div className="flex-1" />
        {column.preset && !column.completed && (
          <button type="button" aria-label={t('quickAdd.label')} onClick={() => setAdding((a) => !a)}
            className="rounded p-1 text-[var(--color-subtle-foreground)] hover:bg-[var(--color-card)] hover:text-[var(--color-foreground)]">
            <Plus size={15} />
          </button>
        )}
      </div>
      {adding && column.preset && (
        <div className="mx-2 mb-2 overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
          <TaskQuickAddRow preset={column.preset} defaultKpiId={defaultKpiId} onCreated={() => setAdding(false)} />
        </div>
      )}
      <div className="flex max-h-[calc(100vh-260px)] min-h-[160px] flex-col gap-2 overflow-y-auto px-2 pb-2">
        {column.tasks.map((task) => <DraggableCard key={task.id} task={task} active={task.id === activeTaskId} onOpen={onOpen} />)}
      </div>
    </div>
  )
}

function DraggableCard({ task, active, onOpen }: { task: KpiTask; active: boolean; onOpen: (t: KpiTask) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: !task.canEdit })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn(isDragging && 'opacity-40')}>
      <Card task={task} active={active} onOpen={onOpen} />
    </div>
  )
}

function Card({ task, active, onOpen, overlay }: { task: KpiTask; active?: boolean; onOpen: (t: KpiTask) => void; overlay?: boolean }) {
  return (
    <div role="button" tabIndex={0} onClick={() => onOpen(task)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(task) }}
      className={cn('rounded-card border bg-[var(--color-card)] p-3 text-left shadow-sm transition-shadow hover:shadow-md',
        active ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]', overlay && 'rotate-2 shadow-xl',
        task.canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer')}
      style={{ borderLeft: `3px solid ${PRIORITY_COLOR[task.priority]}` }}>
      <p className={cn('text-sm font-medium text-[var(--color-foreground)]', isClosed(task) && 'text-[var(--color-subtle-foreground)] line-through')}>
        {task.title}
      </p>
      {task.kpiName && <p className="mt-0.5 truncate text-xs text-[var(--color-subtle-foreground)]">{task.kpiName}</p>}
      <div className="mt-2 flex items-center gap-2.5 text-xs">
        {task.dueDate && <span className={dueTone(task)}>{shortDue(task)}</span>}
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
        <UserAvatar fullName={task.ownerName} avatarUrl={task.ownerAvatarUrl} className="h-6 w-6 rounded-full text-[10px]" />
      </div>
    </div>
  )
}
