import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Ban, Check, ChevronDown, ChevronRight, ListTree, Lock, MessageSquare, MoreHorizontal, Repeat, Users } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { Checkbox } from '@/components/ui/checkbox'
import { getApiErrorCode, getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { tourAnchor } from '@/components/common/tours/anchors'
import { useTaskMutations } from '../hooks/useTasks'
import { TITLE_MIN_WIDTH, type TaskColumn } from '../hooks/useTaskColumns'
import { dueCountdown, dueTone, isClosed, NEEDS_CONFIRM, shortDue, statusStyleOf } from '../taskUtils'
import { useNow } from '../hooks/useNow'
import type { KpiTask, TaskListField } from '../types'
import { AssigneeStack, TagChip } from './TaskBits'
import { TaskCell } from './TaskCells'
import TaskRowMenu, { type MenuAnchor } from './TaskRowMenu'

interface Props {
  task: KpiTask
  active?: boolean
  onOpen: (task: KpiTask) => void
  /** Cột đang hiện của bảng (cùng thứ tự / độ rộng với dòng tiêu đề). Không truyền = dòng gọn (kéo thả, xem trước). */
  columns?: TaskColumn[]
  /** Trường tuỳ chỉnh của danh sách đang xem. */
  fields?: TaskListField[]
  /** Thuộc tính kéo thả do danh sách truyền xuống (dnd-kit). */
  dragHandleProps?: Record<string, unknown>
  dragging?: boolean
  /** Chế độ chọn nhiều (thao tác hàng loạt). */
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: (task: KpiTask, shift: boolean) => void
  /** Việc con hiện lồng dưới việc cha: mức thụt lề và nút xổ / gập. */
  indent?: number
  expandable?: boolean
  expanded?: boolean
  onToggleExpand?: () => void
}

/** Vuốt sang phải quá ngần này (px) thì tính là hoàn thành (điện thoại). */
const SWIPE_DONE = 90

/**
 * Một dòng của bảng việc kiểu Lark: ô chọn (khi chọn nhiều), mũi tên xổ việc con, vòng tích hoàn thành, tên (bấm đúp để
 * đổi tên), biểu tượng nhỏ, nút "…" khi rê chuột; rồi các cột (người thực hiện, hạn, ưu tiên… sửa ngay trong ô). Chuột phải
 * mở menu thao tác. Điện thoại: vuốt phải để hoàn thành. Tích xong có nút Hoàn tác vài giây; kiểu "ai cũng phải xong"
 * thì người thực hiện tích = xong phần mình.
 */
export default function TaskRow({ task, active, onOpen, columns, fields, dragHandleProps, dragging, selectable, selected,
  onToggleSelect, indent = 0, expandable, expanded, onToggleExpand }: Props) {
  const { t } = useTranslation('tasks')
  const { changeStatus, update } = useTaskMutations()
  const [completing, setCompleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState<string | null>(null)
  const [menu, setMenu] = useState<MenuAnchor | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [swipe, setSwipe] = useState(0)
  const touch = useRef<{ x: number; y: number; locked: boolean | null } | null>(null)
  const partOnly = task.completionMode === 'ALL' && task.assignees.length > 1 && task.status !== 'DONE'
    && task.assignees.filter((a) => !a.completedAt).length > 1
  const closed = isClosed(task) || (completing && !partOnly)
  const S = statusStyleOf(task, completing && !partOnly ? 'DONE' : task.status)
  const canToggle = task.canEdit && task.status !== 'CANCELLED'
  const countdown = dueCountdown(task, useNow())

  const complete = (force = false) => {
    const previous = task.status
    setCompleting(true)
    changeStatus.mutate({ id: task.id, status: 'DONE', version: task.version, force }, {
      onSuccess: (updated) => {
        setCompleting(false)
        const message = updated.status === 'DONE' ? t('row.completed', { title: task.title }) : t('row.partCompleted', { title: task.title })
        toast.success(message, {
          duration: 5000,
          action: {
            label: t('row.undo'),
            onClick: () => changeStatus.mutate({ id: task.id, status: previous, version: updated.version }),
          },
        })
      },
      onError: (e) => {
        setCompleting(false)
        if (NEEDS_CONFIRM.includes(getApiErrorCode(e) ?? '')) {
          setConfirmOpen(getApiErrorMessage(e))
          return
        }
        toast.error(getApiErrorMessage(e))
      },
    })
  }

  const toggle = () => {
    if (!canToggle) return
    if (task.status === 'DONE' || (task.completionMode === 'ALL' && task.myPartDone)) {
      changeStatus.mutate({ id: task.id, status: 'TODO', version: task.version }, { onError: (er) => toast.error(getApiErrorMessage(er)) })
    } else {
      complete()
    }
  }

  const saveTitle = () => {
    setRenaming(false)
    const v = title.trim()
    if (!v || v === task.title) { setTitle(task.title); return }
    update.mutate({ id: task.id, input: { version: task.version, title: v } }, {
      onError: (e) => { setTitle(task.title); toast.error(getApiErrorMessage(e)) },
    })
  }

  return (
    <div
      role="button"
      tabIndex={0}
      data-task-id={task.id}
      {...tourAnchor('tasks.row')}
      onClick={(e) => {
        if (renaming || swipe) return
        if (selectable && (e.shiftKey || e.metaKey || e.ctrlKey)) { onToggleSelect?.(task, e.shiftKey); return }
        onOpen(task)
      }}
      onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }) }}
      onKeyDown={(e) => { if (e.key === 'Enter' && !renaming) onOpen(task) }}
      // Vuốt phải để hoàn thành (chỉ cảm ứng; khoá theo hướng vuốt đầu tiên để không cản cuộn dọc).
      onTouchStart={(e) => { const p = e.touches[0]!; touch.current = { x: p.clientX, y: p.clientY, locked: null } }}
      onTouchMove={(e) => {
        const s = touch.current
        if (!s || !canToggle) return
        const p = e.touches[0]!
        const dx = p.clientX - s.x, dy = p.clientY - s.y
        if (s.locked === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) s.locked = Math.abs(dx) > Math.abs(dy)
        if (s.locked) setSwipe(Math.max(0, Math.min(140, dx)))
      }}
      onTouchEnd={() => {
        if (swipe >= SWIPE_DONE) toggle()
        touch.current = null
        window.setTimeout(() => setSwipe(0), 0)
      }}
      {...dragHandleProps}
      className={cn(
        // content-visibility: dòng ngoài màn hình được trình duyệt bỏ qua khi dựng / vẽ (danh sách vài trăm việc vẫn mượt).
        'group relative flex min-h-[40px] items-stretch overflow-hidden border-b border-[var(--color-border)] px-3 text-left transition-colors',
        '[content-visibility:auto] [contain-intrinsic-size:auto_40px]',
        'hover:bg-[var(--color-muted)]',
        (active || selected) && 'bg-[var(--color-primary-soft)] hover:bg-[var(--color-primary-soft)]',
        completing && 'opacity-50',
        dragging && 'opacity-60 shadow-lg',
      )}
    >
      {swipe > 0 && (
        <div className="absolute inset-y-0 left-0 flex items-center bg-[var(--color-success)] pl-4 text-white" style={{ width: swipe }}>
          <Check size={18} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 items-stretch" style={{ transform: swipe ? `translateX(${swipe}px)` : undefined }}>
        {selectable && (
          <span onClick={(e) => { e.stopPropagation(); onToggleSelect?.(task, e.shiftKey) }}
            className={cn('flex w-6 shrink-0 items-center', !selected && 'opacity-0 group-hover:opacity-100 focus-within:opacity-100')}>
            <Checkbox checked={!!selected} aria-label={t('batch.select')} />
          </span>
        )}

        {/* Cột Tên việc */}
        <div className="flex flex-1 items-center gap-1.5 py-2 pr-2" style={{ minWidth: columns?.length ? `var(--task-title-min, ${TITLE_MIN_WIDTH}px)` : undefined, paddingLeft: indent * 22 }}>
          <span className="flex w-4 shrink-0 justify-center">
            {expandable && (
              <button type="button" aria-label={expanded ? t('row.collapseSubtasks') : t('row.expandSubtasks')}
                onClick={(e) => { e.stopPropagation(); onToggleExpand?.() }} onPointerDown={(e) => e.stopPropagation()}
                className="rounded text-[var(--color-subtle-foreground)] hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)]">
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggle() }}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={!canToggle}
            aria-label={task.status === 'DONE' ? t('row.markTodo') : partOnly ? t('row.markMyPart') : t('row.markDone')}
            title={partOnly ? t('row.markMyPart') : undefined}
            className={cn('shrink-0 transition-transform hover:scale-110 disabled:cursor-default disabled:hover:scale-100', S.className,
              task.myPartDone && task.status !== 'DONE' && 'text-[var(--color-success)]')}
          >
            <S.icon size={18} />
          </button>
          <div className="min-w-0 flex-1">
            {renaming ? (
              // Ô sửa trong dòng bảng — ngoại lệ có chủ đích của quy ước Input.
              <input autoFocus value={title} maxLength={255}
                onChange={(e) => setTitle(e.target.value)}
                onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); saveTitle() }
                  if (e.key === 'Escape') { setTitle(task.title); setRenaming(false) }
                }}
                onBlur={saveTitle}
                className="no-edit-hint w-full rounded border border-[var(--color-ring)] bg-[var(--color-card)] px-1.5 py-0.5 text-sm outline-none" />
            ) : (
              <p onDoubleClick={(e) => { if (!task.canEdit) return; e.stopPropagation(); setTitle(task.title); setRenaming(true) }}
                title={task.canEdit ? t('row.renameHint') : undefined}
                className={cn('truncate text-sm text-[var(--color-foreground)] transition-colors', closed && 'text-[var(--color-subtle-foreground)] line-through')}>
                {task.title}
              </p>
            )}
            {task.parentTitle && indent === 0 && <p className="truncate text-[11px] text-[var(--color-subtle-foreground)]">↳ {task.parentTitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-[var(--color-subtle-foreground)]">
            {(!columns || !columns.some((c) => c.key === 'tags')) && task.tags.slice(0, 2).map((g) => <span key={g.id} className="hidden sm:inline-flex"><TagChip tag={g} /></span>)}
            {task.openBlockers > 0 && !isClosed(task) && (
              <span className="inline-flex items-center gap-0.5 text-[var(--color-warning)]" title={t('row.blocked', { count: task.openBlockers })}>
                <Ban size={12} /> {task.openBlockers}
              </span>
            )}
            {task.subtaskTotal > 0 && (
              <span className="inline-flex items-center gap-0.5" title={t('row.subtasks')}><ListTree size={12} /> {task.subtaskDone}/{task.subtaskTotal}</span>
            )}
            {task.commentCount > 0 && (
              <span className={cn('inline-flex items-center gap-0.5', task.unreadComments > 0 && 'font-semibold text-[var(--color-primary)]')}>
                <MessageSquare size={12} /> {task.commentCount}
              </span>
            )}
            {task.completionMode === 'ALL' && task.assignees.length > 1 && (
              <span className="inline-flex items-center gap-0.5" title={t('completion.ALL')}>
                <Users size={12} /> {task.assignees.filter((a) => a.completedAt).length}/{task.assignees.length}
              </span>
            )}
            {task.recurrence && <Repeat size={12} aria-label={t('row.recurring')} />}
            {task.visibility === 'PRIVATE' && <Lock size={12} aria-label={t('visibility.PRIVATE')} />}
            {/* Dòng gọn (điện thoại / không chia cột): hạn + người thực hiện ngay trong dòng */}
            {columns && columns.length === 0 && (
              <>
                {task.dueDate && <span className={cn('whitespace-nowrap', countdown?.overdue ? 'text-[var(--color-error)]' : countdown?.soon ? 'text-[var(--color-warning)]' : dueTone(task))}>{countdown?.label ?? shortDue(task)}</span>}
                <AssigneeStack task={task} size="sm" max={2} />
              </>
            )}
            {/* Nút "…" khi rê chuột — cùng menu với chuột phải */}
            <button type="button" aria-label={t('menu.more')}
              onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.left, y: r.bottom + 4 }) }}
              onPointerDown={(e) => e.stopPropagation()}
              className="rounded p-0.5 opacity-0 hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)] focus:opacity-100 group-hover:opacity-100">
              <MoreHorizontal size={15} />
            </button>
          </div>
        </div>

        {columns?.map((c) => <TaskCell key={c.key} task={task} column={c} fields={fields} />)}
        {!!columns?.length && <span className="w-8 shrink-0" />}
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        <ConfirmDialog
          open={!!confirmOpen}
          onClose={() => setConfirmOpen(null)}
          onConfirm={() => { setConfirmOpen(null); complete(true) }}
          title={t('row.openSubtasksTitle')}
          description={confirmOpen ?? ''}
          confirmLabel={t('row.completeAnyway')}
        />
        <TaskRowMenu task={task} anchor={menu} onClose={() => setMenu(null)} onOpen={onOpen} />
      </div>
    </div>
  )
}
