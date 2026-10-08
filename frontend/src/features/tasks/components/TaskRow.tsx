import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Flag, ListTree, Lock, MessageSquare, Repeat, Target } from 'lucide-react'
import UserAvatar from '@/components/common/UserAvatar'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { getApiErrorCode, getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { useTaskMutations } from '../hooks/useTasks'
import { dueTone, isClosed, PRIORITY_COLOR, shortDue, STATUS_STYLE } from '../taskUtils'
import type { KpiTask } from '../types'

interface Props {
  task: KpiTask
  active?: boolean
  showKpi?: boolean
  onOpen: (task: KpiTask) => void
  /** Thuộc tính kéo thả do danh sách truyền xuống (dnd-kit). */
  dragHandleProps?: Record<string, unknown>
  dragging?: boolean
}

/**
 * Một dòng việc kiểu Lark: vòng tích hoàn thành bên trái, tên, chip bên phải (KPI, hạn, ưu tiên, người phụ trách, lặp,
 * việc con, bình luận). Tích xong: dấu tích xanh, gạch ngang, mờ dần rồi chuyển xuống "Đã hoàn thành"; có nút Hoàn tác
 * vài giây.
 */
export default function TaskRow({ task, active, showKpi = true, onOpen, dragHandleProps, dragging }: Props) {
  const { t } = useTranslation('tasks')
  const { changeStatus } = useTaskMutations()
  const [completing, setCompleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState<string | null>(null)
  const closed = isClosed(task) || completing
  const S = STATUS_STYLE[completing ? 'DONE' : task.status]

  const complete = (force = false) => {
    const previous = task.status
    setCompleting(true)
    changeStatus.mutate({ id: task.id, status: 'DONE', version: task.version, force }, {
      onSuccess: (updated) => {
        toast.success(t('row.completed', { title: task.title }), {
          duration: 5000,
          action: {
            label: t('row.undo'),
            onClick: () => changeStatus.mutate({ id: task.id, status: previous, version: updated.version }),
          },
        })
      },
      onError: (e) => {
        setCompleting(false)
        if (getApiErrorCode(e) === 'TASK_PARENT_HAS_OPEN_SUBTASKS') {
          setConfirmOpen(getApiErrorMessage(e))
          return
        }
        toast.error(getApiErrorMessage(e))
      },
    })
  }

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!task.canEdit || task.status === 'CANCELLED') return
    if (task.status === 'DONE') {
      changeStatus.mutate({ id: task.id, status: 'TODO', version: task.version }, { onError: (er) => toast.error(getApiErrorMessage(er)) })
    } else {
      complete()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(task) }}
      {...dragHandleProps}
      className={cn(
        'group flex min-h-[44px] items-center gap-3 border-b border-[var(--color-border)] px-3 py-2 text-left transition-all duration-500',
        'hover:bg-[var(--color-muted)]',
        active && 'bg-[var(--color-primary-soft)]',
        completing && 'opacity-50',
        dragging && 'opacity-60 shadow-lg',
      )}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={!task.canEdit || task.status === 'CANCELLED'}
        aria-label={task.status === 'DONE' ? t('row.markTodo') : t('row.markDone')}
        className={cn('shrink-0 transition-transform hover:scale-110 disabled:cursor-default disabled:hover:scale-100', S.className)}
      >
        <S.icon size={18} />
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm text-[var(--color-foreground)] transition-colors', closed && 'text-[var(--color-subtle-foreground)] line-through')}>
          {task.title}
        </p>
        {task.parentTitle && (
          <p className="truncate text-[11px] text-[var(--color-subtle-foreground)]">↳ {task.parentTitle}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2.5 text-xs">
        {showKpi && task.kpiName && (
          <span className="hidden max-w-[160px] items-center gap-1 truncate text-[var(--color-subtle-foreground)] md:inline-flex" title={task.kpiName}>
            <Target size={12} className="shrink-0" /> <span className="truncate">{task.kpiName}</span>
          </span>
        )}
        {task.subtaskTotal > 0 && (
          <span className="inline-flex items-center gap-1 text-[var(--color-subtle-foreground)]" title={t('row.subtasks')}>
            <ListTree size={12} /> {task.subtaskDone}/{task.subtaskTotal}
          </span>
        )}
        {task.commentCount > 0 && (
          <span className={cn('inline-flex items-center gap-1', task.unreadComments > 0 ? 'font-semibold text-[var(--color-primary)]' : 'text-[var(--color-subtle-foreground)]')}>
            <MessageSquare size={12} /> {task.commentCount}
          </span>
        )}
        {task.recurrence && <Repeat size={12} className="text-[var(--color-subtle-foreground)]" aria-label={t('row.recurring')} />}
        {task.visibility === 'PRIVATE' && <Lock size={12} className="text-[var(--color-subtle-foreground)]" aria-label={t('visibility.PRIVATE')} />}
        {task.dueDate && <span className={cn('whitespace-nowrap', dueTone(task))}>{shortDue(task)}</span>}
        {task.priority !== 'MEDIUM' && (
          <Flag size={12} style={{ color: PRIORITY_COLOR[task.priority] }} aria-label={t(`priority.${task.priority}`)} />
        )}
        <UserAvatar fullName={task.ownerName} avatarUrl={task.ownerAvatarUrl} className="h-6 w-6 rounded-full text-[10px]" />
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
      </div>
    </div>
  )
}
