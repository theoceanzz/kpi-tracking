import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate, intlLocale } from '@/i18n/format'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { useTaskList, useTaskMutations } from '../hooks/useTasks'
import { addDays, daysBetween, dueTone, groupTasks, isClosed, PRIORITY_COLOR, spanOf, todayIso, TOGGLE_ON, weekdayOf } from '../taskUtils'
import type { KpiTask, TaskGroupBy, TaskListDetail, TaskListParams, TaskTag } from '../types'
import { AssigneeStack } from './TaskBits'

interface Props {
  params: TaskListParams
  groupBy: TaskGroupBy
  activeTaskId?: string | null
  onOpen: (task: KpiTask) => void
  list?: TaskListDetail | null
  tags?: TaskTag[]
}

type Zoom = 'day' | 'week' | 'month' | 'quarter'
const ROW = 36
/** Đầu bảng hai tầng: tháng ở trên, ngày (hoặc tuần) ở dưới — cột tên phải cao đúng bằng. */
const HEAD_TOP = 22
const HEAD_BOTTOM = 26
const HEAD = HEAD_TOP + HEAD_BOTTOM
/** Thanh hẹp hơn mức này thì tên việc nằm bên phải thanh thay vì bên trong. */
const LABEL_INSIDE_MIN = 110
const ZOOM: Record<Zoom, { dayW: number; days: number; step: number }> = {
  day: { dayW: 32, days: 42, step: 14 },
  week: { dayW: 12, days: 112, step: 28 },
  month: { dayW: 4, days: 182, step: 91 },
  quarter: { dayW: 2, days: 365, step: 182 },
}
const ZOOMS: Zoom[] = ['day', 'week', 'month', 'quarter']
/** Mức xem rộng (tháng / quý) bắt đầu từ đầu tháng; mức hẹp từ thứ Hai. */
const anchorFor = (z: Zoom, iso: string) => (z === 'month' || z === 'quarter' ? `${iso.slice(0, 7)}-01` : mondayOf(iso))

type DragMode = 'move' | 'start' | 'end'
interface Drag { task: KpiTask; mode: DragMode; x0: number; delta: number }

/**
 * Chế độ Gantt (dòng thời gian): mỗi việc một thanh từ ngày bắt đầu tới hạn (thiếu một đầu thì thanh một ngày), nhóm như
 * chế độ Danh sách. Kéo thanh ⇒ dời cả khoảng; kéo mép trái / phải ⇒ đổi ngày bắt đầu / hạn. Mũi tên = phụ thuộc
 * (việc đứng trước → việc chờ); kéo chấm tròn ở cuối một thanh thả lên việc khác để tạo phụ thuộc "việc kia chờ việc
 * này" như Lark. Mức xem Ngày / Tuần / Tháng / Quý. Việc chưa có ngày nằm ở cuối, mở ra để đặt ngày.
 */
export default function TaskGanttView({ params, groupBy, activeTaskId, onOpen, list, tags }: Props) {
  const { t } = useTranslation('tasks')
  const [zoom, setZoom] = useState<Zoom>('day')
  const { dayW, days, step } = ZOOM[zoom]
  const [anchor, setAnchor] = useState(() => mondayOf(addDays(todayIso(), -7)))
  const bodyRef = useRef<HTMLDivElement>(null)
  // Đang kéo dây nối phụ thuộc: từ việc nào, con trỏ đang ở đâu (toạ độ trong vùng thanh).
  const [link, setLink] = useState<{ from: KpiTask; x: number; y: number } | null>(null)
  const from = anchor
  const to = addDays(anchor, days - 1)
  const m = useTaskMutations()
  const [drag, setDrag] = useState<Drag | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: ranged, isFetching } = useTaskList({ ...params, due: undefined, rangeFrom: from, rangeTo: to, size: 500 })
  const { data: undated } = useTaskList({ ...params, due: 'NONE', size: 100 })
  const dated = useMemo(() => ranged?.content ?? [], [ranged])
  const groups = useMemo(() => groupTasks(dated, groupBy === 'none' ? 'none' : groupBy, (k) => t(k), { list, tags }),
    [dated, groupBy, t, list, tags])
  const noDates = (undated?.content ?? []).filter((x) => !x.startDate)

  // Hàng: tiêu đề nhóm rồi các việc của nhóm.
  const rows: ({ kind: 'group'; key: string; label: string } | { kind: 'task'; task: KpiTask })[] = []
  groups.forEach((g) => {
    if (g.tasks.length === 0) return
    rows.push({ kind: 'group', key: g.key, label: g.label })
    g.tasks.forEach((task) => rows.push({ kind: 'task', task }))
  })
  const rowOf = new Map<string, number>()
  rows.forEach((r, i) => { if (r.kind === 'task') rowOf.set(r.task.id, i) })

  const x = (iso: string) => daysBetween(from, iso) * dayW
  const barOf = (task: KpiTask, delta = 0, mode: DragMode = 'move') => {
    const s = spanOf(task)
    if (!s) return null
    let start = s.from, end = s.to
    if (mode === 'move') { start = addDays(start, delta); end = addDays(end, delta) }
    if (mode === 'start') start = addDays(start, Math.min(delta, daysBetween(start, end)))
    if (mode === 'end') end = addDays(end, Math.max(delta, -daysBetween(start, end)))
    return { left: x(start), width: (daysBetween(start, end) + 1) * dayW, start, end }
  }

  const commit = (d: Drag) => {
    if (d.delta === 0) return
    const task = d.task
    if (!task.canEdit) { toast.error(t(`readOnly.${task.readOnlyReason ?? 'NOT_OWNER'}`)); return }
    const b = barOf(task, d.delta, d.mode)!
    const input: Parameters<typeof m.update.mutate>[0]['input'] = { version: task.version }
    if (d.mode === 'move') {
      if (task.startDate) input.startDate = b.start
      if (task.dueDate) input.dueDate = b.end
    } else if (d.mode === 'start') input.startDate = b.start
    else input.dueDate = b.end
    m.update.mutate({ id: task.id, input }, { onError: (er) => toast.error(getApiErrorMessage(er)) })
  }

  const onPointerDown = (e: React.PointerEvent, task: KpiTask, mode: DragMode) => {
    if (!task.canEdit) return
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setDrag({ task, mode, x0: e.clientX, delta: 0 })
  }
  const local = (e: React.PointerEvent) => {
    const r = bodyRef.current?.getBoundingClientRect()
    return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : null
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (link) { const p = local(e); if (p) setLink({ ...link, ...p }); return }
    if (!drag) return
    const delta = Math.round((e.clientX - drag.x0) / dayW)
    if (delta !== drag.delta) setDrag({ ...drag, delta })
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (link) {
      const from = link.from
      setLink(null)
      const p = local(e)
      const row = p ? rows[Math.floor(p.y / ROW)] : undefined
      if (row?.kind === 'task' && row.task.id !== from.id) {
        // Việc được thả lên CHỜ việc kéo từ (FS: xong việc trước mới tới việc sau).
        m.addDependency.mutate({ id: row.task.id, predecessorId: from.id }, {
          onSuccess: () => toast.success(t('gantt.linked', { from: from.title, to: row.task.title })),
          onError: (er) => toast.error(getApiErrorMessage(er)),
        })
      }
      return
    }
    if (!drag) return
    const d = drag
    setDrag(null)
    if (d.delta === 0) onOpen(d.task)
    else commit(d)
  }

  const dayList = Array.from({ length: days }, (_, i) => addDays(from, i))
  const today = todayIso()
  const width = days * dayW
  const height = rows.length * ROW
  // Tầng trên: mỗi tháng một khúc. Tầng dưới (Tuần): mỗi tuần một khúc từ thứ Hai.
  const monthFmt = new Intl.DateTimeFormat(intlLocale(), { month: 'long', year: 'numeric' })
  const weekFmt = new Intl.DateTimeFormat(intlLocale(), { day: '2-digit', month: '2-digit' })
  const segments = (keyOf: (d: string) => string) => {
    const out: { key: string; start: number; count: number; first: string }[] = []
    dayList.forEach((d, i) => {
      const k = keyOf(d)
      const last = out[out.length - 1]
      if (last && last.key === k) last.count++
      else out.push({ key: k, start: i, count: 1, first: d })
    })
    return out
  }
  const months = segments((d) => d.slice(0, 7))
  const weeks = segments((d) => mondayOf(d))
  const years = segments((d) => d.slice(0, 4))
  const wide = zoom === 'month' || zoom === 'quarter'
  const shortMonth = new Intl.DateTimeFormat(intlLocale(), { month: 'short' })

  return (
    <div className="space-y-2 pb-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon-sm" variant="ghost" aria-label={t('calendar.prev')} onClick={() => setAnchor(anchorFor(zoom, addDays(anchor, -step)))}><ChevronLeft /></Button>
        <Button size="sm" variant="outline" onClick={() => setAnchor(anchorFor(zoom, addDays(todayIso(), zoom === 'day' ? -7 : zoom === 'week' ? -14 : -30)))}>{t('calendar.today')}</Button>
        <Button size="icon-sm" variant="ghost" aria-label={t('calendar.next')} onClick={() => setAnchor(anchorFor(zoom, addDays(anchor, step)))}><ChevronRight /></Button>
        <span className="text-sm text-[var(--color-subtle-foreground)]">{formatDate(from)} - {formatDate(to)}</span>
        {isFetching && <Loader2 size={14} className="animate-spin text-[var(--color-subtle-foreground)]" />}
        <div className="flex-1" />
        <div className="inline-flex rounded-card border border-[var(--color-border)] p-0.5">
          {ZOOMS.map((z) => (
            <Button key={z} size="sm" variant="ghost" aria-pressed={zoom === z} className={cn(zoom === z && TOGGLE_ON)} onClick={() => { setZoom(z); setAnchor(anchorFor(z, addDays(todayIso(), z === 'day' ? -7 : z === 'week' ? -14 : -30))) }}>{t(`gantt.${z}`)}</Button>
          ))}
        </div>
      </div>

      <div className="flex overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        {/* Cột tên */}
        <div className="w-56 shrink-0 border-r border-[var(--color-border)] md:w-72 xl:w-[26rem]">
          <div style={{ height: HEAD }} className="flex items-end border-b border-[var(--color-border)] bg-[var(--color-muted)] px-3 pb-1.5 text-xs font-medium text-[var(--color-subtle-foreground)]">
            <span className="min-w-0 flex-1">{t('list.colTitle')}</span>
            <span className="hidden w-14 shrink-0 xl:block">{t('gantt.start')}</span>
            <span className="hidden w-14 shrink-0 xl:block">{t('gantt.due')}</span>
          </div>
          {rows.map((r) => r.kind === 'group' ? (
            <div key={r.key} style={{ height: ROW }} className="flex items-center bg-[var(--color-muted)] px-3 text-xs font-medium text-[var(--color-subtle-foreground)]">{r.label}</div>
          ) : (
            <button key={r.task.id} type="button" onClick={() => onOpen(r.task)} style={{ height: ROW }}
              className={cn('flex w-full items-center gap-2 border-b border-[var(--color-border)] px-3 text-left text-sm hover:bg-[var(--color-muted)]',
                r.task.id === activeTaskId && 'bg-[var(--color-primary-soft)]')}>
              <span className={cn('min-w-0 flex-1 truncate', isClosed(r.task) && 'text-[var(--color-subtle-foreground)] line-through')}>{r.task.title}</span>
              <AssigneeStack task={r.task} max={2} size="sm" />
              <span className="hidden w-14 shrink-0 text-xs text-[var(--color-subtle-foreground)] xl:block">{r.task.startDate ? dayMonth(r.task.startDate) : '-'}</span>
              <span className={cn('hidden w-14 shrink-0 text-xs xl:block', dueTone(r.task))}>{r.task.dueDate ? dayMonth(r.task.dueDate) : '-'}</span>
            </button>
          ))}
        </div>

        {/* Dòng thời gian */}
        <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto" onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          onPointerCancel={() => { setDrag(null); setLink(null) }}>
          <div style={{ width }} className="relative">
            <div className="relative border-b border-[var(--color-border)] bg-[var(--color-muted)] text-xs text-[var(--color-subtle-foreground)]"
              style={{ height: HEAD }}>
              {(wide ? years : months).map((mo) => (
                <div key={mo.key} className="absolute top-0 truncate whitespace-nowrap border-l border-[var(--color-border)] px-2 font-medium leading-[22px] text-[var(--color-foreground)] first:border-l-0"
                  style={{ left: mo.start * dayW, width: mo.count * dayW, height: HEAD_TOP }}>
                  {wide ? mo.key : monthFmt.format(new Date(`${mo.first}T00:00:00`))}
                </div>
              ))}
              <div className="absolute inset-x-0 border-t border-[var(--color-border)]" style={{ top: HEAD_TOP, height: HEAD_BOTTOM }}>
                {zoom === 'day' ? dayList.map((d, i) => (
                  <div key={d}
                    style={{ left: i * dayW, width: dayW, height: HEAD_BOTTOM,
                      backgroundColor: [0, 6].includes(weekdayOf(d)) ? 'color-mix(in srgb, var(--color-border) 45%, transparent)' : undefined }}
                    className={cn('absolute flex items-center justify-center', weekdayOf(d) === 1 && 'border-l border-[var(--color-border)]')}>
                    <span className={cn('flex h-5 min-w-5 items-center justify-center rounded-full px-0.5',
                      d === today && 'bg-[var(--color-primary)] font-semibold text-[var(--color-primary-foreground)]')}>
                      {Number(d.slice(8))}
                    </span>
                  </div>
                )) : wide ? months.map((mo) => (
                  <div key={mo.key} style={{ left: mo.start * dayW, width: mo.count * dayW, height: HEAD_BOTTOM }}
                    className={cn('absolute flex items-center truncate whitespace-nowrap border-l border-[var(--color-border)] px-1.5 capitalize',
                      today.slice(0, 7) === mo.key && 'font-semibold text-[var(--color-primary)]')}>
                    {mo.count * dayW >= 28 ? shortMonth.format(new Date(`${mo.first}T00:00:00`)) : ''}
                  </div>
                )) : weeks.map((w) => (
                  <div key={w.key} style={{ left: w.start * dayW, width: w.count * dayW, height: HEAD_BOTTOM }}
                    className={cn('absolute flex items-center truncate whitespace-nowrap border-l border-[var(--color-border)] px-1.5',
                      today >= w.key && today <= addDays(w.key, 6) && 'font-semibold text-[var(--color-primary)]')}>
                    {w.count >= 4 ? weekFmt.format(new Date(`${w.key}T00:00:00`)) : ''}
                  </div>
                ))}
              </div>
            </div>
            <div ref={bodyRef} className="relative" style={{ height }}>
              {/* Nền: cuối tuần (mức ngày / tuần) + vạch hôm nay */}
              {dayW >= 6 && dayList.map((d) => [0, 6].includes(weekdayOf(d)) && (
                <div key={d} className="absolute inset-y-0 bg-[var(--color-muted)] opacity-50" style={{ left: x(d), width: dayW }} />
              ))}
              {today >= from && today <= to && (
                <div className="absolute inset-y-0 w-px bg-[var(--color-primary)]" style={{ left: x(today) + dayW / 2 }} />
              )}
              {rows.map((r, i) => r.kind === 'task' ? (
                <div key={r.task.id} className="absolute inset-x-0 border-b border-[var(--color-border)]" style={{ top: i * ROW, height: ROW }} />
              ) : (
                <div key={r.key} className="absolute inset-x-0 bg-[var(--color-muted)]" style={{ top: i * ROW, height: ROW }} />
              ))}
              {/* Mũi tên phụ thuộc (+ dây đang kéo để tạo phụ thuộc mới) */}
              <svg className="pointer-events-none absolute inset-0 z-[3]" width={width} height={height}>
                {link && (() => {
                  const fi = rowOf.get(link.from.id)
                  const fb = barOf(link.from)
                  if (fi == null || !fb) return null
                  return <path d={`M${fb.left + fb.width},${fi * ROW + ROW / 2} L${link.x},${link.y}`} fill="none"
                    stroke="var(--color-primary)" strokeWidth={1.5} strokeDasharray="4 3" />
                })()}
                {rows.map((r) => r.kind === 'task' && r.task.blockedByIds.map((pid) => {
                  const pi = rowOf.get(pid)
                  const si = rowOf.get(r.task.id)
                  const pred = pi != null ? (rows[pi] as { task: KpiTask }).task : null
                  if (pred == null || si == null || pi == null) return null
                  const pb = barOf(pred), sb = barOf(r.task)
                  if (!pb || !sb) return null
                  const x1 = pb.left + pb.width, y1 = pi * ROW + ROW / 2, x2 = sb.left, y2 = si * ROW + ROW / 2
                  const mid = Math.max(x1 + 8, x2 - 8)
                  const late = x2 < x1
                  return (
                    <path key={`${pid}-${r.task.id}`} d={`M${x1},${y1} H${mid} V${y2} H${x2}`} fill="none"
                      stroke={late ? 'var(--color-error)' : 'var(--color-subtle-foreground)'} strokeWidth={1.2} markerEnd="url(#gantt-arrow)" />
                  )
                }))}
                <defs>
                  <marker id="gantt-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M0,0 L6,3 L0,6 z" fill="var(--color-subtle-foreground)" />
                  </marker>
                </defs>
              </svg>
              {/* Thanh */}
              {rows.map((r, i) => {
                if (r.kind !== 'task') return null
                const task = r.task
                const live = drag?.task.id === task.id ? drag : null
                const b = barOf(task, live?.delta ?? 0, live?.mode ?? 'move')
                if (!b) return null
                const color = PRIORITY_COLOR[task.priority]
                const inside = b.width >= LABEL_INSIDE_MIN
                // Việc mốc (Lark "Mark as Milestone"): một hình thoi ở ngày hạn thay cho thanh, tên bên phải.
                if (task.milestone) {
                  const x = b.left + Math.max(b.width, 8) - 8
                  return [
                    <div key={task.id} title={`${task.title} · ${formatDate(b.end)}`} onPointerDown={(e) => onPointerDown(e, task, 'move')}
                      className={cn('absolute rotate-45 rounded-[3px]', task.canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                        isClosed(task) && 'opacity-60', task.id === activeTaskId && 'ring-2 ring-[var(--color-primary)]')}
                      style={{ left: x, top: i * ROW + ROW / 2 - 8, width: 16, height: 16, backgroundColor: color }} />,
                    <span key={`${task.id}:label`} className="pointer-events-none absolute truncate text-xs text-[var(--color-foreground)]"
                      style={{ left: x + 24, top: i * ROW + ROW / 2 - 8, maxWidth: 220 }}>{task.title}</span>,
                  ]
                }
                return [
                  <div key={task.id} title={`${task.title} · ${formatDate(b.start)} – ${formatDate(b.end)}`}
                    onPointerDown={(e) => onPointerDown(e, task, 'move')}
                    className={cn('group absolute flex select-none items-center overflow-hidden rounded px-2 text-xs text-[var(--color-foreground)]',
                      task.canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer', isClosed(task) && 'opacity-60',
                      task.id === activeTaskId && 'ring-2 ring-[var(--color-primary)]')}
                    style={{ left: b.left, width: Math.max(b.width, 8), top: i * ROW + 7, height: ROW - 14,
                      backgroundColor: `color-mix(in srgb, ${color} 22%, transparent)`, borderLeft: `3px solid ${color}` }}>
                    {task.canEdit && (
                      <span onPointerDown={(e) => onPointerDown(e, task, 'start')} aria-hidden
                        className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 group-hover:bg-[var(--color-border-strong)]" />
                    )}
                    {inside && <span className="truncate">{task.title}</span>}
                    {task.canEdit && (
                      <span onPointerDown={(e) => onPointerDown(e, task, 'end')} aria-hidden
                        className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 group-hover:bg-[var(--color-border-strong)]" />
                    )}
                  </div>,
                  // Chấm nối: kéo sang việc khác để tạo phụ thuộc (việc kia chờ việc này).
                  <span key={`${task.id}:link`} role="button" aria-label={t('gantt.linkHint')} title={t('gantt.linkHint')}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      const p = local(e)
                      if (p) setLink({ from: task, ...p })
                    }}
                    className="absolute z-[2] h-3 w-3 cursor-crosshair rounded-full border-2 border-[var(--color-primary)] bg-[var(--color-card)] opacity-0 transition-opacity hover:opacity-100 [div:hover+&]:opacity-100"
                    style={{ left: b.left + Math.max(b.width, 8) - 6, top: i * ROW + ROW / 2 - 6 }} />,
                  !inside && (
                    <span key={`${task.id}:label`} aria-hidden
                      className={cn('pointer-events-none absolute flex items-center whitespace-nowrap text-xs text-[var(--color-foreground)]',
                        isClosed(task) && 'text-[var(--color-subtle-foreground)] line-through')}
                      style={{ left: b.left + Math.max(b.width, 8) + 6, top: i * ROW, height: ROW }}>
                      {task.title}
                    </span>
                  ),
                ]
              })}
            </div>
          </div>
        </div>
      </div>

      {noDates.length > 0 && (
        <div className="rounded-card border border-dashed border-[var(--color-border)] p-3">
          <p className="mb-2 text-xs text-[var(--color-subtle-foreground)]">{t('gantt.noDates', { count: noDates.length })}</p>
          <div className="flex flex-wrap gap-1.5">
            {noDates.slice(0, 50).map((task) => (
              <button key={task.id} type="button" onClick={() => onOpen(task)}
                className="max-w-[220px] truncate rounded-md bg-[var(--color-muted)] px-2 py-1 text-xs hover:bg-[var(--color-primary-soft)]">
                {task.title}
              </button>
            ))}
          </div>
        </div>
      )}
      {rows.length === 0 && noDates.length === 0 && (
        <p className="py-10 text-center text-sm text-[var(--color-subtle-foreground)]">{t('gantt.empty')}</p>
      )}
    </div>
  )
}

/** "16/10" — ngày ngắn cho cột Bắt đầu / Hạn của Gantt. */
function dayMonth(iso: string): string {
  // Bỏ năm khỏi ngày đầy đủ theo ngôn ngữ (vi: 16/10/2026 → 16/10; en: 10/16/2026 → 10/16).
  return formatDate(iso).replace(/[/.-]\d{4}$/, '').replace(/^\d{4}[/.-]/, '')
}

function mondayOf(iso: string): string {
  const wd = weekdayOf(iso)
  return addDays(iso, wd === 0 ? -6 : 1 - wd)
}
