import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  ArrowLeft, ArrowRightLeft, Copy, FileText, History, Link2, Loader2, Lock, MessagesSquare, MoreHorizontal, Paperclip, Plus,
  Trash2, X,
} from 'lucide-react'
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
import DiscussionPanel from '@/features/discussion/components/DiscussionPanel'
import { COLLAB_ACCEPT, COLLAB_EXTENSIONS, COLLAB_MAX_FILES_PER_TASK, checkFiles } from '@/features/discussion/attachments'
import LibrarySourceNote from '@/features/documents/components/LibrarySourceNote'
import { PickFromLibraryButton } from '@/features/documents/components/DocumentPickerDialog'
import { taskApi } from '../api/taskApi'
import { taskKeys, useTask, useTaskHistory, useTaskMutations } from '../hooks/useTasks'
import { dueTone, isClosed, shortDue, STATUS_STYLE } from '../taskUtils'
import type { KpiTask, TaskStatus, UpdateTaskInput } from '../types'
import AssignDialog from './AssignDialog'
import TaskDescriptionEditor from './TaskDescriptionEditor'
import TaskProperties from './TaskProperties'

interface Props {
  taskId: string | null
  onClose: () => void
  /** Mở việc khác trong cùng bảng (việc con / quay lại việc cha). */
  onNavigate: (taskId: string) => void
  focusCommentId?: string | null
  initialTab?: 'comments' | 'activity'
  /** Mở trên modal chi tiết KPI (z-[200]) thì phải nổi cao hơn. */
  zClass?: string
}

/** Trường mà "bản mẫu" của chuỗi lặp chép sang các lần sau — sửa chúng trên việc lặp thì hỏi phạm vi. */
const TEMPLATE_FIELDS: (keyof Omit<UpdateTaskInput, 'version'>)[] = ['title', 'description', 'descriptionDoc', 'priority', 'visibility', 'dueTime', 'clearDueTime']

/**
 * Bảng chi tiết trượt từ phải (điện thoại: toàn màn hình). Mọi thay đổi tự lưu, gửi lần lượt và luôn kèm version mới
 * nhất; bị người khác sửa trước (409) thì báo và tải lại. Kỳ đã khoá: chỉ đọc + dải thông báo. Esc / X để đóng.
 */
export default function TaskDetailPanel({ taskId, onClose, onNavigate, focusCommentId, initialTab = 'comments', zClass = 'z-[150]' }: Props) {
  const { t } = useTranslation('tasks')
  const qc = useQueryClient()
  const { data: task, isLoading, error } = useTask(taskId)
  const m = useTaskMutations()
  const [tab, setTab] = useState<'comments' | 'activity'>(focusCommentId ? 'comments' : initialTab)
  const [assignOpen, setAssignOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [scopeAsk, setScopeAsk] = useState<Omit<UpdateTaskInput, 'version'> | null>(null)
  const [confirmForce, setConfirmForce] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<{ url: string; name: string; type: string | null } | null>(null)
  /** Phạm vi đã chọn cho việc lặp đang mở (hỏi một lần mỗi lần mở bảng). */
  const scopeRef = useRef<'THIS' | 'FOLLOWING' | null>(null)
  const latest = useRef<KpiTask | undefined>(task)
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { latest.current = task }, [task])
  useEffect(() => { scopeRef.current = null }, [taskId])

  // Esc đóng bảng (trừ khi đang gõ trong một ô hoặc đang mở hộp thoại).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || assignOpen || moveOpen || confirmDelete || scopeAsk || confirmForce) return
      const el = document.activeElement as HTMLElement | null
      if (el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) { el.blur(); return }
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, assignOpen, moveOpen, confirmDelete, scopeAsk, confirmForce])

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
        if (getApiErrorCode(e) === 'TASK_PARENT_HAS_OPEN_SUBTASKS') { setConfirmForce(getApiErrorMessage(e)); return }
        onConflict(e)
      },
    })
  }

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

  const copyLink = () => {
    if (!task) return
    navigator.clipboard?.writeText(`${window.location.origin}/tasks?task=${task.id}`)
      .then(() => toast.success(t('detail.linkCopied'))).catch(() => {})
  }

  if (!taskId) return null
  const editable = !!task?.canEdit
  const S = task ? STATUS_STYLE[task.status] : STATUS_STYLE.TODO

  return (
    <aside
      className={cn(
        'fixed inset-0 flex flex-col bg-[var(--color-card)] shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:w-[min(560px,100vw)] md:border-l md:border-[var(--color-border)]',
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
      {/* Đầu bảng: quay lại việc cha · sao chép link · … · đóng */}
      <header className="flex shrink-0 items-center gap-1 border-b border-[var(--color-border)] px-3 py-2">
        {task?.parentTaskId && (
          <Button size="sm" variant="ghost" onClick={() => onNavigate(task.parentTaskId!)}>
            <ArrowLeft /> <span className="max-w-[180px] truncate">{task.parentTitle ?? t('detail.backToParent')}</span>
          </Button>
        )}
        <div className="flex-1" />
        <Button size="icon-sm" variant="ghost" aria-label={t('detail.copyLink')} onClick={copyLink}><Link2 /></Button>
        {task && (
          <Popover>
            <PopoverTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label={t('detail.more')}><MoreHorizontal /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-1" align="end">
              <MenuItem icon={<Copy size={14} />} disabled={!editable}
                onClick={() => m.duplicate.mutate(task.id, { onSuccess: (c) => { toast.success(t('detail.duplicated')); onNavigate(c.id) }, onError: onConflict })}>
                {t('detail.duplicate')}
              </MenuItem>
              {!task.parentTaskId && (
                <MenuItem icon={<ArrowRightLeft size={14} />} disabled={!editable} onClick={() => setMoveOpen(true)}>{t('detail.moveKpi')}</MenuItem>
              )}
              <MenuItem icon={<Trash2 size={14} />} danger disabled={!task.canDelete} onClick={() => setConfirmDelete(true)}>{t('detail.delete')}</MenuItem>
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
        <div className="min-h-0 flex-1 overflow-y-auto">
          {task.readOnlyReason && task.readOnlyReason !== 'NOT_OWNER' && (
            <div className="flex items-center gap-2 border-b border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-2 text-sm text-[var(--color-warning)]">
              <Lock size={14} /> {t(`readOnly.${task.readOnlyReason}`)}
            </div>
          )}

          <div className="space-y-5 px-5 py-4">
            {/* Vòng tích + tên sửa trực tiếp */}
            <div className="flex items-start gap-3">
              <button type="button" disabled={!editable || task.status === 'CANCELLED'}
                aria-label={task.status === 'DONE' ? t('row.markTodo') : t('row.markDone')}
                onClick={() => setStatus(task.status === 'DONE' ? 'TODO' : 'DONE')}
                className={cn('mt-1 shrink-0 transition-transform hover:scale-110 disabled:hover:scale-100', S.className)}>
                <S.icon size={22} />
              </button>
              <TitleEditor key={`${task.id}:${task.version}`} task={task} editable={editable} onSave={(title) => save({ title })} />
            </div>

            <TaskProperties task={task} editable={editable} save={save} onStatus={(s) => setStatus(s)} onAssign={() => setAssignOpen(true)} />

            <section className="space-y-1.5">
              <h4 className="text-xs font-medium text-[var(--color-subtle-foreground)]">{t('detail.description')}</h4>
              <TaskDescriptionEditor key={task.id} doc={task.descriptionDoc} plain={task.description} editable={editable}
                onSave={(doc, plain) => save({ descriptionDoc: doc, description: plain })} />
            </section>

            {!task.parentTaskId && <Subtasks task={task} editable={editable} onOpen={onNavigate} />}

            <Checklist task={task} editable={editable} />

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-medium text-[var(--color-subtle-foreground)]">{t('detail.attachments')} {task.attachmentCount > 0 && `(${task.attachmentCount})`}</h4>
                {editable && (
                  <>
                    <input ref={fileRef} type="file" multiple accept={COLLAB_ACCEPT} className="hidden"
                      onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" disabled={m.addAttachments.isPending} onClick={() => fileRef.current?.click()}>
                        {m.addAttachments.isPending ? <Loader2 className="animate-spin" /> : <Paperclip />} {t('detail.attach')}
                      </Button>
                      {/* Từ thư viện tài liệu: bản sao tệp, đi chung luồng tải lên (cùng luật loại / dung lượng / số tệp). */}
                      <PickFromLibraryButton variant="ghost" size="sm" accept={COLLAB_EXTENSIONS} disabled={m.addAttachments.isPending}
                        max={COLLAB_MAX_FILES_PER_TASK - (task.attachments?.length ?? 0)} onPicked={addFiles} />
                    </div>
                  </>
                )}
              </div>
              {(task.attachments ?? []).length === 0
                ? editable && <p className="rounded-card border border-dashed border-[var(--color-border)] p-3 text-center text-xs text-[var(--color-subtle-foreground)]">{t('detail.dropFiles')}</p>
                : (
                  <div className="flex flex-wrap items-start gap-2">
                    {(task.attachments ?? []).map((a) => (
                      <div key={a.id} className="group relative flex max-w-[240px] flex-col gap-0.5">
                        <button type="button" onClick={() => setPreview({ url: a.fileUrl, name: a.fileName, type: a.contentType })}
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
                )}
            </section>
          </div>

          {/* Bình luận / Hoạt động */}
          <div className="border-t border-[var(--color-border)]">
            <div className="flex px-5">
              {(['comments', 'activity'] as const).map((k) => (
                <button key={k} type="button" onClick={() => setTab(k)}
                  className={cn('-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm',
                    tab === k ? 'border-[var(--color-primary)] font-medium text-[var(--color-primary)]' : 'border-transparent text-[var(--color-subtle-foreground)]')}>
                  {k === 'comments' ? <MessagesSquare size={14} /> : <History size={14} />}
                  {t(`detail.tab.${k}`)}
                  {k === 'comments' && task.unreadComments > 0 && (
                    <span className="rounded-full bg-[var(--color-primary)] px-1.5 text-[10px] text-[var(--color-primary-foreground)]">{task.unreadComments}</span>
                  )}
                </button>
              ))}
            </div>
            {tab === 'comments'
              ? <div className="flex h-[480px] flex-col"><DiscussionPanel targetType="TASK" targetId={task.id} focusCommentId={focusCommentId} /></div>
              : <Activity taskId={task.id} />}
          </div>
        </div>
      )}

      <AssignDialog task={task ?? null} open={assignOpen} onClose={() => setAssignOpen(false)} />
      <AssignDialog task={task ?? null} open={moveOpen} kpiOnly onClose={() => setMoveOpen(false)} />
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)}
        onConfirm={() => task && m.remove.mutate(task.id, { onSuccess: () => { setConfirmDelete(false); onClose() }, onError: onConflict })}
        loading={m.remove.isPending} title={t('detail.deleteTitle')} description={t('detail.deleteDescription')} confirmLabel={t('detail.delete')} />
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

function MenuItem({ icon, children, onClick, disabled, danger }: {
  icon: React.ReactNode; children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={cn('flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--color-muted)] disabled:opacity-40 disabled:hover:bg-transparent',
        danger && 'text-[var(--color-error)]')}>
      {icon} {children}
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
      className={cn('no-edit-hint w-full resize-none rounded-md bg-transparent px-1 py-0.5 text-lg font-semibold text-[var(--color-foreground)] outline-none [field-sizing:content]',
        editable && 'hover:bg-[var(--color-muted)] focus:bg-[var(--color-muted)]', isClosed(task) && 'line-through text-[var(--color-subtle-foreground)]')}
    />
  )
}

function Subtasks({ task, editable, onOpen }: { task: KpiTask; editable: boolean; onOpen: (id: string) => void }) {
  const { t } = useTranslation('tasks')
  const [title, setTitle] = useState('')
  const m = useTaskMutations()
  const qc = useQueryClient()
  const subs = task.subtasks ?? []
  const add = () => {
    const v = title.trim()
    if (!v) return
    taskApi.create({ parentTaskId: task.id, title: v }).then(() => {
      setTitle('')
      qc.invalidateQueries({ queryKey: taskKeys.all })
    }).catch((e) => toast.error(getApiErrorMessage(e)))
  }
  return (
    <section className="space-y-1.5">
      <h4 className="text-xs font-medium text-[var(--color-subtle-foreground)]">
        {t('detail.subtasks')} {task.subtaskTotal > 0 && <span>({task.subtaskDone}/{task.subtaskTotal})</span>}
      </h4>
      <div className="overflow-hidden rounded-card border border-[var(--color-border)]">
        {subs.map((s) => {
          const SS = STATUS_STYLE[s.status]
          return (
            <div key={s.id} className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-1.5 last:border-b-0 hover:bg-[var(--color-muted)]">
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
              {s.dueDate && <span className={cn('text-xs', dueTone(s))}>{shortDue(s)}</span>}
              <UserAvatar fullName={s.ownerName} avatarUrl={s.ownerAvatarUrl} className="h-5 w-5 rounded-full text-[9px]" />
            </div>
          )
        })}
        {editable && (
          <div className="flex items-center gap-2 px-3 py-1.5">
            <Plus size={14} className="text-[var(--color-subtle-foreground)]" />
            {/* Ô thêm nhanh trong danh sách — ngoại lệ có chủ đích của quy ước Input. */}
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); add() } }}
              placeholder={t('detail.addSubtask')}
              className="no-edit-hint flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-[var(--color-muted-foreground)]" />
          </div>
        )}
      </div>
    </section>
  )
}

function Checklist({ task, editable }: { task: KpiTask; editable: boolean }) {
  const { t } = useTranslation('tasks')
  const [title, setTitle] = useState('')
  const m = useTaskMutations()
  const onError = (e: unknown) => toast.error(getApiErrorMessage(e))
  const items = task.checklist ?? []
  if (!editable && items.length === 0) return null
  return (
    <section className="space-y-1.5">
      <h4 className="text-xs font-medium text-[var(--color-subtle-foreground)]">
        {t('detail.checklist')} {task.checklistTotal > 0 && <span>({task.checklistDone}/{task.checklistTotal})</span>}
      </h4>
      {items.map((item) => (
        <div key={item.id} className="group flex items-center gap-2 px-1">
          <Checkbox checked={item.done} disabled={!editable}
            onCheckedChange={(v) => m.updateChecklist.mutate({ id: task.id, itemId: item.id, done: !!v }, { onError })} />
          <span className={cn('flex-1 text-sm', item.done && 'text-[var(--color-subtle-foreground)] line-through')}>{item.title}</span>
          {editable && (
            <button type="button" aria-label={t('detail.removeItem')} className="opacity-0 group-hover:opacity-100"
              onClick={() => m.deleteChecklist.mutate({ id: task.id, itemId: item.id }, { onError })}><X size={13} /></button>
          )}
        </div>
      ))}
      {editable && (
        <div className="flex items-center gap-2 px-1">
          <Plus size={14} className="text-[var(--color-subtle-foreground)]" />
          {/* Ô thêm nhanh trong danh sách — ngoại lệ có chủ đích của quy ước Input. */}
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={500}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && title.trim() && !e.nativeEvent.isComposing) {
                e.preventDefault()
                m.addChecklist.mutate({ id: task.id, title: title.trim() }, { onSuccess: () => setTitle(''), onError })
              }
            }}
            placeholder={t('detail.addItem')}
            className="no-edit-hint flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-[var(--color-muted-foreground)]" />
        </div>
      )}
    </section>
  )
}

function Activity({ taskId }: { taskId: string }) {
  const { t } = useTranslation('tasks')
  const { data: history = [], isLoading } = useTaskHistory(taskId, true)
  if (isLoading) return <div className="flex justify-center p-6"><Loader2 className="animate-spin text-[var(--color-subtle-foreground)]" /></div>
  return (
    <div className="space-y-2 px-5 py-4">
      {history.map((h) => (
        <div key={h.id} className="flex gap-2 text-sm">
          <UserAvatar fullName={h.actorName} avatarUrl={null} className="h-6 w-6 shrink-0 rounded-full text-[9px]" />
          <div className="min-w-0">
            <span className="text-[var(--color-foreground)]">
              <b>{h.actorName}</b> {t(`history.${h.action}`, {
                from: h.action === 'STATUS_CHANGED' && h.oldValue ? t(`status.${h.oldValue}`) : (h.oldValue ?? '—'),
                to: h.action === 'STATUS_CHANGED' && h.newValue ? t(`status.${h.newValue}`) : (h.newValue ?? '—'),
                defaultValue: h.action,
              })}
            </span>
            <div className="text-xs text-[var(--color-subtle-foreground)]">{formatDateTime(h.createdAt)}</div>
          </div>
        </div>
      ))}
      {history.length === 0 && <p className="text-xs text-[var(--color-subtle-foreground)]">—</p>}
    </div>
  )
}
