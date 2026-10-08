import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { ChevronDown, ChevronRight, ListTodo } from 'lucide-react'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { useTaskMutations } from '../hooks/useTasks'
import { useGroupDrop } from '../hooks/useGroupDrop'
import { groupTasks, sortOrderBetween, type TaskGroup } from '../taskUtils'
import type { KpiTask, TaskGroupBy, TaskSort } from '../types'
import TaskQuickAddRow from './TaskQuickAddRow'
import TaskRow from './TaskRow'

interface Props {
  tasks: KpiTask[]
  groupBy: TaskGroupBy
  sort: TaskSort
  activeTaskId?: string | null
  onOpen: (task: KpiTask) => void
  /** KPI đang lọc — thêm nhanh dùng KPI này khi nhóm không tự biết KPI. */
  defaultKpiId?: string
  showKpi?: boolean
  /** Kéo vào nhóm người phụ trách = giao lại: cần chọn KPI của người mới nên để màn cha mở hộp giao. */
  onRequestAssign?: (task: KpiTask, ownerId: string) => void
  allowQuickAdd?: boolean
}

/**
 * Chế độ Danh sách: nhóm thu gọn / mở được kèm số lượng, dòng "+ Thêm việc" cuối mỗi nhóm, nhóm "Đã hoàn thành" thu
 * gọn ở cuối. Kéo thả: trong nhóm ⇒ sắp xếp thủ công (khi đang "Sắp xếp: thủ công"); sang nhóm khác ⇒ đổi thuộc tính
 * theo nhóm (hạn / KPI / trạng thái / ưu tiên / người phụ trách). Nhóm không xác định được giá trị (Quá hạn, Sau này,
 * Đã hoàn thành) không nhận thả.
 */
export default function TaskListView({
  tasks, groupBy, sort, activeTaskId, onOpen, defaultKpiId, showKpi = true, onRequestAssign, allowQuickAdd = true,
}: Props) {
  const { t } = useTranslation('tasks')
  const groups = useMemo(() => groupTasks(tasks, groupBy, (k) => t(k)), [tasks, groupBy, t])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ completed: true })
  const [dragging, setDragging] = useState<KpiTask | null>(null)
  const m = useTaskMutations()
  const drop = useGroupDrop(onRequestAssign)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const onDragStart = (e: DragStartEvent) => setDragging(tasks.find((x) => x.id === e.active.id) ?? null)

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null)
    const task = tasks.find((x) => x.id === e.active.id)
    const overId = e.over?.id ? String(e.over.id) : null
    if (!task || !overId) return
    // Thả lên một dòng ⇒ chèn trước dòng đó; thả lên vùng nhóm ⇒ cuối nhóm.
    const overTask = overId.startsWith('row:') ? tasks.find((x) => `row:${x.id}` === overId) : undefined
    const group = overTask
      ? groups.find((g) => g.tasks.some((x) => x.id === overTask.id))
      : groups.find((g) => `group:${g.key}` === overId)
    if (!group) return
    const sourceGroup = groups.find((g) => g.tasks.some((x) => x.id === task.id))
    if (group.key !== sourceGroup?.key) {
      drop(task, group.preset)
      return
    }
    if (!task.canEdit) return
    if (sort !== 'manual' || !overTask || overTask.id === task.id) return
    const list = group.tasks.filter((x) => x.id !== task.id)
    const idx = list.findIndex((x) => x.id === overTask.id)
    const order = sortOrderBetween(list[idx - 1], list[idx])
    m.changeStatus.mutate({ id: task.id, status: task.status, sortOrder: order, version: task.version },
      { onError: (er) => toast.error(getApiErrorMessage(er)) })
  }

  if (tasks.length === 0 && groups.every((g) => g.tasks.length === 0) && !allowQuickAdd) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-sm text-[var(--color-subtle-foreground)]">
        <ListTodo size={32} /> {t('list.empty')}
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}>
      <div className="pb-8">
        {groups.map((g) => (
          <GroupSection
            key={g.key}
            group={g}
            collapsed={!!collapsed[g.key]}
            onToggle={() => setCollapsed((c) => ({ ...c, [g.key]: !c[g.key] }))}
            activeTaskId={activeTaskId}
            onOpen={onOpen}
            showKpi={showKpi}
            defaultKpiId={defaultKpiId}
            allowQuickAdd={allowQuickAdd && !g.completed && g.preset !== undefined}
          />
        ))}
      </div>
      <DragOverlay>
        {dragging && (
          <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl">
            <TaskRow task={dragging} onOpen={() => {}} showKpi={showKpi} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function GroupSection({ group, collapsed, onToggle, activeTaskId, onOpen, showKpi, defaultKpiId, allowQuickAdd }: {
  group: TaskGroup
  collapsed: boolean
  onToggle: () => void
  activeTaskId?: string | null
  onOpen: (t: KpiTask) => void
  showKpi: boolean
  defaultKpiId?: string
  allowQuickAdd: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `group:${group.key}`, disabled: !group.preset })
  return (
    <section ref={setNodeRef} className={cn('mb-2 rounded-card transition-colors', isOver && 'bg-[var(--color-primary-soft)]')}>
      <button
        type="button"
        onClick={onToggle}
        className="sticky top-0 z-[1] flex w-full items-center gap-1.5 bg-[var(--color-background)] px-2 py-2 text-left text-sm font-medium"
      >
        {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        <span className={cn('text-[var(--color-foreground)]', group.tone)}>{group.label}</span>
        <span className="text-xs font-normal text-[var(--color-subtle-foreground)]">{group.tasks.length}</span>
      </button>
      {!collapsed && (
        <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
          {group.tasks.map((task) => (
            <DraggableRow key={task.id} task={task} active={task.id === activeTaskId} onOpen={onOpen} showKpi={showKpi} />
          ))}
          {allowQuickAdd && group.preset && <TaskQuickAddRow preset={group.preset} defaultKpiId={defaultKpiId} />}
          {!allowQuickAdd && group.tasks.length === 0 && <div className="h-2" />}
        </div>
      )}
    </section>
  )
}

function DraggableRow({ task, active, onOpen, showKpi }: { task: KpiTask; active: boolean; onOpen: (t: KpiTask) => void; showKpi: boolean }) {
  const drag = useDraggable({ id: task.id, disabled: !task.canEdit })
  const drop = useDroppable({ id: `row:${task.id}` })
  return (
    <div ref={(el) => { drag.setNodeRef(el); drop.setNodeRef(el) }}
      className={cn(drop.isOver && 'border-t-2 border-[var(--color-primary)]')}>
      <TaskRow
        task={task}
        active={active}
        onOpen={onOpen}
        showKpi={showKpi}
        dragging={drag.isDragging}
        dragHandleProps={{ ...drag.attributes, ...drag.listeners }}
      />
    </div>
  )
}
