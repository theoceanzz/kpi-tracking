import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CalendarClock, CalendarDays, CalendarPlus, Eye, EyeOff, Flag, GripVertical, RotateCcw, SlidersHorizontal, Tag, Target, Type, User, UserPen,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { tourAnchor } from '@/components/common/tours/anchors'
import { MAX_COL_WIDTH, MIN_COL_WIDTH, TITLE_MIN_WIDTH, useColumnLabel, type TaskColumn, type TaskColumnKey } from '../hooks/useTaskColumns'
import { CUSTOMIZE_EVENT } from '../taskUtils'
import type { TaskListField } from '../types'

/** Icon trước tên cột như Lark (A≡ Tên việc, ⏱ Bắt đầu, ▢ Hạn, 👤 Người…). */
const COL_ICON: Record<string, typeof User> = {
  assignee: User, start: CalendarClock, due: CalendarDays, priority: Flag, kpi: Target, tags: Tag, creator: UserPen, created: CalendarPlus,
}

/**
 * Dòng tiêu đề cột của bảng việc (dính trên cùng khi cuộn) kiểu Lark: icon + tên cột, kéo mép phải để đổi độ rộng; nút cuối
 * dòng (và nút "Tuỳ chỉnh" trên thanh công cụ) mở hộp "Tuỳ chỉnh": kéo ⋮⋮ đổi thứ tự, icon mắt bật / tắt cột.
 */
export default function TaskTableHeader({ columns, allColumns, onColumns, onReset, fields, selectable }: {
  /** Cột đang hiện (đã lọc). */
  columns: TaskColumn[]
  /** Mọi cột (kể cả đang ẩn) — cho hộp "Trường hiển thị". */
  allColumns: TaskColumn[]
  onColumns: (next: TaskColumn[]) => void
  onReset: () => void
  fields?: TaskListField[]
  selectable?: boolean
}) {
  const { t } = useTranslation('tasks')
  const label = useColumnLabel(fields)
  const drag = useRef<{ key: TaskColumnKey; x0: number; w0: number } | null>(null)
  const [open, setOpen] = useState(false)
  const [dragKey, setDragKey] = useState<TaskColumnKey | null>(null)
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(CUSTOMIZE_EVENT, onOpen)
    return () => window.removeEventListener(CUSTOMIZE_EVENT, onOpen)
  }, [])

  const setWidth = (key: TaskColumnKey, width: number) =>
    onColumns(allColumns.map((c) => (c.key === key ? { ...c, width: Math.round(Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, width))), custom: true } : c)))

  /** Kéo ⋮⋮ một dòng trong hộp Tuỳ chỉnh thả lên dòng khác ⇒ chuyển cột kéo tới chỗ dòng đó. */
  const reorder = (from: TaskColumnKey, to: TaskColumnKey) => {
    if (from === to) return
    const moving = allColumns.find((c) => c.key === from)
    if (!moving) return
    const next = allColumns.filter((c) => c.key !== from)
    const target = next.findIndex((c) => c.key === to)
    const down = allColumns.findIndex((c) => c.key === from) < allColumns.findIndex((c) => c.key === to)
    next.splice(target + (down ? 1 : 0), 0, moving)
    onColumns(next)
  }

  return (
    <div className="sticky top-0 z-[2] flex h-10 items-stretch border-b border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-subtle-foreground)]">
      {selectable && <span className="w-6 shrink-0" />}
      <div className="flex flex-1 items-center gap-1.5 pl-7" style={{ minWidth: `var(--task-title-min, ${TITLE_MIN_WIDTH}px)` }}><Type size={14} className="shrink-0" /> {t('list.colTitle')}</div>
      {columns.map((c) => {
        const Icon = COL_ICON[c.key] ?? SlidersHorizontal
        return (
        <div key={c.key} className="group/col relative flex shrink-0 items-center gap-1.5 px-2.5" style={{ width: c.width }}>
          <Icon size={14} className="shrink-0" />
          <span className="truncate" title={label(c.key)}>{label(c.key)}</span>
          {/* Kéo mép phải để đổi độ rộng */}
          <span role="separator" aria-orientation="vertical" aria-label={t('list.resizeColumn')}
            onPointerDown={(e) => {
              e.preventDefault()
              ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
              drag.current = { key: c.key, x0: e.clientX, w0: c.width }
            }}
            onPointerMove={(e) => { const d = drag.current; if (d) setWidth(d.key, d.w0 + e.clientX - d.x0) }}
            onPointerUp={() => { drag.current = null }}
            className="absolute inset-y-1.5 right-0 w-1.5 cursor-col-resize rounded bg-transparent hover:bg-[var(--color-border-strong)] group-hover/col:bg-[var(--color-border)]" />
        </div>
        )
      })}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" {...tourAnchor('tasks.columns')} aria-label={t('toolbar.customize')} title={t('toolbar.customize')}
            className="ml-1 flex w-7 shrink-0 items-center justify-center rounded text-[var(--color-subtle-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]">
            <SlidersHorizontal size={14} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="end">
          <p className="px-1 pb-2 text-base font-semibold text-[var(--color-foreground)]">{t('toolbar.customize')}</p>
          <div className="max-h-96 space-y-0.5 overflow-y-auto">
            {allColumns.map((c) => (
              // Kéo thả HTML trong hộp nhỏ — đủ cho đổi thứ tự cột, không cần thêm thư viện.
              <div key={c.key} draggable onDragStart={() => setDragKey(c.key)} onDragEnd={() => setDragKey(null)}
                onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragKey) reorder(dragKey, c.key); setDragKey(null) }}
                className={cn('flex items-center gap-2 rounded px-1 py-1.5 hover:bg-[var(--color-muted)]', dragKey === c.key && 'opacity-50')}>
                <GripVertical size={14} className="shrink-0 cursor-grab text-[var(--color-muted-foreground)]" />
                <span className="min-w-0 flex-1 truncate text-sm font-normal text-[var(--color-foreground)]">{label(c.key)}</span>
                <button type="button" aria-label={c.visible ? t('list.hideColumn') : t('list.showColumn')} title={c.visible ? t('list.hideColumn') : t('list.showColumn')}
                  onClick={() => onColumns(allColumns.map((x) => (x.key === c.key ? { ...x, visible: !x.visible } : x)))}
                  className={cn('rounded p-1 hover:bg-[var(--color-border)]', c.visible ? 'text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)]')}>
                  {c.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={onReset}
            className="mt-1 flex w-full items-center gap-1.5 rounded px-1 py-1.5 text-xs font-normal text-[var(--color-subtle-foreground)] hover:bg-[var(--color-muted)]">
            <RotateCcw size={12} /> {t('list.resetColumns')}
          </button>
        </PopoverContent>
      </Popover>
    </div>
  )
}
