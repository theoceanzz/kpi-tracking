import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { intlLocale } from '@/i18n/format'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { useGroupDrop } from '../hooks/useGroupDrop'
import { useTaskList, useTaskMutations } from '../hooks/useTasks'
import { addDays, daysBetween, isClosed, isTimedTask, PRIORITY_COLOR, spanOf, timeOf, todayIso, TOGGLE_ON, weekdayOf, weekSlotAt } from '../taskUtils'
import type { KpiTask, TaskListParams } from '../types'
import TaskWeekGrid from './TaskWeekGrid'

interface Props {
  /** Bộ lọc của trang (chế độ xem, KPI, trạng thái…) — Lịch tự thêm khoảng ngày. */
  params: TaskListParams
  activeTaskId?: string | null
  onOpen: (task: KpiTask) => void
  /** Bấm ô ngày (tháng) / ô giờ (tuần, kèm giờ HH:mm). */
  onCreateOn: (date: string, time?: string) => void
}

type Span = 'month' | 'week'

/** Thứ 2 của tuần chứa ngày. */
function mondayOf(iso: string): string {
  const wd = weekdayOf(iso) // 0 = CN
  return addDays(iso, wd === 0 ? -6 : 1 - wd)
}

function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

/**
 * Chế độ Lịch (tháng / tuần; điện thoại mặc định tuần): việc hiện ở MỌI ngày từ ngày bắt đầu tới hạn (việc chỉ có hạn
 * hiện ở ngày hạn), màu theo ưu tiên. Tuần = dải "Cả ngày" (việc không giờ / nhiều ngày) + lưới giờ (`TaskWeekGrid`, việc
 * có giờ trong một ngày); thả việc vào ô giờ ⇒ đặt hạn kèm giờ. Kéo sang ngày khác ⇒ dời hạn (việc có ngày bắt đầu dời cả khoảng); kéo từ khu
 * "Chưa có hạn" vào ô ngày ⇒ đặt hạn; kéo ra khu đó ⇒ xoá hạn. Bấm ô ngày trống ⇒ tạo việc với hạn ngày đó.
 */
export default function TaskCalendarView({ params, activeTaskId, onOpen, onCreateOn }: Props) {
  const { t } = useTranslation('tasks')
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  const [span, setSpan] = useState<Span>(isMobile ? 'week' : 'month')
  const [anchor, setAnchor] = useState(todayIso())
  const [dragging, setDragging] = useState<{ task: KpiTask; day: string } | null>(null)
  const { drop, dialog } = useGroupDrop()
  const m = useTaskMutations()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor))

  // Điện thoại: "tuần" là 3 ngày bắt đầu từ ngày đang chọn (như Lark bản di động) — 7 cột giờ không đủ chỗ.
  const threeDay = span === 'week' && isMobile
  const cols = threeDay ? 3 : 7
  const days = useMemo(() => {
    const start = threeDay ? anchor : span === 'week' ? mondayOf(anchor) : mondayOf(monthStart(anchor))
    const count = threeDay ? 3 : span === 'week' ? 7 : 42
    return Array.from({ length: count }, (_, i) => addDays(start, i))
  }, [span, anchor, threeDay])
  const from = days[0]!
  const to = days[days.length - 1]!

  const { data: ranged, isFetching } = useTaskList({ ...params, due: undefined, rangeFrom: from, rangeTo: to, size: 500 })
  const { data: noDue } = useTaskList({ ...params, due: 'NONE', dueFrom: undefined, dueTo: undefined, size: 200 })
  // Mỗi tuần một hàng; việc nhiều ngày là MỘT thanh liền qua các ô (như Lark), xếp làn để không đè nhau.
  const weeks = useMemo(() => {
    const out: WeekRow[] = []
    // Tuần: việc có giờ trong một ngày nằm ở lưới giờ, dải "Cả ngày" chỉ còn phần còn lại.
    const barTasks = (ranged?.content ?? []).filter((x) => span === 'month' || !isTimedTask(x))
    for (let i = 0; i < days.length; i += cols) out.push(layoutWeek(days.slice(i, i + cols), barTasks, span === 'week' ? WEEK_LANES : MONTH_LANES))
    return out
  }, [days, ranged, span, cols])
  const timed = useMemo(() => (span === 'week' ? (ranged?.content ?? []).filter(isTimedTask) : []), [ranged, span])
  const all = useMemo(() => [...(ranged?.content ?? []), ...(noDue?.content ?? [])], [ranged, noDue])

  const move = (dir: number) => {
    if (span === 'week') setAnchor(addDays(anchor, dir * cols))
    else {
      const [y, mo] = anchor.split('-').map(Number)
      const d = new Date(Date.UTC(y!, mo! - 1 + dir, 1))
      setAnchor(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`)
    }
  }

  const onDragEnd = (e: DragEndEvent) => {
    const from = dragging
    setDragging(null)
    const task = all.find((x) => x.id === String(e.active.id).split('@')[0])
    const over = e.over?.id ? String(e.over.id) : null
    if (!task || !over) return
    if (over === 'nodue') { drop(task, { dueDate: null }); return }
    // Thả vào lưới giờ: hạn = ngày + giờ dưới con trỏ (việc nhiều ngày giữ nguyên độ dài theo ngày).
    if (over.startsWith('time:')) {
      const p = e.activatorEvent as PointerEvent
      const slot = 'clientX' in p ? weekSlotAt(p.clientX + e.delta.x, p.clientY + e.delta.y) : null
      if (!slot) return
      if (!task.canEdit) { toast.error(t(`readOnly.${task.readOnlyReason ?? 'NOT_OWNER'}`)); return }
      const input = task.startDate && task.dueDate && from
        ? { startDate: addDays(task.startDate, daysBetween(from.day, slot.day)), dueDate: addDays(task.dueDate, daysBetween(from.day, slot.day)) }
        : { dueDate: slot.day }
      m.update.mutate({ id: task.id, input: { version: task.version, ...input, dueTime: timeOf(slot.minutes) } },
        { onError: (er) => toast.error(getApiErrorMessage(er)) })
      return
    }
    if (!over.startsWith('day:')) return
    const target = over.slice(4)
    // Có ngày bắt đầu: dời CẢ khoảng theo số ngày đã kéo (kéo từ ô nào thì tính từ ô đó).
    if (task.startDate && task.dueDate && from) {
      const delta = daysBetween(from.day, target)
      if (delta === 0) return
      if (!task.canEdit) { toast.error(t(`readOnly.${task.readOnlyReason ?? 'NOT_OWNER'}`)); return }
      m.update.mutate({ id: task.id, input: { version: task.version, startDate: addDays(task.startDate, delta), dueDate: addDays(task.dueDate, delta) } },
        { onError: (er) => toast.error(getApiErrorMessage(er)) })
      return
    }
    drop(task, { dueDate: target })
  }

  const title = new Intl.DateTimeFormat(intlLocale(), span === 'month' ? { month: 'long', year: 'numeric' } : { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(`${span === 'month' ? monthStart(anchor) : from}T00:00:00`))
  // Nhãn thứ theo đúng ngày của cột (3 ngày trên điện thoại không bắt đầu từ thứ 2). weekday.1 = thứ 2 … weekday.7 = CN.
  const weekdayNames = days.slice(0, cols).map((d) => t(`weekday.${weekdayOf(d) === 0 ? 7 : weekdayOf(d)}`))
  const today = todayIso()
  const currentMonth = anchor.slice(0, 7)

  return (
    <DndContext sensors={sensors}
      onDragStart={(e) => {
        const [id, day] = String(e.active.id).split('@')
        const task = all.find((x) => x.id === id)
        if (task) setDragging({ task, day: day ?? task.dueDate ?? today })
      }}
      onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Button size="icon-sm" variant="ghost" aria-label={t('calendar.prev')} onClick={() => move(-1)}><ChevronLeft /></Button>
            <Button size="sm" variant="outline" onClick={() => setAnchor(todayIso())}>{t('calendar.today')}</Button>
            <Button size="icon-sm" variant="ghost" aria-label={t('calendar.next')} onClick={() => move(1)}><ChevronRight /></Button>
            <span className={cn('text-sm font-medium text-[var(--color-foreground)]', span === 'month' && 'capitalize')}>{span === 'week' ? `${t(threeDay ? 'calendar.threeDaysOf' : 'calendar.weekOf')} ${title}` : title}</span>
            {isFetching && <Loader2 size={14} className="animate-spin text-[var(--color-subtle-foreground)]" />}
            <div className="flex-1" />
            <div className="inline-flex rounded-card border border-[var(--color-border)] p-0.5">
              {(['month', 'week'] as Span[]).map((s) => (
                <Button key={s} size="sm" variant="ghost" aria-pressed={span === s} className={cn(span === s && TOGGLE_ON)} onClick={() => setSpan(s)}>{t(s === 'week' && isMobile ? 'calendar.threeDays' : `calendar.${s}`)}</Button>
              ))}
            </div>
          </div>
          <div className={cn(span === 'week' && 'overflow-x-auto')}>
          <div className={cn('overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-border)]', span === 'week' && !threeDay && 'min-w-[560px]')}>
            {/* Tuần: cột nhãn giờ bên trái để dải "Cả ngày" thẳng cột với lưới giờ. */}
            <div className={cn(span === 'week' && 'grid grid-cols-[48px_minmax(0,1fr)] gap-px')}>
            {span === 'week' && (
              <div className="flex items-end justify-center bg-[var(--color-muted)] pb-1.5 text-[11px] text-[var(--color-subtle-foreground)]">{t('calendar.allDay')}</div>
            )}
            <div>
            <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {weekdayNames.map((n) => (
                <div key={n} className="bg-[var(--color-muted)] px-2 py-1 text-center text-xs font-medium text-[var(--color-subtle-foreground)]">{n}</div>
              ))}
            </div>
            {weeks.map((w) => (
              <div key={w.days[0]} className="relative mt-px grid gap-px" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {w.days.map((d, i) => (
                  <DayCell key={d} date={d} hidden={w.hidden[i]!} today={d === today}
                    dim={span === 'month' && d.slice(0, 7) !== currentMonth}
                    minHeight={span === 'week' ? BAR_TOP + Math.max(w.lanes, 1) * BAR_H + 6 : BAR_TOP + Math.max(w.lanes, MONTH_LANES) * BAR_H + 22}
                    onCreate={() => onCreateOn(d)} />
                ))}
                {/* Thanh việc: lớp nổi trên các ô, chỉ thanh nhận chuột (ô bên dưới vẫn nhận thả / bấm để tạo). */}
                <div className="pointer-events-none absolute inset-x-0" style={{ top: BAR_TOP }}>
                  {w.bars.map((b) => (
                    <div key={`${b.task.id}@${b.start}`} className="pointer-events-auto absolute px-0.5"
                      style={{ left: `${(b.col / cols) * 100}%`, width: `${(b.len / cols) * 100}%`, top: b.lane * BAR_H, height: BAR_H - 2 }}>
                      <DraggableChip task={b.task} day={b.start} active={b.task.id === activeTaskId} onOpen={onOpen}
                        startsHere={b.startsHere} endsHere={b.endsHere} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            </div>
            </div>
            {span === 'week' && (
              <div className="mt-px">
                <TaskWeekGrid days={days} tasks={timed} activeTaskId={activeTaskId} onOpen={onOpen} onCreateAt={(d, time) => onCreateOn(d, time)} />
              </div>
            )}
          </div>
          </div>
        </div>
        <NoDueArea tasks={noDue?.content ?? []} activeTaskId={activeTaskId} onOpen={onOpen} />
      </div>
      <DragOverlay>{dragging && <Chip task={dragging.task} day={dragging.day} onOpen={() => {}} />}</DragOverlay>
      {dialog}
    </DndContext>
  )
}

function DayCell({ date, hidden, today, dim, minHeight, onCreate }: {
  date: string; hidden: number; today: boolean; dim: boolean; minHeight: number; onCreate: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${date}` })
  const { t } = useTranslation('tasks')
  return (
    <div ref={setNodeRef} data-day={date} onClick={(e) => { if (e.target === e.currentTarget) onCreate() }}
      className={cn('relative flex cursor-pointer flex-col bg-[var(--color-card)] p-1.5', dim && 'bg-[var(--color-muted)]',
        isOver && 'bg-[var(--color-primary-soft)]')}
      style={{ minHeight }} title={t('calendar.clickToCreate')}>
      <span onClick={onCreate} className={cn('flex h-5 min-w-5 items-center justify-center self-end rounded-full px-1 text-xs',
        today ? 'bg-[var(--color-primary)] font-semibold text-[var(--color-primary-foreground)]' : 'text-[var(--color-subtle-foreground)]')}>
        {Number(date.slice(8))}
      </span>
      {hidden > 0 && <span className="absolute bottom-1 left-1.5 text-[11px] text-[var(--color-subtle-foreground)]">+{hidden}</span>}
    </div>
  )
}

function NoDueArea({ tasks, activeTaskId, onOpen }: { tasks: KpiTask[]; activeTaskId?: string | null; onOpen: (t: KpiTask) => void }) {
  const { t } = useTranslation('tasks')
  const { setNodeRef, isOver } = useDroppable({ id: 'nodue' })
  return (
    <aside ref={setNodeRef} className={cn('w-full shrink-0 rounded-card border bg-[var(--color-muted)] p-2 lg:w-64',
      isOver ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]')}>
      <p className="mb-2 px-1 text-sm font-medium text-[var(--color-foreground)]">{t('calendar.noDue')} <span className="text-xs font-normal text-[var(--color-subtle-foreground)]">{tasks.length}</span></p>
      <p className="mb-2 px-1 text-[11px] text-[var(--color-subtle-foreground)]">{t('calendar.noDueHint')}</p>
      <div className="flex max-h-[560px] flex-col gap-1 overflow-y-auto">
        {tasks.map((task) => <DraggableChip key={task.id} task={task} day={null} active={task.id === activeTaskId} onOpen={onOpen} />)}
      </div>
    </aside>
  )
}

function DraggableChip({ task, day, active, onOpen, startsHere = true, endsHere = true }: {
  task: KpiTask; day: string | null; active: boolean; onOpen: (t: KpiTask) => void; startsHere?: boolean; endsHere?: boolean
}) {
  // Một việc kéo dài hiện ở nhiều ô — id kéo mang ngày của ô để biết dời bao nhiêu ngày.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: day ? `${task.id}@${day}` : task.id, disabled: !task.canEdit })
  const resizable = !!day && task.canEdit && !isClosed(task)
  return (
    // Không kéo được ⇒ bỏ thuộc tính dnd-kit (aria-disabled="true" làm việc bị coi là vô hiệu dù bấm vẫn mở).
    <div ref={setNodeRef} {...(task.canEdit ? attributes : {})} {...(task.canEdit ? listeners : {})}
      className={cn('group/bar relative h-full', isDragging && 'opacity-40')}>
      <Chip task={task} day={day} active={active} onOpen={onOpen} startsHere={startsHere} endsHere={endsHere} />
      {resizable && startsHere && <ResizeHandle task={task} edge="start" />}
      {resizable && endsHere && <ResizeHandle task={task} edge="end" />}
    </div>
  )
}

/**
 * Tay nắm ở mép thanh (như Lark): kéo mép trái đổi ngày bắt đầu (việc chưa có ngày bắt đầu thì đặt mới), kéo mép phải
 * đổi hạn. Ngày đích = ô ngày dưới con trỏ lúc thả; bắt đầu không vượt quá hạn và ngược lại.
 */
function ResizeHandle({ task, edge }: { task: KpiTask; edge: 'start' | 'end' }) {
  const { t } = useTranslation('tasks')
  const { update } = useTaskMutations()
  const [hover, setHover] = useState<string | null>(null)
  const dayAt = (x: number, y: number) =>
    (document.elementsFromPoint(x, y).find((el) => el instanceof HTMLElement && el.dataset.day) as HTMLElement | undefined)?.dataset.day ?? null
  return (
    <span aria-hidden title={edge === 'start' ? t('calendar.dragStart') : t('calendar.dragEnd')}
      onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); (e.target as HTMLElement).setPointerCapture(e.pointerId) }}
      onPointerMove={(e) => { if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) setHover(dayAt(e.clientX, e.clientY)) }}
      onPointerUp={(e) => {
        const day = dayAt(e.clientX, e.clientY)
        setHover(null)
        if (!day) return
        const s = spanOf(task)
        if (!s) return
        if (edge === 'end') {
          const due = day < s.from ? s.from : day
          if (due === task.dueDate) return
          update.mutate({ id: task.id, input: { version: task.version, dueDate: due } }, { onError: (er) => toast.error(getApiErrorMessage(er)) })
        } else {
          const start = task.dueDate && day > task.dueDate ? task.dueDate : day
          if (start === task.startDate) return
          update.mutate({ id: task.id, input: { version: task.version, startDate: start } }, { onError: (er) => toast.error(getApiErrorMessage(er)) })
        }
      }}
      onClick={(e) => e.stopPropagation()}
      className={cn('absolute inset-y-0 z-[1] w-2 cursor-ew-resize rounded opacity-0 group-hover/bar:opacity-100 hover:bg-[var(--color-border-strong)]',
        edge === 'start' ? 'left-0' : 'right-0', hover && 'opacity-100 bg-[var(--color-primary)]')} />
  )
}

function Chip({ task, day, active, onOpen, startsHere = true, endsHere = true }: {
  task: KpiTask; day: string | null; active?: boolean; onOpen: (t: KpiTask) => void; startsHere?: boolean; endsHere?: boolean
}) {
  const color = PRIORITY_COLOR[task.priority]
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(task) }}
      className={cn('flex h-full w-full items-center gap-1 truncate px-1.5 text-left text-xs text-[var(--color-foreground)]',
        startsHere ? 'rounded-l' : 'rounded-l-none', endsHere ? 'rounded-r' : 'rounded-r-none',
        isClosed(task) && 'line-through opacity-60', active && 'ring-1 ring-[var(--color-primary)]', task.canEdit ? 'cursor-grab' : 'cursor-pointer')}
      style={{ backgroundColor: `color-mix(in srgb, ${color} 16%, var(--color-card))`, borderLeft: startsHere ? `3px solid ${color}` : undefined }}
      title={task.title}>
      {task.dueTime && endsHere && day && <span className="shrink-0 text-[var(--color-subtle-foreground)]">{task.dueTime.slice(0, 5)}</span>}
      <span className="truncate">{task.title}</span>
    </button>
  )
}

// ── Xếp thanh trong một tuần ─────────────────────────────────────────────────────────────────────

/** Tháng: tối đa 3 làn mỗi tuần; còn lại ghi "+N" ở từng ngày. */
const MONTH_LANES = 3
/** Tuần: dải "Cả ngày" tối đa ngần này làn (phần lớn việc có giờ đã xuống lưới giờ). */
const WEEK_LANES = 4
const BAR_H = 22
const BAR_TOP = 28

interface WeekBar { task: KpiTask; start: string; col: number; len: number; lane: number; startsHere: boolean; endsHere: boolean }
interface WeekRow { days: string[]; bars: WeekBar[]; hidden: number[]; lanes: number }

/**
 * Xếp các việc giao với một tuần thành thanh: mỗi việc một đoạn [đầu, cuối] cắt theo tuần, sắp theo ngày bắt đầu (dài
 * trước), đặt vào làn thấp nhất còn trống. Đoạn không còn làn thì đếm vào "+N" của từng ngày nó phủ.
 */
function layoutWeek(days: string[], tasks: KpiTask[], maxLanes: number): WeekRow {
  const first = days[0]!, last = days[days.length - 1]!
  const segs: { task: KpiTask; s: string; e: string; startsHere: boolean; endsHere: boolean }[] = []
  for (const task of tasks) {
    const sp = spanOf(task)
    if (!sp || sp.to < first || sp.from > last) continue
    segs.push({ task, s: sp.from < first ? first : sp.from, e: sp.to > last ? last : sp.to, startsHere: sp.from >= first, endsHere: sp.to <= last })
  }
  segs.sort((a, b) => (a.s === b.s ? daysBetween(b.s, b.e) - daysBetween(a.s, a.e) : a.s < b.s ? -1 : 1))
  const laneEnd: string[] = []
  const bars: WeekBar[] = []
  const hidden = days.map(() => 0)
  for (const g of segs) {
    let lane = laneEnd.findIndex((end) => end < g.s)
    if (lane === -1) lane = laneEnd.length
    const col = daysBetween(first, g.s)
    const len = daysBetween(g.s, g.e) + 1
    if (lane >= maxLanes) {
      for (let i = col; i < col + len; i++) hidden[i] = (hidden[i] ?? 0) + 1
      continue
    }
    laneEnd[lane] = g.e
    bars.push({ task: g.task, start: g.s, col, len, lane, startsHere: g.startsHere, endsHere: g.endsHere })
  }
  return { days, bars, hidden, lanes: Math.min(laneEnd.length, maxLanes) }
}
