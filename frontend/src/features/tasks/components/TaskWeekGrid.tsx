import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useDroppable } from '@dnd-kit/core'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { useNow } from '../hooks/useNow'
import { useTaskMutations } from '../hooks/useTasks'
import {
  daysBetween, isClosed, PRIORITY_COLOR, timedRange, timeOf, todayIso, WEEK_HOUR_H, WEEK_SNAP_MIN, weekSlotAt,
} from '../taskUtils'
import type { KpiTask, UpdateTaskInput } from '../types'

interface Props {
  days: string[]
  /** Chỉ những việc `isTimedTask` của tuần. */
  tasks: KpiTask[]
  activeTaskId?: string | null
  onOpen: (task: KpiTask) => void
  onCreateAt: (date: string, time: string) => void
}

type Mode = 'move' | 'top' | 'bottom'
interface Drag { task: KpiTask; mode: Mode; x: number; y: number; moved: boolean; day: string; dMin: number }

const DAY_MIN = 24 * 60

/**
 * Khoảng mới của khối sau khi kéo {@code dMin} phút. `due` = phút của giờ hạn (khối chỉ có giờ hạn: giờ hạn là ĐẦU khối).
 * Khối chỉ có giờ hạn kéo mép trên xuống thì không đổi (không có giờ bắt đầu nào nằm sau giờ hạn).
 */
function dragged(task: KpiTask, mode: Mode, dMin: number): { start: number; end: number; due: number; shift: number } {
  const r = timedRange(task)
  const due = r.ranged ? r.end : r.start
  if (mode === 'move') {
    const shift = Math.max(-r.start, Math.min(DAY_MIN - 1 - due, dMin))
    return { start: r.start + shift, end: r.end + shift, due: due + shift, shift }
  }
  if (mode === 'bottom') {
    const end = Math.max(r.start + WEEK_SNAP_MIN, Math.min(DAY_MIN - 1, r.end + dMin))
    return { start: r.start, end, due: end, shift: 0 }
  }
  if (!r.ranged && dMin > 0) return { ...r, due, shift: 0 }
  const start = Math.max(0, Math.min(due - WEEK_SNAP_MIN, r.start + dMin))
  return { start, end: due, due, shift: 0 }
}
const HOURS = Array.from({ length: 24 }, (_, h) => h)

/**
 * Lưới giờ của Lịch tuần (như Lark Calendar): mỗi ngày một cột 0–24h, việc có giờ là một khối từ giờ bắt đầu tới giờ hạn
 * (chỉ có giờ hạn ⇒ khối 30 phút bắt đầu từ giờ hạn). Kéo khối ⇒ dời ngày / giờ (giữ độ dài), kéo mép trên / dưới ⇒ đổi
 * giờ bắt đầu / giờ hạn, bước 15 phút. Bấm ô trống ⇒ tạo việc với hạn đúng ngày giờ đó. Thả một thanh "Cả ngày" hoặc việc
 * "Chưa có hạn" vào cột (dnd-kit, xử lý ở màn Lịch) ⇒ đặt hạn kèm giờ.
 */
export default function TaskWeekGrid({ days, tasks, activeTaskId, onOpen, onCreateAt }: Props) {
  const { t } = useTranslation('tasks')
  const { update } = useTaskMutations()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const now = useNow()
  const today = todayIso()

  // Mở ra / đổi tuần thì cuộn tới việc sớm nhất trong tuần (không có thì 8:00), như Lark.
  const firstHour = tasks.length ? Math.min(...tasks.map((x) => Math.floor(timedRange(x).start / 60))) : 8
  const weekKey = days[0]
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = Math.max(0, (Math.min(firstHour, 8) - 0.5) * WEEK_HOUR_H)
    // Chạy lại khi đổi tuần hoặc giờ của việc sớm nhất đổi — kéo các khối khác không làm cuộn giật.
  }, [weekKey, firstHour])

  const byDay = new Map<string, KpiTask[]>()
  for (const task of tasks) {
    if (!task.dueDate) continue
    byDay.set(task.dueDate, [...(byDay.get(task.dueDate) ?? []), task])
  }

  const save = (task: KpiTask, input: Omit<UpdateTaskInput, 'version'>) =>
    update.mutate({ id: task.id, input: { version: task.version, ...input } }, { onError: (er) => toast.error(getApiErrorMessage(er)) })

  const finish = (d: Drag) => {
    const { task, mode, dMin, day } = d
    const r = timedRange(task)
    const n = dragged(task, mode, dMin)
    if (mode === 'move') {
      const dayDelta = daysBetween(task.dueDate!, day)
      if (n.shift === 0 && dayDelta === 0) return
      const input: Omit<UpdateTaskInput, 'version'> = { dueDate: day, dueTime: timeOf(n.due) }
      if (task.startDate) input.startDate = day
      if (r.ranged) input.startTime = timeOf(n.start)
      save(task, input)
      return
    }
    if (n.start === r.start && n.end === r.end) return
    // Kéo mép: luôn thành khoảng [bắt đầu, hạn] trong ngày (việc chỉ có giờ hạn có thêm giờ bắt đầu).
    save(task, { startDate: task.dueDate, startTime: timeOf(n.start), dueTime: timeOf(n.due) })
  }

  const begin = (e: RPointerEvent, task: KpiTask, mode: Mode) => {
    if (e.button !== 0) return
    e.stopPropagation()
    if (!task.canEdit || isClosed(task)) return // chỉ xem: onClick mở việc
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDrag({ task, mode, x: e.clientX, y: e.clientY, moved: false, day: task.dueDate!, dMin: 0 })
  }
  const onMove = (e: RPointerEvent) => {
    if (!drag) return
    const moved = drag.moved || Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4
    const dMin = Math.round(((e.clientY - drag.y) / WEEK_HOUR_H) * 60 / WEEK_SNAP_MIN) * WEEK_SNAP_MIN
    const day = drag.mode === 'move' ? weekSlotAt(e.clientX, e.clientY)?.day ?? drag.day : drag.day
    if (moved !== drag.moved || dMin !== drag.dMin || day !== drag.day) setDrag({ ...drag, moved, dMin, day })
  }
  const onUp = () => {
    if (!drag) return
    const d = drag
    setDrag(null)
    if (!d.moved) { if (d.mode === 'move') onOpen(d.task); return }
    finish(d)
  }

  /** Khối đang kéo vẽ theo vị trí xem trước. */
  const preview = (task: KpiTask): { day: string; start: number; end: number } => {
    if (!drag?.moved || drag.task.id !== task.id) return { day: task.dueDate!, ...timedRange(task) }
    const n = dragged(task, drag.mode, drag.dMin)
    return { day: drag.mode === 'move' ? drag.day : task.dueDate!, start: n.start, end: n.end }
  }

  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes()

  return (
    <div ref={scrollRef} className="max-h-[600px] overflow-y-auto bg-[var(--color-border)]" onPointerMove={onMove} onPointerUp={onUp}
      onPointerCancel={() => setDrag(null)}>
      <div className="grid gap-px" style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))` }}>
        {/* Nhãn giờ */}
        <div className="relative bg-[var(--color-card)]" style={{ height: 24 * WEEK_HOUR_H }}>
          {HOURS.slice(1).map((h) => (
            <span key={h} className="absolute right-1.5 -translate-y-1/2 text-[11px] text-[var(--color-subtle-foreground)]" style={{ top: h * WEEK_HOUR_H }}>
              {String(h).padStart(2, '0')}:00
            </span>
          ))}
        </div>
        {days.map((day) => {
          // Khối kéo sang ngày khác: vẽ ở cột đích.
          const own = (byDay.get(day) ?? []).filter((x) => !(drag?.moved && drag.task.id === x.id && drag.day !== day))
          const visiting = drag?.moved && drag.mode === 'move' && drag.day === day && drag.task.dueDate !== day ? [drag.task] : []
          return (
            <DayColumn key={day} day={day} isToday={day === today} nowMin={nowMin} onCreateAt={onCreateAt} title={t('calendar.clickToCreateAt')}>
              {layoutDay([...own, ...visiting].map((task) => ({ task, ...preview(task) }))).map(({ task, start, end, col, cols }) => {
                const color = PRIORITY_COLOR[task.priority]
                const editable = task.canEdit && !isClosed(task)
                const height = Math.max(18, ((end - start) / 60) * WEEK_HOUR_H - 2)
                const dragging = drag?.moved && drag.task.id === task.id
                return (
                  <div key={task.id} role="button" tabIndex={0} title={task.title}
                    onPointerDown={(e) => begin(e, task, 'move')}
                    onClick={() => { if (!editable) onOpen(task) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') onOpen(task) }}
                    className={cn('group/blk absolute select-none overflow-hidden rounded px-1.5 py-0.5 text-xs text-[var(--color-foreground)]',
                      editable ? 'cursor-grab' : 'cursor-pointer', isClosed(task) && 'line-through opacity-60',
                      task.id === activeTaskId && 'ring-1 ring-[var(--color-primary)]', dragging && 'z-[2] cursor-grabbing shadow-lg')}
                    style={{
                      top: (start / 60) * WEEK_HOUR_H + 1, height,
                      left: `calc(${(col / cols) * 100}% + 1px)`, width: `calc(${100 / cols}% - 3px)`,
                      backgroundColor: `color-mix(in srgb, ${color} 18%, var(--color-card))`, borderLeft: `3px solid ${color}`,
                    }}>
                    <div className="truncate font-medium">{task.title}</div>
                    {height > 30 && <div className="truncate text-[11px] text-[var(--color-subtle-foreground)]">{timeOf(start).slice(0, 5)}–{timeOf(Math.min(end, DAY_MIN - 1)).slice(0, 5)}</div>}
                    {editable && (
                      <>
                        <span aria-hidden title={t('calendar.dragStartTime')} onPointerDown={(e) => begin(e, task, 'top')}
                          className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize opacity-0 group-hover/blk:opacity-100 hover:bg-[var(--color-border-strong)]" />
                        <span aria-hidden title={t('calendar.dragEndTime')} onPointerDown={(e) => begin(e, task, 'bottom')}
                          className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize opacity-0 group-hover/blk:opacity-100 hover:bg-[var(--color-border-strong)]" />
                      </>
                    )}
                  </div>
                )
              })}
            </DayColumn>
          )
        })}
      </div>
    </div>
  )
}

function DayColumn({ day, isToday, nowMin, onCreateAt, title, children }: {
  day: string; isToday: boolean; nowMin: number; onCreateAt: (date: string, time: string) => void; title: string; children: ReactNode
}) {
  // Thả thanh "Cả ngày" / việc chưa có hạn vào đây (dnd-kit ở màn Lịch đọc giờ theo toạ độ thả).
  const { setNodeRef, isOver } = useDroppable({ id: `time:${day}` })
  return (
    <div ref={setNodeRef} data-tday={day} title={title}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return
        const slot = weekSlotAt(e.clientX, e.clientY)
        // Bấm ô ⇒ hạn đúng nửa giờ của ô (khỏi ra 9:15 khi bấm hơi lệch).
        if (slot) onCreateAt(day, timeOf(Math.floor(slot.minutes / 30) * 30).slice(0, 5))
      }}
      className={cn('relative cursor-pointer bg-[var(--color-card)]', isToday && 'bg-[color-mix(in_srgb,var(--color-primary)_4%,var(--color-card))]',
        isOver && 'bg-[var(--color-primary-soft)]')}
      style={{
        height: 24 * WEEK_HOUR_H,
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${WEEK_HOUR_H - 1}px, var(--color-border) ${WEEK_HOUR_H - 1}px, var(--color-border) ${WEEK_HOUR_H}px)`,
      }}>
      {children}
      {isToday && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 z-[1] h-px bg-[var(--color-error-solid)]" style={{ top: (nowMin / 60) * WEEK_HOUR_H }}>
          <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-[var(--color-error-solid)]" />
        </div>
      )}
    </div>
  )
}

/** Khối chồng giờ nhau trong một ngày chia cột (như lịch): mỗi cụm chồng nhau chia đều bề ngang theo số làn của cụm. */
function layoutDay(items: { task: KpiTask; day: string; start: number; end: number }[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end)
  const out: { task: KpiTask; start: number; end: number; col: number; cols: number }[] = []
  let cluster: typeof out = []
  let laneEnd: number[] = []
  let clusterEnd = -1
  const flush = () => {
    for (const x of cluster) x.cols = laneEnd.length
    out.push(...cluster)
    cluster = []
    laneEnd = []
  }
  for (const it of sorted) {
    const end = Math.max(it.end, it.start + WEEK_SNAP_MIN)
    if (it.start >= clusterEnd) flush()
    let lane = laneEnd.findIndex((e) => e <= it.start)
    if (lane === -1) lane = laneEnd.length
    laneEnd[lane] = end
    clusterEnd = Math.max(clusterEnd, end)
    cluster.push({ task: it.task, start: it.start, end, col: lane, cols: 1 })
  }
  flush()
  return out
}
