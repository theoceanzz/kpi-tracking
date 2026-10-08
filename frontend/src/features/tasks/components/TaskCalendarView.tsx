import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { intlLocale } from '@/i18n/format'
import { cn } from '@/lib/utils'
import { useGroupDrop } from '../hooks/useGroupDrop'
import { useTaskList } from '../hooks/useTasks'
import { addDays, isClosed, PRIORITY_COLOR, todayIso, weekdayOf } from '../taskUtils'
import type { KpiTask, TaskListParams } from '../types'

interface Props {
  /** Bộ lọc của trang (chế độ xem, KPI, trạng thái…) — Lịch tự thêm khoảng ngày. */
  params: TaskListParams
  activeTaskId?: string | null
  onOpen: (task: KpiTask) => void
  onCreateOn: (date: string) => void
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
 * Chế độ Lịch (tháng / tuần; điện thoại mặc định tuần): việc hiện ở ngày hạn, màu theo ưu tiên. Kéo sang ngày khác ⇒ đổi
 * hạn; kéo từ khu "Chưa có hạn" vào ô ngày ⇒ đặt hạn; kéo ra khu đó ⇒ xoá hạn. Bấm ô ngày trống ⇒ tạo việc với hạn ngày
 * đó. Kỳ đã khoá: thẻ không kéo được (máy chủ cũng chặn).
 */
export default function TaskCalendarView({ params, activeTaskId, onOpen, onCreateOn }: Props) {
  const { t } = useTranslation('tasks')
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  const [span, setSpan] = useState<Span>(isMobile ? 'week' : 'month')
  const [anchor, setAnchor] = useState(todayIso())
  const [dragging, setDragging] = useState<KpiTask | null>(null)
  const drop = useGroupDrop()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor))

  const days = useMemo(() => {
    const start = span === 'week' ? mondayOf(anchor) : mondayOf(monthStart(anchor))
    const count = span === 'week' ? 7 : 42
    return Array.from({ length: count }, (_, i) => addDays(start, i))
  }, [span, anchor])
  const from = days[0]!
  const to = days[days.length - 1]!

  const { data: ranged, isFetching } = useTaskList({ ...params, due: undefined, dueFrom: from, dueTo: to, size: 500 })
  const { data: noDue } = useTaskList({ ...params, due: 'NONE', dueFrom: undefined, dueTo: undefined, size: 200 })
  const byDay = useMemo(() => {
    const map = new Map<string, KpiTask[]>()
    for (const task of ranged?.content ?? []) {
      if (!task.dueDate) continue
      const list = map.get(task.dueDate) ?? []
      list.push(task)
      map.set(task.dueDate, list)
    }
    return map
  }, [ranged])
  const all = useMemo(() => [...(ranged?.content ?? []), ...(noDue?.content ?? [])], [ranged, noDue])

  const move = (dir: number) => {
    if (span === 'week') setAnchor(addDays(anchor, dir * 7))
    else {
      const [y, m] = anchor.split('-').map(Number)
      const d = new Date(Date.UTC(y!, m! - 1 + dir, 1))
      setAnchor(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`)
    }
  }

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null)
    const task = all.find((x) => x.id === e.active.id)
    const over = e.over?.id ? String(e.over.id) : null
    if (!task || !over) return
    if (over === 'nodue') drop(task, { dueDate: null })
    else if (over.startsWith('day:')) drop(task, { dueDate: over.slice(4) })
  }

  const title = new Intl.DateTimeFormat(intlLocale(), span === 'month' ? { month: 'long', year: 'numeric' } : { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(`${span === 'month' ? monthStart(anchor) : from}T00:00:00`))
  const weekdayNames = Array.from({ length: 7 }, (_, i) => t(`weekday.${i + 1}`))
  const today = todayIso()
  const currentMonth = anchor.slice(0, 7)

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setDragging(all.find((x) => x.id === e.active.id) ?? null)}
      onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Button size="icon-sm" variant="ghost" aria-label={t('calendar.prev')} onClick={() => move(-1)}><ChevronLeft /></Button>
            <Button size="sm" variant="outline" onClick={() => setAnchor(todayIso())}>{t('calendar.today')}</Button>
            <Button size="icon-sm" variant="ghost" aria-label={t('calendar.next')} onClick={() => move(1)}><ChevronRight /></Button>
            <span className="text-sm font-medium capitalize text-[var(--color-foreground)]">{span === 'week' ? `${t('calendar.weekOf')} ${title}` : title}</span>
            {isFetching && <Loader2 size={14} className="animate-spin text-[var(--color-subtle-foreground)]" />}
            <div className="flex-1" />
            <div className="inline-flex rounded-card border border-[var(--color-border)] p-0.5">
              {(['month', 'week'] as Span[]).map((s) => (
                <Button key={s} size="sm" variant={span === s ? 'secondary' : 'ghost'} onClick={() => setSpan(s)}>{t(`calendar.${s}`)}</Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-7 overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-border)] gap-px">
            {weekdayNames.map((n) => (
              <div key={n} className="bg-[var(--color-muted)] px-2 py-1 text-center text-[11px] font-medium text-[var(--color-subtle-foreground)]">{n}</div>
            ))}
            {days.map((d) => (
              <DayCell key={d} date={d} tasks={byDay.get(d) ?? []} today={d === today}
                dim={span === 'month' && d.slice(0, 7) !== currentMonth} tall={span === 'week'}
                activeTaskId={activeTaskId} onOpen={onOpen} onCreate={() => onCreateOn(d)} />
            ))}
          </div>
        </div>
        <NoDueArea tasks={noDue?.content ?? []} activeTaskId={activeTaskId} onOpen={onOpen} />
      </div>
      <DragOverlay>{dragging && <Chip task={dragging} onOpen={() => {}} />}</DragOverlay>
    </DndContext>
  )
}

function DayCell({ date, tasks, today, dim, tall, activeTaskId, onOpen, onCreate }: {
  date: string; tasks: KpiTask[]; today: boolean; dim: boolean; tall: boolean
  activeTaskId?: string | null; onOpen: (t: KpiTask) => void; onCreate: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${date}` })
  const { t } = useTranslation('tasks')
  const shown = tall ? tasks : tasks.slice(0, 3)
  return (
    <div ref={setNodeRef} onClick={(e) => { if (e.target === e.currentTarget) onCreate() }}
      className={cn('flex cursor-pointer flex-col gap-1 bg-[var(--color-card)] p-1.5', tall ? 'min-h-[320px]' : 'min-h-[104px]',
        dim && 'bg-[var(--color-muted)]', isOver && 'bg-[var(--color-primary-soft)]')}
      title={t('calendar.clickToCreate')}>
      <span onClick={onCreate} className={cn('self-end rounded-full px-1.5 text-xs', today ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'text-[var(--color-subtle-foreground)]')}>
        {Number(date.slice(8))}
      </span>
      {shown.map((task) => <DraggableChip key={task.id} task={task} active={task.id === activeTaskId} onOpen={onOpen} />)}
      {tasks.length > shown.length && <span className="px-1 text-[11px] text-[var(--color-subtle-foreground)]">+{tasks.length - shown.length}</span>}
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
        {tasks.map((task) => <DraggableChip key={task.id} task={task} active={task.id === activeTaskId} onOpen={onOpen} />)}
      </div>
    </aside>
  )
}

function DraggableChip({ task, active, onOpen }: { task: KpiTask; active: boolean; onOpen: (t: KpiTask) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: !task.canEdit })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn(isDragging && 'opacity-40')}>
      <Chip task={task} active={active} onOpen={onOpen} />
    </div>
  )
}

function Chip({ task, active, onOpen }: { task: KpiTask; active?: boolean; onOpen: (t: KpiTask) => void }) {
  const color = PRIORITY_COLOR[task.priority]
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(task) }}
      className={cn('w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] text-[var(--color-foreground)]',
        isClosed(task) && 'line-through opacity-60', active && 'ring-1 ring-[var(--color-primary)]', task.canEdit ? 'cursor-grab' : 'cursor-pointer')}
      style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, borderLeft: `3px solid ${color}` }}
      title={task.title}>
      {task.dueTime && <span className="mr-1 text-[var(--color-subtle-foreground)]">{task.dueTime.slice(0, 5)}</span>}
      {task.title}
    </button>
  )
}
