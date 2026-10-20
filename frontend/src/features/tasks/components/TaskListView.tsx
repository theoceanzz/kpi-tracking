import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { ChevronRight, ListTodo, Loader2 } from 'lucide-react'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { taskKeys, useMySections, useTask, useTaskMutations } from '../hooks/useTasks'
import { mySectionApi } from '../api/listApi'
import { isReorderableGroup, useReorderGroup } from '../hooks/useReorderGroup'
import { useQueryClient } from '@tanstack/react-query'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import MySectionMenu from './MySectionMenu'
import { useGroupDrop } from '../hooks/useGroupDrop'
import { groupTasks, sortOrderBetween, type GroupPreset, type TaskGroup } from '../taskUtils'
import type { KpiTask, TaskGroupBy, TaskListDetail, TaskTag } from '../types'
import TaskQuickAddRow from './TaskQuickAddRow'
import TaskRow from './TaskRow'
import TaskTableHeader from './TaskTableHeader'
import { TITLE_MIN_WIDTH, useTaskColumns, type TaskColumn, type TaskColumnKey } from '../hooks/useTaskColumns'
import AddSectionInline from './AddSectionInline'

interface Props {
  tasks: KpiTask[]
  groupBy: TaskGroupBy
  sort: string
  activeTaskId?: string | null
  onOpen: (task: KpiTask) => void
  /** KPI đang lọc — thêm nhanh dùng KPI này. */
  defaultKpiId?: string
  showKpi?: boolean
  /** Kéo vào nhóm người phụ trách = giao lại: cần chọn KPI của người mới nên để màn cha mở hộp giao. */
  onRequestAssign?: (task: KpiTask, ownerId: string) => void
  allowQuickAdd?: boolean
  /** Danh sách đang xem: nhóm / trường / thứ tự theo danh sách, thêm nhanh vào danh sách. */
  list?: TaskListDetail | null
  tags?: TaskTag[]
  /** Chọn nhiều (thao tác hàng loạt). */
  selectedIds?: Set<string>
  onToggleSelect?: (task: KpiTask, shift: boolean, ordered: KpiTask[]) => void
  /** Báo thứ tự việc đang thấy trên màn (để bảng chi tiết chuyển việc trước / sau). */
  onOrdered?: (ids: string[]) => void
  /** Cuối bảng, trong khung cuộn (vd. "Tải thêm" của danh sách tải dần). */
  footer?: ReactNode
  /**
   * Bộ cột riêng cho chỗ nhúng (vd. tab Công việc của KPI): cấu hình cột lưu theo khoá này, không dùng chung với trang
   * Công việc; `defaultColumns` = các cột bật sẵn khi người dùng chưa chỉnh.
   */
  columnsContext?: string
  defaultColumns?: TaskColumnKey[]
}

/**
 * Chế độ Danh sách: nhóm thu gọn / mở được kèm số lượng, dòng "+ Thêm việc" cuối mỗi nhóm, nhóm "Đã hoàn thành" thu
 * gọn ở cuối. Kéo thả: trong nhóm ⇒ sắp xếp thủ công (khi đang "Sắp xếp: thủ công"; trong danh sách là thứ tự của danh
 * sách); sang nhóm khác ⇒ đổi thuộc tính theo nhóm. Nhóm không xác định được giá trị (Quá hạn, Sau này, Đã hoàn thành)
 * không nhận thả.
 */
export default function TaskListView({
  tasks, groupBy, sort, activeTaskId, onOpen, defaultKpiId, showKpi = true, onRequestAssign, allowQuickAdd = true, list, tags,
  selectedIds, onToggleSelect, onOrdered, footer, columnsContext, defaultColumns,
}: Props) {
  const { t } = useTranslation('tasks')
  // Việc con có việc cha cũng đang trong danh sách ⇒ lồng dưới cha (xổ / gập như Lark), không đứng riêng trong nhóm.
  const { roots, childrenOf } = useMemo(() => {
    const ids = new Set(tasks.map((x) => x.id))
    const map = new Map<string, KpiTask[]>()
    const top: KpiTask[] = []
    for (const x of tasks) {
      if (x.parentTaskId && ids.has(x.parentTaskId)) map.set(x.parentTaskId, [...(map.get(x.parentTaskId) ?? []), x])
      else top.push(x)
    }
    map.forEach((arr) => arr.sort((a, b) => a.sortOrder - b.sortOrder))
    return { roots: top, childrenOf: map }
  }, [tasks])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const qc = useQueryClient()
  const { data: mySections } = useMySections(groupBy === 'mysection')
  const groups = useMemo(() => groupTasks(roots, groupBy, (k) => t(k), { list, tags, mySections, manual: sort === 'manual' }),
    [roots, groupBy, t, list, tags, mySections, sort])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ completed: true })
  // Thứ tự đang thấy: nhóm đang mở + việc con đang xổ.
  const ordered = useMemo(() => {
    const out: KpiTask[] = []
    const walk = (x: KpiTask) => { out.push(x); if (expanded[x.id]) (childrenOf.get(x.id) ?? []).forEach(walk) }
    groups.forEach((g) => { if (!collapsed[g.key]) g.tasks.forEach(walk) })
    return out
  }, [groups, childrenOf, expanded, collapsed])
  useEffect(() => { onOrdered?.(ordered.map((x) => x.id)) }, [ordered, onOrdered])
  // Cột KPI chỉ hiện khi có việc gắn KPI (tránh một cột toàn "-" chiếm chỗ của tên việc).
  const kpiCol = showKpi && tasks.some((x) => !!x.kpiId)
  const { columns: allColumns, setColumns, reset: resetColumns } = useTaskColumns(columnsContext ?? list?.id ?? (showKpi ? 'all' : 'kpi'), list?.fields, defaultColumns)
  // Điện thoại: không chia cột (như Lark mobile) — hạn và người thực hiện nằm ngay trong dòng.
  const mobile = useMediaQuery('(max-width: 767px)')
  const [boxWidth, setBoxWidth] = useState(0)
  // Đo bề ngang khung bảng: cột chưa kéo tay co cho vừa khung.
  const boxRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth))
    ro.observe(el)
    setBoxWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  const fixedWidth = (onToggleSelect ? 24 : 0) + TITLE_MIN_WIDTH + 32 + 24
  const columns = mobile ? [] : allColumns.filter((c) => c.visible && (c.key !== 'kpi' || kpiCol))
  // Các cột giữ độ rộng sát nội dung (mặc định của từng cột, hoặc độ rộng người dùng kéo) — không bóp thành "…". Dư chỗ thì
  // cột Tên việc giãn ra; thiếu chỗ thì Tên việc co từ TITLE_MIN_WIDTH xuống tối thiểu 240px, còn thiếu nữa thì cuộn ngang.
  const colsSum = columns.reduce((n, c) => n + c.width, 0)
  const titleMin = !mobile && boxWidth > 0 && fixedWidth + colsSum > boxWidth
    ? Math.max(240, TITLE_MIN_WIDTH - (fixedWidth + colsSum - boxWidth)) : TITLE_MIN_WIDTH
  const tableWidth = mobile ? 0 : fixedWidth - TITLE_MIN_WIDTH + titleMin + colsSum
  const [dragging, setDragging] = useState<KpiTask | null>(null)
  const m = useTaskMutations()
  const { drop, dialog } = useGroupDrop(onRequestAssign)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )
  const selectable = !!onToggleSelect

  const reorder = useReorderGroup(list, mySections)
  const onDragStart = (e: DragStartEvent) => setDragging(tasks.find((x) => x.id === e.active.id) ?? null)

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null)
    // Kéo đầu nhóm ⇒ đổi thứ tự nhóm (thả lên đầu nhóm hoặc một dòng của nhóm đích).
    const activeId = String(e.active.id)
    if (activeId.startsWith('grphandle:')) {
      const over = e.over?.id ? String(e.over.id) : null
      const target = over?.startsWith('group:') ? over.slice(6)
        : over?.startsWith('row:') ? groups.find((g) => g.tasks.some((x) => `row:${x.id}` === over))?.key : undefined
      if (target) reorder(activeId.slice(10), target)
      return
    }
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
    if (sort !== 'manual' || !overTask || overTask.id === task.id) return
    const rest = group.tasks.filter((x) => x.id !== task.id)
    const idx = rest.findIndex((x) => x.id === overTask.id)
    if (list) {
      // Thứ tự trong danh sách gắn với CẶP (việc, danh sách) — biên tập danh sách kéo được cả việc của người khác.
      const at = (x?: KpiTask) => x?.lists.find((l) => l.listId === list.id)?.sortOrder
      const before = at(rest[idx - 1]), after = at(rest[idx])
      const order = before != null && after != null ? (before + after) / 2 : before != null ? before + 1 : after != null ? after - 1 : 0
      m.moveInList.mutate({ listId: list.id, taskId: task.id, sortOrder: order }, { onError: (er) => toast.error(getApiErrorMessage(er)) })
      return
    }
    if (!task.canEdit) return
    const order = sortOrderBetween(rest[idx - 1], rest[idx])
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

  // Nhóm rỗng chỉ có ích khi còn dòng "Việc mới" để thêm nhanh; không thêm được (vd. mục "Đã hoàn thành") thì bỏ —
  // trước đây mục đó hiện "Hôm nay 0 · Ngày mai 0 · Tuần này 0 · Không có hạn 0" vô nghĩa phía trên việc đã xong.
  const shownGroups = allowQuickAdd ? groups : groups.filter((g) => g.tasks.length > 0)

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}>
      {/* Bảng cuộn trong khung riêng: dòng tiêu đề cột dính trên cùng, thiếu bề ngang thì cuộn ngang (như Lark). */}
      <div ref={boxRef} className="custom-scrollbar mb-4 max-h-[calc(100dvh-240px)] min-h-[240px] overflow-auto rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
       <div style={{ minWidth: tableWidth, ['--task-title-min' as string]: `${titleMin}px` }}>
        {!mobile && <TaskTableHeader columns={columns} allColumns={showKpi ? allColumns : allColumns.filter((c) => c.key !== 'kpi')} onColumns={setColumns} onReset={resetColumns}
          fields={list?.fields} selectable={selectable} />}
        {shownGroups.map((g) => (
          <GroupSection
            key={g.key}
            group={g}
            collapsed={!!collapsed[g.key]}
            onToggle={() => setCollapsed((c) => ({ ...c, [g.key]: !c[g.key] }))}
            activeTaskId={activeTaskId}
            onOpen={onOpen}
            columns={columns}
            childrenOf={childrenOf}
            expanded={expanded}
            onToggleExpand={(id) => setExpanded((e) => ({ ...e, [id]: !e[id] }))}
            defaultKpiId={defaultKpiId}
            allowQuickAdd={allowQuickAdd && !g.completed && g.preset !== undefined}
            list={list}
            selectable={selectable}
            selectedIds={selectedIds}
            onToggleSelect={(task, shift) => onToggleSelect?.(task, shift, ordered)}
          />
        ))}
        {groupBy === 'section' && list && !list.archived && list.role !== 'VIEWER' && <AddSectionInline list={list} variant="row" />}
        {groupBy === 'mysection' && (
          <AddSectionInline variant="row"
            onCreate={(name) => mySectionApi.create(name).then(() => qc.invalidateQueries({ queryKey: taskKeys.mySections }))} />
        )}
        {footer}
       </div>
      </div>
      <DragOverlay>
        {dragging && (
          <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl">
            <TaskRow task={dragging} onOpen={() => {}} />
          </div>
        )}
      </DragOverlay>
      {dialog}
    </DndContext>
  )
}

function GroupSection({ group, collapsed, onToggle, activeTaskId, onOpen, columns, childrenOf, expanded, onToggleExpand, defaultKpiId,
  allowQuickAdd, list, selectable, selectedIds, onToggleSelect }: {
  group: TaskGroup
  collapsed: boolean
  onToggle: () => void
  activeTaskId?: string | null
  onOpen: (t: KpiTask) => void
  columns: TaskColumn[]
  childrenOf: Map<string, KpiTask[]>
  expanded: Record<string, boolean>
  onToggleExpand: (id: string) => void
  defaultKpiId?: string
  allowQuickAdd: boolean
  list?: TaskListDetail | null
  selectable: boolean
  selectedIds?: Set<string>
  onToggleSelect: (task: KpiTask, shift: boolean) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `group:${group.key}`, disabled: !group.preset })
  const { t } = useTranslation('tasks')
  const { setNodeRef: setHandleRef, attributes: handleAttrs, listeners: handleListeners, isDragging: handleDragging } =
    useDraggable({ id: `grphandle:${group.key}`, disabled: !isReorderableGroup(group.key, list) })
  // Thêm nhanh trong danh sách: luôn vào danh sách đang xem (+ nhóm / trường của nhóm).
  const preset: GroupPreset | undefined = group.preset && list ? { listId: list.id, ...group.preset } : group.preset
  const rowProps = { activeTaskId, onOpen, columns, list, selectable, selectedIds, onToggleSelect, childrenOf, expanded, onToggleExpand }
  return (
    <section ref={setNodeRef} className={cn('transition-colors', isOver && 'bg-[var(--color-primary-soft)]')}>
      <button
        ref={setHandleRef}
        {...handleAttrs}
        {...handleListeners}
        type="button"
        onClick={onToggle}
        className={cn('sticky left-0 flex h-11 w-full items-center gap-1.5 bg-[var(--color-card)] px-2 text-left text-[15px] font-medium hover:bg-[var(--color-muted)]',
          handleDragging && 'opacity-40 ring-2 ring-[var(--color-primary)]')}
        title={isReorderableGroup(group.key, list) ? t('list.dragGroupHint') : undefined}
      >
        {/* Lark: tam giác đặc ▸ / ▾ */}
        <ChevronRight size={15} className={cn('fill-current transition-transform', !collapsed && 'rotate-90')} />
        {group.color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: group.color }} />}
        <span className={cn('text-[var(--color-foreground)]', group.tone)}>{group.label}</span>
        <span className="text-sm font-normal text-[var(--color-subtle-foreground)]">{group.tasks.length}</span>
        {group.key.startsWith('mysection:') && group.key !== 'mysection:none' && (
          <span className="ml-auto" onClick={(e) => e.stopPropagation()}><MySectionMenu sectionId={group.key.slice(10)} name={group.label} /></span>
        )}
      </button>
      {!collapsed && (
        <div>
          {group.tasks.map((task) => (
            <Fragment key={task.id}>
              <DraggableRow task={task} {...rowProps} />
              {expanded[task.id] && <SubtaskRows parentId={task.id} depth={1} {...rowProps} />}
            </Fragment>
          ))}
          {allowQuickAdd && preset && <TaskQuickAddRow preset={preset} defaultKpiId={defaultKpiId} />}
          {!allowQuickAdd && group.tasks.length === 0 && <div className="h-2" />}
        </div>
      )}
    </section>
  )
}

interface RowProps {
  activeTaskId?: string | null
  onOpen: (t: KpiTask) => void
  columns: TaskColumn[]
  list?: TaskListDetail | null
  selectable: boolean
  selectedIds?: Set<string>
  onToggleSelect: (task: KpiTask, shift: boolean) => void
  childrenOf: Map<string, KpiTask[]>
  expanded: Record<string, boolean>
  onToggleExpand: (id: string) => void
}

/**
 * Việc con lồng dưới việc cha (đệ quy theo cấp), thụt lề theo cấp; không kéo thả (đổi chỗ trong chi tiết việc cha).
 * Việc con không có sẵn trong kết quả (vd. danh sách chỉ chứa việc gốc) thì tải theo việc cha lúc xổ ra.
 */
function SubtaskRows({ parentId, depth, ...p }: RowProps & { parentId: string; depth: number }) {
  const known = p.childrenOf.get(parentId)
  const { data: parent, isLoading } = useTask(known ? null : parentId)
  const children = known ?? parent?.subtasks ?? []
  if (!known && isLoading) {
    return <div className="flex h-9 items-center border-b border-[var(--color-border)] text-xs text-[var(--color-subtle-foreground)]"
      style={{ paddingLeft: 12 + 22 * depth + 44 }}><Loader2 size={13} className="animate-spin" /></div>
  }
  return (
    <>
      {children.map((c) => (
        <Fragment key={c.id}>
          <TaskRow task={c} active={c.id === p.activeTaskId} onOpen={p.onOpen} columns={p.columns} fields={p.list?.fields}
            indent={depth} expandable={(p.childrenOf.get(c.id)?.length ?? 0) > 0 || c.subtaskTotal > 0} expanded={!!p.expanded[c.id]}
            onToggleExpand={() => p.onToggleExpand(c.id)}
            selectable={p.selectable} selected={!!p.selectedIds?.has(c.id)} onToggleSelect={p.onToggleSelect} />
          {p.expanded[c.id] && <SubtaskRows parentId={c.id} depth={depth + 1} {...p} />}
        </Fragment>
      ))}
    </>
  )
}

function DraggableRow({ task, activeTaskId, onOpen, columns, list, selectable, selectedIds, onToggleSelect, childrenOf, expanded, onToggleExpand }:
  RowProps & { task: KpiTask }) {
  // Trong danh sách, biên tập kéo được cả việc mình không sửa (chỉ đổi chỗ trong danh sách).
  const canDrag = task.canEdit || (!!list && (list.role === 'OWNER' || list.role === 'EDITOR'))
  const drag = useDraggable({ id: task.id, disabled: !canDrag })
  const drop = useDroppable({ id: `row:${task.id}` })
  return (
    <div ref={(el) => { drag.setNodeRef(el); drop.setNodeRef(el) }}
      className={cn(drop.isOver && 'border-t-2 border-[var(--color-primary)]')}>
      <TaskRow
        task={task}
        active={task.id === activeTaskId}
        onOpen={onOpen}
        columns={columns}
        fields={list?.fields}
        dragging={drag.isDragging}
        // Không kéo được thì KHÔNG rải thuộc tính của dnd-kit: nó gắn aria-disabled="true" lên cả dòng,
        // trình đọc màn hình báo dòng "bị vô hiệu" dù bấm vẫn mở việc (và Playwright từ chối bấm).
        dragHandleProps={canDrag ? { ...drag.attributes, ...drag.listeners } : undefined}
        selectable={selectable}
        selected={!!selectedIds?.has(task.id)}
        onToggleSelect={onToggleSelect}
        expandable={(childrenOf.get(task.id)?.length ?? 0) > 0 || task.subtaskTotal > 0}
        expanded={!!expanded[task.id]}
        onToggleExpand={() => onToggleExpand(task.id)}
      />
    </div>
  )
}
