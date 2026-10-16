import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  AlignLeft, ArrowLeftRight, Ban, Bookmark, Check, CheckCircle2, ChevronRight, Copy, Diamond, FileText, GitBranch, History, ListChecks, ListTree, RefreshCw,
  Loader2, Lock, Maximize2, Minimize2, MoreHorizontal, Paperclip, Plus, Search, Share2, Trash2, UserMinus, X,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import MediaPreviewModal from '@/components/common/MediaPreviewModal'
import UserAvatar from '@/components/common/UserAvatar'
import { formatDateTime } from '@/i18n/format'
import { getApiErrorCode, getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import DiscussionPanel from '@/features/discussion/components/DiscussionPanel'
import { COLLAB_ACCEPT, COLLAB_EXTENSIONS, COLLAB_MAX_FILES_PER_TASK, checkFiles } from '@/features/discussion/attachments'
import LibrarySourceNote from '@/features/documents/components/LibrarySourceNote'
import { PickFromLibraryButton } from '@/features/documents/components/DocumentPickerDialog'
import { taskApi } from '../api/taskApi'
import { taskKeys, useTask, useTaskHistory, useTaskMutations, useTaskPresence } from '../hooks/useTasks'
import { useDeferredDelete } from '../hooks/useDeferredDelete'
import { dueTone, historyText, isClosed, NEEDS_CONFIRM, placeholderBtn, shortDue, STATUS_STYLE, statusStyleOf } from '../taskUtils'
import { MAX_TASK_DEPTH, type KpiTask, type TaskEvent, type TaskStatus, type TaskViewer, type UpdateTaskInput } from '../types'
import { AssigneeStack } from './TaskBits'
import AssignDialog from './AssignDialog'
import TaskDescriptionEditor from './TaskDescriptionEditor'
import TaskProperties, { PropRow } from './TaskProperties'

interface Props {
  taskId: string | null
  onClose: () => void
  /** Mở việc khác trong cùng bảng (việc con / quay lại việc cha). */
  onNavigate: (taskId: string) => void
  focusCommentId?: string | null
  /** Mở thẳng hộp lịch sử (vd. từ thông báo). */
  initialTab?: 'all' | 'comments' | 'activity'
  /** Mở trên modal chi tiết KPI (z-[200]) thì phải nổi cao hơn. */
  zClass?: string
  /** Thứ tự việc đang thấy ở màn cha — phím ↑ ↓ chuyển sang việc trước / sau. */
  navIds?: string[]
}

/** Trường mà "bản mẫu" của chuỗi lặp chép sang các lần sau — sửa chúng trên việc lặp thì hỏi phạm vi. */
const TEMPLATE_FIELDS: (keyof Omit<UpdateTaskInput, 'version'>)[] = ['title', 'description', 'descriptionDoc', 'priority', 'visibility', 'dueTime', 'clearDueTime']

/**
 * Bảng chi tiết trượt từ phải, bố cục theo đúng Lark Tasks (xem docs/TASKS_LARK_REFERENCE.md): đầu bảng "✓ Đánh dấu hoàn
 * thành" bên trái, bên phải theo dõi · chia sẻ · phóng to · ··· · đóng; tên việc; các dòng thuộc tính chỉ có icon; khối
 * "Bình luận" (bình luận xen dòng hoạt động); chân bảng: ô viết bình luận và người theo dõi. Mọi thay đổi tự lưu, gửi lần
 * lượt kèm version mới nhất; bị người khác sửa trước (409) thì báo và tải lại. Kỳ đã khoá: chỉ đọc + dải thông báo.
 */
export default function TaskDetailPanel({ taskId, onClose, onNavigate, focusCommentId, initialTab = 'all', zClass = 'z-[150]', navIds }: Props) {
  const [wide, setWide] = useState(() => { try { return localStorage.getItem('tasks.detail.wide') === '1' } catch { return false } })
  const toggleWide = () => setWide((v) => { try { localStorage.setItem('tasks.detail.wide', v ? '0' : '1') } catch { /* bỏ qua */ } return !v })
  const navIndex = taskId && navIds ? navIds.indexOf(taskId) : -1
  const viewers = useTaskPresence(taskId)
  const prevId = navIndex > 0 ? navIds![navIndex - 1] : undefined
  const nextId = navIndex >= 0 && navIds && navIndex < navIds.length - 1 ? navIds[navIndex + 1] : undefined
  const remove = useDeferredDelete()
  const { t } = useTranslation('tasks')
  const qc = useQueryClient()
  const { data: task, isLoading, error } = useTask(taskId)
  const m = useTaskMutations()
  // Khối "Bình luận" của Lark: dòng hoạt động xen giữa các bình luận.
  const { data: history = [] } = useTaskHistory(taskId, true)
  const [historyOpen, setHistoryOpen] = useState(initialTab === 'activity')
  const [assignOpen, setAssignOpen] = useState(false)
  const [declineOpen, setDeclineOpen] = useState(false)
  const [depPick, setDepPick] = useState<'BLOCKED_BY' | 'BLOCKING' | null>(null)
  const [parentPick, setParentPick] = useState(false)
  const [scopeAsk, setScopeAsk] = useState<Omit<UpdateTaskInput, 'version'> | null>(null)
  const [confirmForce, setConfirmForce] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<{ url: string; name: string; type: string | null } | null>(null)
  /** Phạm vi đã chọn cho việc lặp đang mở (hỏi một lần mỗi lần mở bảng). */
  const scopeRef = useRef<'THIS' | 'FOLLOWING' | null>(null)
  const latest = useRef<KpiTask | undefined>(task)
  const chain = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => { latest.current = task }, [task])
  useEffect(() => { scopeRef.current = null }, [taskId])

  const dialogOpen = assignOpen || !!scopeAsk || !!confirmForce || historyOpen || declineOpen || !!depPick || parentPick
  // Esc đóng bảng (trừ khi đang gõ trong một ô hoặc đang mở hộp thoại).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || dialogOpen) return
      const el = document.activeElement as HTMLElement | null
      if (el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) { el.blur(); return }
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, dialogOpen])

  // ↑ ↓ sang việc trước / sau (khi không gõ trong ô nào và không có hộp thoại / menu đang mở).
  useEffect(() => {
    if (!taskId) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || e.altKey || e.ctrlKey || e.metaKey) return
      const el = document.activeElement as HTMLElement | null
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return
      if (document.querySelector('[role="dialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]')) return
      const target = e.key === 'ArrowUp' ? prevId : nextId
      if (!target) return
      e.preventDefault()
      onNavigate(target)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [taskId, prevId, nextId, onNavigate])

  const onConflict = useCallback((e: unknown) => {
    const code = getApiErrorCode(e)
    toast.error(getApiErrorMessage(e))
    if ((code === 'TASK_VERSION_CONFLICT' || code === 'CONCURRENT_UPDATE') && taskId) {
      qc.invalidateQueries({ queryKey: taskKeys.one(taskId) })
    }
  }, [qc, taskId])

  /** Gửi lần lượt — mỗi lượt lấy version mới nhất do lượt trước trả về. */
  const send = useCallback((input: Omit<UpdateTaskInput, 'version'>, scope?: 'THIS' | 'FOLLOWING') => {
    chain.current = chain.current.then(() => {
      const cur = latest.current
      if (!cur) return
      return m.update.mutateAsync({ id: cur.id, input: { ...input, version: cur.version, scope } })
        .then((updated) => { latest.current = updated })
        .catch(onConflict)
    })
  }, [m.update, onConflict])

  const save = useCallback((input: Omit<UpdateTaskInput, 'version'>) => {
    const cur = latest.current
    if (!cur) return
    const touchesTemplate = TEMPLATE_FIELDS.some((f) => input[f] !== undefined && input[f] !== false)
    if (cur.recurrence && touchesTemplate) {
      if (scopeRef.current) send(input, scopeRef.current)
      else setScopeAsk(input)
      return
    }
    send(input)
  }, [send])

  const setStatus = (status: TaskStatus, force = false) => {
    const cur = latest.current
    if (!cur) return
    m.changeStatus.mutate({ id: cur.id, status, version: cur.version, force }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.one(cur.id) }),
      onError: (e) => {
        if (NEEDS_CONFIRM.includes(getApiErrorCode(e) ?? '')) { setConfirmForce(getApiErrorMessage(e)); return }
        onConflict(e)
      },
    })
  }

  const copyLink = () => {
    if (!task) return
    navigator.clipboard?.writeText(`${window.location.origin}/tasks?task=${task.id}`)
      .then(() => toast.success(t('detail.linkCopied'))).catch(() => {})
  }

  const myId = useAuthStore((st) => st.user?.id)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [composerSlot, setComposerSlot] = useState<HTMLDivElement | null>(null)
  const [reason, setReason] = useState('')
  if (!taskId) return null
  const editable = !!task?.canEdit
  // Kiểu "ai cũng phải xong": người thực hiện bấm = xong phần mình.
  const partMode = !!task && task.completionMode === 'ALL' && task.assignees.length > 1 && task.status !== 'DONE'
    && task.assignees.some((a) => a.id === myId)
  const isAssignee = !!task && !!myId && task.assignees.some((a) => a.id === myId)
  const root = !!task && !task.parentTaskId

  const addFiles = (files: File[]) => {
    if (!task || !files.length) return
    const bad = checkFiles(files)[0]
    if (bad) {
      toast.error(bad.reason === 'size' ? t('detail.fileTooLarge', { name: bad.file.name }) : t('detail.fileNotSupported', { name: bad.file.name }))
      return
    }
    if ((task.attachments?.length ?? 0) + files.length > COLLAB_MAX_FILES_PER_TASK) {
      toast.error(t('detail.tooManyFiles', { max: COLLAB_MAX_FILES_PER_TASK }))
      return
    }
    m.addAttachments.mutate({ id: task.id, files }, { onError: (e) => toast.error(getApiErrorMessage(e)) })
  }

  return (
    <aside
      className={cn(
        'fixed inset-0 flex flex-col bg-[var(--color-card)] shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:border-l md:border-[var(--color-border)]',
        wide ? 'md:w-[min(1040px,100vw)]' : 'md:w-[min(600px,100vw)]',
        'animate-in slide-in-from-right duration-200',
        zClass,
        dragOver && 'ring-2 ring-inset ring-[var(--color-primary)]',
      )}
      onDragOver={(e) => { if (editable && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true) } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false) }}
      onDrop={(e) => {
        if (!editable || !e.dataTransfer.files.length) return
        e.preventDefault()
        setDragOver(false)
        addFiles(Array.from(e.dataTransfer.files))
      }}
      aria-label={t('detail.title')}
    >
      {/* Đầu bảng như Lark: ✓ Đánh dấu hoàn thành | theo dõi · chia sẻ · phóng to · ··· · đóng */}
      <header className="flex shrink-0 items-center gap-1 border-b border-[var(--color-border)] px-4 py-2.5">
        {task && (task.status === 'DONE' || (partMode && task.myPartDone) ? (
          <Button size="sm" variant="outline" disabled={!editable}
            className="border-[var(--color-success)] bg-[var(--color-success-bg)] text-[var(--color-success)] hover:text-[var(--color-success)]"
            title={t('row.markTodo')} onClick={() => setStatus('TODO')}>
            <CheckCircle2 /> {task.status === 'DONE' ? t('detail.completed') : t('detail.myPartDone')}
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled={!editable || task.status === 'CANCELLED'} onClick={() => setStatus('DONE')}
            className="border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]">
            <Check /> {partMode ? t('row.markMyPart') : t('row.markDone')}
          </Button>
        ))}
        <div className="flex-1" />
        {viewers.length > 0 && <ViewingNow viewers={viewers} />}
        {task && myId && (
          // Lark: icon "đánh dấu" — xanh đặc khi đang theo dõi. Người thực hiện vốn nhận mọi thay đổi nên luôn đặc, không bấm.
          <Button size="icon-sm" variant="ghost" disabled={isAssignee}
            className={cn((task.following || isAssignee) && 'text-[var(--color-primary)] disabled:opacity-100')}
            title={isAssignee ? t('detail.followingAsAssignee') : task.following ? t('detail.unfollow') : t('detail.follow')}
            aria-label={task.following ? t('detail.unfollow') : t('detail.follow')}
            onClick={() => (task.following
              ? m.removeFollower.mutate({ id: task.id, userId: myId }, { onError: onConflict })
              : m.addFollower.mutate({ id: task.id, userId: myId }, { onError: onConflict }))}>
            <Bookmark className={cn((task.following || isAssignee) && 'fill-current')} />
          </Button>
        )}
        <Button size="icon-sm" variant="ghost" aria-label={t('detail.share')} title={t('detail.share')} onClick={copyLink}><Share2 /></Button>
        <Button size="icon-sm" variant="ghost" className="hidden md:inline-flex" aria-label={wide ? t('detail.shrink') : t('detail.expand')}
          title={wide ? t('detail.shrink') : t('detail.expand')} onClick={toggleWide}>{wide ? <Minimize2 /> : <Maximize2 />}</Button>
        {task && (
          <Popover>
            <PopoverTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label={t('detail.more')}><MoreHorizontal /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-1" align="end">
              <MenuItem icon={<ListTree size={15} />} disabled={!editable} onClick={() => setParentPick(true)}>{t('structure.setParent')}</MenuItem>
              {task.parentTaskId && (
                <MenuItem icon={<RefreshCw size={15} />} disabled={!editable}
                  onClick={() => m.setParent.mutate({ id: task.id, parentTaskId: null, version: task.version }, { onSuccess: () => toast.success(t('structure.converted')), onError: onConflict })}>
                  {t('structure.convert')}
                </MenuItem>
              )}
              <MenuItem icon={<Diamond size={15} />} disabled={!editable}
                trailing={task.milestone ? <Check size={14} className="text-[var(--color-primary)]" /> : undefined}
                onClick={() => m.setMilestone.mutate({ id: task.id, milestone: !task.milestone, version: task.version }, { onError: onConflict })}>
                {t('structure.milestone')}
              </MenuItem>
              <MenuItem icon={<GitBranch size={15} className="rotate-180" />} disabled={!editable} onClick={() => setDepPick('BLOCKED_BY')}>{t('deps.menuBlockedBy')}</MenuItem>
              <MenuItem icon={<GitBranch size={15} />} disabled={!editable} onClick={() => setDepPick('BLOCKING')}>{t('deps.menuBlocking')}</MenuItem>
              <div className="my-1 h-px bg-[var(--color-border)]" />
              {task.canReassign && task.kpiState !== 'NONE' && root && (
                <MenuItem icon={<ArrowLeftRight size={15} />} onClick={() => setAssignOpen(true)}>{t('detail.reassignWithKpi')}</MenuItem>
              )}
              <MenuItem icon={<Copy size={15} />} disabled={!editable}
                onClick={() => m.duplicate.mutate(task.id, { onSuccess: (c) => { toast.success(t('detail.duplicated')); onNavigate(c.id) }, onError: onConflict })}>
                {t('detail.duplicate')}
              </MenuItem>
              {root && (
                <MenuItem icon={<Lock size={15} />} disabled={!editable}
                  trailing={task.visibility === 'PRIVATE' ? <Check size={14} className="text-[var(--color-primary)]" /> : undefined}
                  onClick={() => save({ visibility: task.visibility === 'PRIVATE' ? 'KPI_SCOPE' : 'PRIVATE' })}>
                  {t('detail.privateToggle')}
                </MenuItem>
              )}
              {task.canDecline && <MenuItem icon={<UserMinus size={15} />} onClick={() => setDeclineOpen(true)}>{t('decline.action')}</MenuItem>}
              <div className="my-1 h-px bg-[var(--color-border)]" />
              <MenuItem icon={<History size={15} />} onClick={() => setHistoryOpen(true)}>{t('detail.viewHistory')}</MenuItem>
              <MenuItem icon={<Trash2 size={15} />} danger disabled={!task.canDelete} onClick={() => { remove([task]); onClose() }}>{t('detail.delete')}</MenuItem>
            </PopoverContent>
          </Popover>
        )}
        <Button size="icon-sm" variant="ghost" aria-label={t('detail.close')} onClick={onClose}><X /></Button>
      </header>

      {isLoading || !task ? (
        <div className="flex flex-1 items-center justify-center p-10 text-sm">
          {error ? <span className="text-[var(--color-error)]">{getApiErrorMessage(error)}</span> : <Loader2 className="animate-spin text-[var(--color-subtle-foreground)]" />}
        </div>
      ) : (
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto">
          {task.readOnlyReason && task.readOnlyReason !== 'NOT_OWNER' && (
            <div className="flex items-center gap-2 border-b border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-6 py-2 text-sm text-[var(--color-warning)]">
              <Lock size={14} /> {t(`readOnly.${task.readOnlyReason}`)}
            </div>
          )}

          <div className="px-6 pb-5 pt-4">
            {/* Việc cha: dòng nhỏ "Tên việc cha ›" phía trên tên như Lark */}
            {task.parentTaskId && (
              <button type="button" onClick={() => onNavigate(task.parentTaskId!)}
                className="mb-1 inline-flex max-w-full items-center gap-0.5 rounded px-1 text-sm text-[var(--color-subtle-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]">
                <span className="truncate">{task.parentTitle ?? t('detail.backToParent')}</span><ChevronRight size={14} className="shrink-0" />
              </button>
            )}
            <TitleEditor key={`${task.id}:${task.version}`} task={task} editable={editable} onSave={(title) => save({ title })} />

            <div className="mt-3 space-y-0.5">
              <TaskProperties task={task} editable={editable} save={save} onStatus={(s) => setStatus(s)} />
              <Description task={task} editable={editable} onSave={(doc, plain) => save({ descriptionDoc: doc, description: plain })} />
              {(task.depth < MAX_TASK_DEPTH || task.subtaskTotal > 0) && <Subtasks task={task} editable={editable && task.depth < MAX_TASK_DEPTH} onOpen={onNavigate} />}
              <Checklist task={task} editable={editable} />
              <Attachments task={task} editable={editable} onAdd={addFiles} onPreview={setPreview} />
              <Dependencies task={task} editable={editable} onOpen={onNavigate} />
            </div>
          </div>

          {/* Khối Bình luận của Lark: dải ngăn dày, tiêu đề, bình luận xen dòng hoạt động xám */}
          <div className="h-2 bg-[var(--color-muted)]" aria-hidden />
          <section className="pt-4">
            <h3 className="px-6 text-base font-semibold text-[var(--color-foreground)]">{t('detail.commentTitle')}</h3>
            <DiscussionPanel variant="lark" targetType="TASK" targetId={task.id} focusCommentId={focusCommentId} scrollParent={bodyRef} composerSlot={composerSlot}
              extras={history.map((h) => ({ id: h.id, at: h.createdAt, node: <HistoryLine h={h} compact /> }))} />
          </section>
        </div>
      )}

      {/* Chân bảng như Lark: ô viết bình luận, rồi dòng người theo dõi */}
      {task && <div ref={setComposerSlot} className="shrink-0 bg-[var(--color-card)] [&>div]:border-t [&>div]:border-[var(--color-border)]" />}
      {task && <FollowersBar task={task} />}

      <AssignDialog task={task ?? null} open={assignOpen} onClose={() => setAssignOpen(false)} />
      {task && depPick && <DependencyPicker task={task} direction={depPick} onClose={() => setDepPick(null)} />}
      {task && parentPick && <ParentPicker task={task} onClose={() => setParentPick(false)} onDone={onConflict} />}
      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} size="md" title={t('detail.historyTitle')}>
        {task && <Activity taskId={task.id} />}
      </Dialog>
      <Dialog open={declineOpen} onClose={() => setDeclineOpen(false)} size="sm" title={t('decline.title')} description={t('decline.description')}
        footer={<DialogFooter
          secondary={<Button variant="outline" onClick={() => setDeclineOpen(false)}>{t('detail.close')}</Button>}
          primary={<Button variant="destructive" disabled={m.decline.isPending || !task}
            onClick={() => task && m.decline.mutate({ id: task.id, reason: reason.trim() || undefined }, {
              onSuccess: () => { setDeclineOpen(false); setReason(''); toast.success(t('decline.done')) },
              onError: onConflict,
            })}>{t('decline.action')}</Button>}
        />}>
        <Textarea rows={3} maxLength={500} value={reason} placeholder={t('decline.reasonPlaceholder')} onChange={(e) => setReason(e.target.value)} />
      </Dialog>
      <ConfirmDialog open={!!confirmForce} onClose={() => setConfirmForce(null)}
        onConfirm={() => { setConfirmForce(null); setStatus('DONE', true) }}
        title={t('row.openSubtasksTitle')} description={confirmForce ?? ''} confirmLabel={t('row.completeAnyway')} />
      <Dialog open={!!scopeAsk} onClose={() => setScopeAsk(null)} size="sm" title={t('scope.title')} description={t('scope.description')}
        footer={<DialogFooter
          secondary={<Button variant="outline" onClick={() => { if (scopeAsk) { scopeRef.current = 'THIS'; send(scopeAsk, 'THIS') } setScopeAsk(null) }}>{t('scope.this')}</Button>}
          primary={<Button onClick={() => { if (scopeAsk) { scopeRef.current = 'FOLLOWING'; send(scopeAsk, 'FOLLOWING') } setScopeAsk(null) }}>{t('scope.following')}</Button>}
        />}>
        <p className="text-sm text-[var(--color-subtle-foreground)]">{t('scope.hint')}</p>
      </Dialog>
      {preview && <MediaPreviewModal isOpen url={preview.url} fileName={preview.name} contentType={preview.type ?? undefined} onClose={() => setPreview(null)} />}
    </aside>
  )
}

function MenuItem({ icon, children, onClick, disabled, danger, trailing }: {
  icon: ReactNode; children: ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean; trailing?: ReactNode
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={cn('flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--color-muted)] disabled:opacity-40 disabled:hover:bg-transparent',
        danger && 'text-[var(--color-error)]')}>
      {icon} <span className="flex-1">{children}</span>{trailing}
    </button>
  )
}

/** Tên sửa trực tiếp: bấm vào là sửa, Enter / rời ô là lưu, Esc huỷ. */
function TitleEditor({ task, editable, onSave }: { task: KpiTask; editable: boolean; onSave: (title: string) => void }) {
  const [value, setValue] = useState(task.title)
  const commit = () => {
    const v = value.trim()
    if (!v) { setValue(task.title); return }
    if (v !== task.title) onSave(v)
  }
  return (
    // Ô sửa tại chỗ của tiêu đề — ngoại lệ có chủ đích của quy ước Textarea (như ô sửa trong bảng).
    <textarea
      value={value}
      rows={1}
      readOnly={!editable}
      maxLength={255}
      onChange={(e) => setValue(e.target.value.replace(/\n/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() }
        if (e.key === 'Escape') { e.stopPropagation(); setValue(task.title); (e.target as HTMLTextAreaElement).blur() }
      }}
      className={cn('no-edit-hint w-full resize-none rounded-md bg-transparent px-1 py-0.5 text-xl font-semibold leading-snug text-[var(--color-foreground)] outline-none [field-sizing:content]',
        editable && 'hover:bg-[var(--color-muted)] focus:bg-[var(--color-muted)]', isClosed(task) && 'line-through text-[var(--color-subtle-foreground)]')}
    />
  )
}

/** Mô tả (Lark: dòng "≡ Thêm mô tả"): trống thì chữ xám, bấm mới mở trình soạn. */
function Description({ task, editable, onSave }: { task: KpiTask; editable: boolean; onSave: (doc: string, plain: string) => void }) {
  const { t } = useTranslation('tasks')
  const [open, setOpen] = useState(false)
  const empty = !(task.description ?? '').trim()
  if (empty && !editable) return null
  return (
    <PropRow icon={<AlignLeft size={16} />} title={t('detail.description')}>
      {empty && !open ? (
        <button type="button" onClick={() => setOpen(true)} className={placeholderBtn}>{t('detail.addDescriptionLark')}</button>
      ) : (
        <div className="w-full">
          <TaskDescriptionEditor key={task.id} doc={task.descriptionDoc} plain={task.description} editable={editable} autoFocus={open} onSave={onSave} />
        </div>
      )}
    </PropRow>
  )
}

/** Ô nhập "thêm mục" cuối danh sách việc con / checklist — ngoại lệ có chủ đích của quy ước Input. */
function AddLine({ placeholder, autoFocus, maxLength, onAdd, onCancel }: {
  placeholder: string; autoFocus?: boolean; maxLength: number; onAdd: (v: string) => void; onCancel: () => void
}) {
  const [v, setV] = useState('')
  return (
    <div className="flex items-center gap-2 py-1">
      <Plus size={14} className="shrink-0 text-[var(--color-subtle-foreground)]" />
      <input value={v} onChange={(e) => setV(e.target.value)} maxLength={maxLength} autoFocus={autoFocus} placeholder={placeholder}
        onBlur={() => { if (!v.trim()) onCancel() }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setV(''); onCancel() }
          if (e.key === 'Enter' && v.trim() && !e.nativeEvent.isComposing) { e.preventDefault(); onAdd(v.trim()); setV('') }
        }}
        className="no-edit-hint flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-[var(--color-muted-foreground)]" />
    </div>
  )
}

/** Việc con kiểu Lark: chưa có ⇒ "Thêm việc con"; có ⇒ "0/3 ▬" rồi từng dòng ○ + "+ Thêm việc con". */
function Subtasks({ task, editable, onOpen }: { task: KpiTask; editable: boolean; onOpen: (id: string) => void }) {
  const { t } = useTranslation('tasks')
  const [adding, setAdding] = useState(false)
  const m = useTaskMutations()
  const qc = useQueryClient()
  const subs = task.subtasks ?? []
  const add = (title: string) => {
    taskApi.create({ parentTaskId: task.id, title }).then(() => qc.invalidateQueries({ queryKey: taskKeys.all }))
      .catch((e) => toast.error(getApiErrorMessage(e)))
  }
  if (!editable && subs.length === 0) return null
  const pct = task.subtaskTotal ? Math.round((task.subtaskDone / task.subtaskTotal) * 100) : 0
  return (
    <PropRow icon={<ListTree size={16} />} title={t('detail.subtasks')}>
      {subs.length === 0 && !adding ? (
        <button type="button" onClick={() => setAdding(true)} className={placeholderBtn}>{t('detail.addSubtaskLark')}</button>
      ) : (
        <div className="w-full">
          {subs.length > 0 && (
            <div className="flex h-8 items-center gap-2 px-1.5 text-sm text-[var(--color-subtle-foreground)]">
              <span className="tabular-nums">{task.subtaskDone} / {task.subtaskTotal}</span>
              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--color-muted)]">
                <span className="block h-full rounded-full bg-[var(--color-success)]" style={{ width: `${pct}%` }} />
              </span>
            </div>
          )}
          {subs.map((s) => {
            const SS = statusStyleOf(s)
            return (
              <div key={s.id} className="group flex min-h-8 items-center gap-2 rounded-md px-1.5 hover:bg-[var(--color-muted)]">
                <button type="button" disabled={!s.canEdit || s.status === 'CANCELLED'} className={SS.className}
                  aria-label={s.status === 'DONE' ? t('row.markTodo') : t('row.markDone')}
                  onClick={() => m.changeStatus.mutate({ id: s.id, status: s.status === 'DONE' ? 'TODO' : 'DONE', version: s.version },
                    { onError: (e) => toast.error(getApiErrorMessage(e)) })}>
                  <SS.icon size={16} />
                </button>
                <button type="button" onClick={() => onOpen(s.id)}
                  className={cn('min-w-0 flex-1 truncate text-left text-sm', isClosed(s) && 'text-[var(--color-subtle-foreground)] line-through')}>
                  {s.title}
                </button>
                {s.subtaskTotal > 0 && <span className="text-xs text-[var(--color-subtle-foreground)]">{s.subtaskDone}/{s.subtaskTotal}</span>}
                {s.dueDate && <span className={cn('text-xs', dueTone(s))}>{shortDue(s)}</span>}
                <AssigneeStack task={s} size="sm" max={2} />
                <ChevronRight size={14} className="shrink-0 text-[var(--color-subtle-foreground)] opacity-0 group-hover:opacity-100" />
              </div>
            )
          })}
          {editable && (adding
            ? <div className="px-1.5"><AddLine placeholder={t('detail.addSubtask')} autoFocus maxLength={255} onAdd={add} onCancel={() => setAdding(false)} /></div>
            : <button type="button" onClick={() => setAdding(true)} className={cn(placeholderBtn, 'inline-flex items-center gap-1 text-xs')}><Plus size={12} /> {t('detail.addSubtaskLark')}</button>)}
        </div>
      )}
    </PropRow>
  )
}

/** Checklist (KeyGo có, Lark không) — cùng kiểu dòng chỉ-icon. */
function Checklist({ task, editable }: { task: KpiTask; editable: boolean }) {
  const { t } = useTranslation('tasks')
  const [adding, setAdding] = useState(false)
  const m = useTaskMutations()
  const onError = (e: unknown) => toast.error(getApiErrorMessage(e))
  const items = task.checklist ?? []
  if (!editable && items.length === 0) return null
  const add = (title: string) => m.addChecklist.mutate({ id: task.id, title }, { onError })
  return (
    <PropRow icon={<ListChecks size={16} />} title={t('detail.checklist')}>
      {items.length === 0 && !adding ? (
        <button type="button" onClick={() => setAdding(true)} className={placeholderBtn}>{t('detail.addChecklistLark')}</button>
      ) : (
        <div className="w-full">
          {items.length > 0 && <div className="flex h-8 items-center px-1.5 text-sm tabular-nums text-[var(--color-subtle-foreground)]">{task.checklistDone} / {task.checklistTotal}</div>}
          {items.map((item) => (
            <div key={item.id} className="group flex min-h-8 items-center gap-2 rounded-md px-1.5 hover:bg-[var(--color-muted)]">
              <Checkbox checked={item.done} disabled={!editable}
                onCheckedChange={(v) => m.updateChecklist.mutate({ id: task.id, itemId: item.id, done: !!v }, { onError })} />
              <span className={cn('flex-1 text-sm', item.done && 'text-[var(--color-subtle-foreground)] line-through')}>{item.title}</span>
              {editable && (
                <button type="button" aria-label={t('detail.removeItem')} className="opacity-0 group-hover:opacity-100"
                  onClick={() => m.deleteChecklist.mutate({ id: task.id, itemId: item.id }, { onError })}><X size={13} /></button>
              )}
            </div>
          ))}
          {editable && (adding
            ? <div className="px-1.5"><AddLine placeholder={t('detail.addItem')} autoFocus maxLength={500} onAdd={add} onCancel={() => setAdding(false)} /></div>
            : <button type="button" onClick={() => setAdding(true)} className={cn(placeholderBtn, 'inline-flex items-center gap-1 text-xs')}><Plus size={12} /> {t('detail.addItem')}</button>)}
        </div>
      )}
    </PropRow>
  )
}

/** Tệp đính kèm (Lark: "📎 Thêm tệp đính kèm"); kéo thả tệp vào bảng cũng được. */
function Attachments({ task, editable, onAdd, onPreview }: {
  task: KpiTask; editable: boolean; onAdd: (files: File[]) => void; onPreview: (p: { url: string; name: string; type: string | null }) => void
}) {
  const { t } = useTranslation('tasks')
  const m = useTaskMutations()
  const fileRef = useRef<HTMLInputElement>(null)
  const files = task.attachments ?? []
  if (!editable && files.length === 0) return null
  const picker = editable && (
    <>
      <input ref={fileRef} type="file" multiple accept={COLLAB_ACCEPT} className="hidden"
        onChange={(e) => { onAdd(Array.from(e.target.files ?? [])); e.target.value = '' }} />
      {/* Từ thư viện tài liệu: bản sao tệp, đi chung luồng tải lên (cùng luật loại / dung lượng / số tệp). */}
      <PickFromLibraryButton variant="ghost" size="icon-sm" iconOnly className="h-7 w-7 text-[var(--color-subtle-foreground)]"
        accept={COLLAB_EXTENSIONS} disabled={m.addAttachments.isPending}
        max={COLLAB_MAX_FILES_PER_TASK - files.length} onPicked={onAdd} />
    </>
  )
  return (
    <PropRow icon={<Paperclip size={16} />} title={t('detail.attachments')}>
      {files.length === 0 ? (
        <>
          <button type="button" className={placeholderBtn} disabled={m.addAttachments.isPending} title={t('detail.dropFiles')}
            onClick={() => fileRef.current?.click()}>
            {m.addAttachments.isPending ? <Loader2 size={14} className="animate-spin" /> : t('detail.addAttachmentLark')}
          </button>
          {picker}
        </>
      ) : (
        <div className="w-full space-y-1.5">
          <div className="flex flex-wrap items-start gap-2">
            {files.map((a) => (
              <div key={a.id} className="group relative flex max-w-[240px] flex-col gap-0.5">
                <button type="button" onClick={() => onPreview({ url: a.fileUrl, name: a.fileName, type: a.contentType })}
                  className="flex w-fit items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-1 pr-2 text-xs">
                  {a.image ? <img src={a.fileUrl} alt="" className="h-10 w-10 rounded object-cover" /> : <FileText size={16} className="mx-1" />}
                  <span className="max-w-[160px] truncate">{a.fileName}</span>
                </button>
                <LibrarySourceNote source={a} className="pl-0.5" />
                {editable && (
                  <button type="button" aria-label={t('detail.removeFile')}
                    onClick={() => m.deleteAttachment.mutate({ id: task.id, attachmentId: a.id })}
                    className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-[var(--color-card)] p-0.5 shadow group-hover:block">
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {editable && (
            <div className="flex items-center gap-1">
              <button type="button" className={cn(placeholderBtn, 'inline-flex items-center gap-1 text-xs')} disabled={m.addAttachments.isPending}
                onClick={() => fileRef.current?.click()}>
                {m.addAttachments.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} {t('detail.attach')}
              </button>
              {picker}
            </div>
          )}
        </div>
      )}
    </PropRow>
  )
}

/** Phụ thuộc: chỉ hiện khi đã có (thêm qua ··· > "Bị chặn bởi" / "Đang chặn" như Lark). */
function Dependencies({ task, editable, onOpen }: { task: KpiTask; editable: boolean; onOpen: (id: string) => void }) {
  const { t } = useTranslation('tasks')
  const m = useTaskMutations()
  const deps = task.dependencies ?? []
  if (deps.length === 0) return null
  return (
    <PropRow icon={<GitBranch size={16} />} title={t('deps.title')}>
      <div className="w-full">
        {deps.map((d) => {
          const SS = STATUS_STYLE[d.status]
          return (
            <div key={d.id} className="group flex min-h-8 items-center gap-2 rounded-md px-1.5 text-sm hover:bg-[var(--color-muted)]">
              <span className={cn('shrink-0 rounded px-1.5 text-[11px]', d.direction === 'BLOCKED_BY'
                ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' : 'bg-[var(--color-muted)] text-[var(--color-subtle-foreground)]')}>
                {t(`deps.${d.direction}`)}
              </span>
              <SS.icon size={14} className={SS.className} />
              {d.accessible
                ? <button type="button" onClick={() => onOpen(d.taskId)} className="min-w-0 flex-1 truncate text-left hover:underline">{d.title}</button>
                : <span className="min-w-0 flex-1 truncate text-[var(--color-subtle-foreground)]">{t('deps.hidden')}</span>}
              {d.dueDate && <span className="text-xs text-[var(--color-subtle-foreground)]">{shortDue({ dueDate: d.dueDate, dueTime: null })}</span>}
              {editable && (
                <button type="button" aria-label={t('deps.remove')} onClick={() => m.removeDependency.mutate(d.id, { onError: (e) => toast.error(getApiErrorMessage(e)) })}
                  className="text-[var(--color-subtle-foreground)] opacity-0 hover:text-[var(--color-error)] group-hover:opacity-100"><X size={13} /></button>
              )}
            </div>
          )
        })}
        {task.openBlockers > 0 && !isClosed(task) && (
          <p className="inline-flex items-center gap-1 px-1.5 text-xs text-[var(--color-warning)]"><Ban size={12} /> {t('row.blocked', { count: task.openBlockers })}</p>
        )}
      </div>
    </PropRow>
  )
}

/** Hộp chọn việc cho "Bị chặn bởi" / "Đang chặn" (mở từ menu ···). */
function DependencyPicker({ task, direction, onClose }: { task: KpiTask; direction: 'BLOCKED_BY' | 'BLOCKING'; onClose: () => void }) {
  const { t } = useTranslation('tasks')
  const m = useTaskMutations()
  const [q, setQ] = useState('')
  const deps = task.dependencies ?? []
  const { data: found, isFetching } = useQuery({
    queryKey: ['kpi-tasks', 'dep-search', q],
    queryFn: () => taskApi.list({ view: 'SEARCH', keyword: q || undefined, size: 20, status: ['TODO', 'IN_PROGRESS'] }),
  })
  const candidates = (found?.content ?? []).filter((x) => x.id !== task.id && !deps.some((d) => d.taskId === x.id))
  const pick = (otherId: string) => {
    const v = direction === 'BLOCKED_BY' ? { id: task.id, predecessorId: otherId } : { id: otherId, predecessorId: task.id }
    m.addDependency.mutate(v, { onSuccess: onClose, onError: (e) => toast.error(getApiErrorMessage(e)) })
  }
  return (
    <Dialog open onClose={onClose} size="sm" title={t(direction === 'BLOCKED_BY' ? 'deps.menuBlockedBy' : 'deps.menuBlocking')}
      description={t(direction === 'BLOCKED_BY' ? 'deps.pickBlockedByHint' : 'deps.pickBlockingHint')}>
      <Input size="sm" value={q} autoFocus onChange={(e) => setQ(e.target.value)} prefix={<Search size={13} />} placeholder={t('deps.search')} />
      <div className="mt-2 max-h-72 overflow-y-auto">
        {candidates.map((c) => (
          <button key={c.id} type="button" onClick={() => pick(c.id)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--color-muted)]">
            <span className="min-w-0 flex-1 truncate">{c.title}</span>
            {c.dueDate && <span className="text-xs text-[var(--color-subtle-foreground)]">{shortDue(c)}</span>}
          </button>
        ))}
        {!isFetching && candidates.length === 0 && <p className="p-2 text-xs text-[var(--color-subtle-foreground)]">{t('deps.noCandidates')}</p>}
      </div>
    </Dialog>
  )
}

/** Hộp "Đặt việc cha" (Lark: Set Parent Task) — tìm việc mình sửa được; không gồm chính nó và con cháu. */
function ParentPicker({ task, onClose, onDone }: { task: KpiTask; onClose: () => void; onDone: (e: unknown) => void }) {
  const { t } = useTranslation('tasks')
  const m = useTaskMutations()
  const [q, setQ] = useState('')
  const { data: found, isFetching } = useQuery({
    queryKey: ['kpi-tasks', 'parent-search', q],
    queryFn: () => taskApi.list({ view: 'SEARCH', keyword: q || undefined, size: 20, status: ['TODO', 'IN_PROGRESS'] }),
  })
  // Con cháu của chính việc này bị máy chủ chặn (TASK_PARENT_INVALID) — ở đây chỉ bỏ chính nó và việc cha hiện tại.
  const candidates = (found?.content ?? []).filter((x) => x.id !== task.id && x.id !== task.parentTaskId && x.canEdit)
  return (
    <Dialog open onClose={onClose} size="sm" title={t('structure.setParent')} description={t('structure.setParentHint')}>
      <Input size="sm" value={q} autoFocus onChange={(e) => setQ(e.target.value)} prefix={<Search size={13} />} placeholder={t('deps.search')} />
      <div className="mt-2 max-h-72 overflow-y-auto">
        {candidates.map((c) => (
          <button key={c.id} type="button" disabled={m.setParent.isPending}
            onClick={() => m.setParent.mutate({ id: task.id, parentTaskId: c.id, version: task.version }, {
              onSuccess: () => { toast.success(t('structure.parentSet')); onClose() }, onError: onDone,
            })}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--color-muted)]">
            <span className="min-w-0 flex-1 truncate">{c.title}</span>
            {c.kpiName && <span className="max-w-[40%] truncate text-xs text-[var(--color-subtle-foreground)]">{c.kpiName}</span>}
          </button>
        ))}
        {!isFetching && candidates.length === 0 && <p className="p-2 text-xs text-[var(--color-subtle-foreground)]">{t('deps.noCandidates')}</p>}
      </div>
    </Dialog>
  )
}

/** Chân bảng như Lark: 🔖 avatar + "2 người theo dõi" + "+". Người có quyền quản lý thêm / bớt được. */
function FollowersBar({ task }: { task: KpiTask }) {
  const { t } = useTranslation('tasks')
  const myId = useAuthStore((s) => s.user?.id)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const m = useTaskMutations()
  const onError = (e: unknown) => toast.error(getApiErrorMessage(e))
  const { data: candidates = [] } = useQuery({
    queryKey: ['kpi-tasks', 'follower-candidates', task.id, q],
    queryFn: () => taskApi.followerCandidates(task.id, q),
    enabled: open && task.canManageFollowers,
  })
  const followers = task.followers
  return (
    <div className="flex shrink-0 items-center gap-2 bg-[var(--color-card)] px-6 py-2">
      <Bookmark size={16} className="shrink-0 text-[var(--color-subtle-foreground)]" aria-hidden />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={cn('inline-flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-sm hover:opacity-80',
            followers.length ? 'bg-[var(--color-muted)] text-[var(--color-foreground)]' : 'px-2 text-[var(--color-muted-foreground)]')}>
            {followers.length > 0 && (
              <span className="flex -space-x-1.5">
                {followers.slice(0, 3).map((f) => (
                  <UserAvatar key={f.id} fullName={f.fullName} avatarUrl={f.avatarUrl} className="h-6 w-6 rounded-full text-[10px] ring-2 ring-[var(--color-muted)]"
                    fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]" />
                ))}
              </span>
            )}
            {followers.length ? t('detail.followersCount', { count: followers.length }) : t('detail.noFollowers')}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start" side="top">
          {followers.map((f) => (
            <div key={f.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm">
              <UserAvatar fullName={f.fullName} avatarUrl={f.avatarUrl} className="h-6 w-6 rounded-full text-[9px]" fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]" />
              <span className="min-w-0 flex-1 truncate">{f.fullName}</span>
              {(task.canManageFollowers || f.id === myId) && (
                <button type="button" aria-label={t('detail.removeFollower')} className="text-[var(--color-subtle-foreground)] hover:text-[var(--color-error)]"
                  onClick={() => m.removeFollower.mutate({ id: task.id, userId: f.id }, { onError })}><X size={13} /></button>
              )}
            </div>
          ))}
          {task.canManageFollowers && (
            <>
              <Input size="sm" value={q} onChange={(e) => setQ(e.target.value)} prefix={<Search size={13} />} placeholder={t('assign.searchPeople')}
                className={cn(followers.length > 0 && 'mt-1')} />
              <div className="mt-2 max-h-52 overflow-y-auto">
                {candidates.map((c) => (
                  <button key={c.id} type="button" onClick={() => m.addFollower.mutate({ id: task.id, userId: c.id }, { onError })}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-[var(--color-muted)]">
                    <UserAvatar fullName={c.name} avatarUrl={c.avatarUrl} className="h-6 w-6 rounded-full text-[9px]" fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{c.name}</span>
                      <span className="block truncate text-[11px] text-[var(--color-subtle-foreground)]">{c.detail}</span>
                    </span>
                  </button>
                ))}
                {candidates.length === 0 && <p className="p-2 text-xs text-[var(--color-subtle-foreground)]">{t('detail.noFollowerCandidates')}</p>}
              </div>
            </>
          )}
          {!task.canManageFollowers && followers.length === 0 && <p className="p-2 text-xs text-[var(--color-subtle-foreground)]">{t('detail.noFollowersYet')}</p>}
        </PopoverContent>
      </Popover>
      {task.canManageFollowers && (
        <button type="button" aria-label={t('detail.addFollower')} title={t('detail.addFollower')} onClick={() => setOpen(true)}
          className="rounded-md p-1.5 text-[var(--color-subtle-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]">
          <Plus size={16} />
        </button>
      )}
    </div>
  )
}

function Activity({ taskId }: { taskId: string }) {
  const { data: history = [], isLoading } = useTaskHistory(taskId, true)
  if (isLoading) return <div className="flex justify-center p-6"><Loader2 className="animate-spin text-[var(--color-subtle-foreground)]" /></div>
  return (
    <div className="max-h-[60vh] space-y-3 overflow-y-auto">
      {[...history].reverse().map((h) => <HistoryLine key={h.id} h={h} />)}
      {history.length === 0 && <p className="text-xs text-[var(--color-subtle-foreground)]">-</p>}
    </div>
  )
}

/** Người khác đang mở việc này: chồng avatar có chấm xanh. */
function ViewingNow({ viewers }: { viewers: TaskViewer[] }) {
  const { t } = useTranslation('tasks')
  const names = viewers.map((v) => v.fullName).join(', ')
  return (
    <span className="mr-1 inline-flex items-center -space-x-1.5" title={t('detail.viewing', { names })} aria-label={t('detail.viewing', { names })}>
      {viewers.slice(0, 3).map((v) => (
        <span key={v.userId} className="relative">
          <UserAvatar fullName={v.fullName} avatarUrl={v.avatarUrl} className="h-6 w-6 rounded-full text-[10px] ring-2 ring-[var(--color-card)]"
            fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]" />
          <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-[var(--color-success)] ring-2 ring-[var(--color-card)]" />
        </span>
      ))}
      {viewers.length > 3 && (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-muted)] text-[10px] text-[var(--color-subtle-foreground)] ring-2 ring-[var(--color-card)]">
          +{viewers.length - 3}
        </span>
      )}
    </span>
  )
}

/**
 * Một dòng lịch sử thay đổi. `compact` = dòng xám xen giữa các bình luận như Lark ("○ Lan đã tạo việc 15:43");
 * đầy đủ = trong hộp "Xem lịch sử".
 */
function HistoryLine({ h, compact }: { h: TaskEvent; compact?: boolean }) {
  const { t } = useTranslation('tasks')
  const text = historyText(t, h.action, h.oldValue, h.newValue)
  if (compact) {
    return (
      <div className="flex items-start gap-2.5 py-1 text-sm text-[var(--color-subtle-foreground)]">
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full border-2 border-[var(--color-border-strong)]" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="text-[var(--color-primary)]">{h.actorName}</span> <span className="text-[var(--color-foreground)]">{text}</span>
          <span className="ml-2 text-xs">{formatDateTime(h.createdAt)}</span>
        </span>
      </div>
    )
  }
  return (
    <div className="flex gap-2 text-sm">
      <UserAvatar fullName={h.actorName} avatarUrl={null} className="h-6 w-6 shrink-0 rounded-full text-[9px]" fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]" />
      <div className="min-w-0">
        <span className="text-[var(--color-foreground)]"><b>{h.actorName}</b> {text}</span>
        <div className="text-xs text-[var(--color-subtle-foreground)]">{formatDateTime(h.createdAt)}</div>
      </div>
    </div>
  )
}
