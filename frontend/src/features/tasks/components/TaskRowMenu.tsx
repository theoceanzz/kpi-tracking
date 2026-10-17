import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Check, ChevronRight, Copy, ExternalLink, FolderInput, Inbox, Link2, Trash2 } from 'lucide-react'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { useDeferredDelete } from '../hooks/useDeferredDelete'
import { useMySections, useTaskMutations, useTaskSidebar } from '../hooks/useTasks'
import type { KpiTask } from '../types'

export interface MenuAnchor { x: number; y: number }

/**
 * Menu thao tác của một việc kiểu Lark: chuột phải vào dòng / thẻ, hoặc nút "…" khi rê chuột. Mở · Sao chép link ·
 * Nhân bản · Thêm vào danh sách (menu con) · Xoá (có Hoàn tác). Vẽ trong portal tại vị trí chuột, tự né mép màn hình.
 */
export default function TaskRowMenu({ task, anchor, onClose, onOpen }: {
  task: KpiTask
  anchor: MenuAnchor | null
  onClose: () => void
  onOpen: (task: KpiTask) => void
}) {
  const { t } = useTranslation('tasks')
  const m = useTaskMutations()
  const remove = useDeferredDelete()
  const { data: sidebar } = useTaskSidebar(!!anchor)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<MenuAnchor | null>(anchor)
  const [listsOpen, setListsOpen] = useState(false)
  const [mineOpen, setMineOpen] = useState(false)
  const { data: mySections = [] } = useMySections(!!anchor)
  const [prevAnchor, setPrevAnchor] = useState(anchor)
  if (prevAnchor !== anchor) { setPrevAnchor(anchor); setPos(anchor); setListsOpen(false); setMineOpen(false) }

  // Né mép màn hình sau khi biết kích thước menu.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !anchor) return
    const r = el.getBoundingClientRect()
    const x = Math.min(anchor.x, window.innerWidth - r.width - 8)
    const y = Math.min(anchor.y, window.innerHeight - r.height - 8)
    if (x !== pos?.x || y !== pos?.y) setPos({ x: Math.max(8, x), y: Math.max(8, y) })
  }, [anchor, pos])

  useEffect(() => {
    if (!anchor) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose() }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', esc)
    window.addEventListener('scroll', onClose, true)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', esc)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [anchor, onClose])

  if (!anchor || !pos) return null
  const onError = (e: unknown) => toast.error(getApiErrorMessage(e))
  const lists = (sidebar?.lists ?? []).filter((l) => !l.archived && l.role !== 'VIEWER' && !task.lists.some((x) => x.listId === l.listId))
  const run = (fn: () => void) => () => { fn(); onClose() }

  return createPortal(
    <div ref={ref} role="menu" onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[1100] w-56 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-1 text-sm shadow-lg"
      style={{ left: pos.x, top: pos.y }}>
      <Item icon={<ExternalLink size={14} />} onClick={run(() => onOpen(task))}>{t('menu.open')}</Item>
      <Item icon={<Link2 size={14} />} onClick={run(() => {
        void navigator.clipboard?.writeText(`${window.location.origin}/tasks?task=${task.id}`)
        toast.success(t('detail.linkCopied'))
      })}>{t('detail.copyLink')}</Item>
      <Item icon={<Copy size={14} />} disabled={!task.canEdit}
        onClick={run(() => m.duplicate.mutate(task.id, { onSuccess: () => toast.success(t('detail.duplicated')), onError }))}>
        {t('detail.duplicate')}
      </Item>
      {!task.parentTaskId && (
        <div className="relative" onMouseEnter={() => setListsOpen(true)} onMouseLeave={() => setListsOpen(false)}>
          <Item icon={<FolderInput size={14} />} onClick={() => setListsOpen((v) => !v)} trailing={<ChevronRight size={13} />}>
            {t('lists.addTo')}
          </Item>
          {listsOpen && (
            <div className="absolute left-full top-0 ml-1 max-h-72 w-56 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-1 shadow-lg">
              {lists.map((l) => (
                <Item key={l.listId} icon={<span className="h-2.5 w-2.5 rounded-sm" style={{ background: l.color ?? '#94a3b8' }} />}
                  onClick={run(() => m.addToList.mutate({ listId: l.listId, taskId: task.id }, { onError }))}>
                  {l.name}
                </Item>
              ))}
              {lists.length === 0 && <p className="px-2 py-1.5 text-xs text-[var(--color-subtle-foreground)]">{t('batch.noLists')}</p>}
            </div>
          )}
        </div>
      )}
      {/* Nhóm riêng của tôi — chỉ là cách tôi tự sắp, ai xem được việc cũng xếp được. */}
      <div className="relative" onMouseEnter={() => setMineOpen(true)} onMouseLeave={() => setMineOpen(false)}>
        <Item icon={<Inbox size={14} />} onClick={() => setMineOpen((v) => !v)} trailing={<ChevronRight size={13} />}>
          {t('mySections.moveTo')}
        </Item>
        {mineOpen && (
          <div className="absolute left-full top-0 ml-1 max-h-72 w-52 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-1 shadow-lg">
            {[...mySections].sort((a, b) => a.sortOrder - b.sortOrder).map((ms) => (
              <Item key={ms.id} icon={task.mySectionId === ms.id ? <Check size={13} /> : <span />}
                onClick={run(() => m.assignMySection.mutate({ taskId: task.id, sectionId: ms.id }, { onError }))}>{ms.name}</Item>
            ))}
            {task.mySectionId && (
              <Item icon={<span />} onClick={run(() => m.assignMySection.mutate({ taskId: task.id, sectionId: null }, { onError }))}>
                {t('group.noMySection')}
              </Item>
            )}
            {mySections.length === 0 && <p className="px-2 py-1.5 text-xs text-[var(--color-subtle-foreground)]">{t('mySections.none')}</p>}
          </div>
        )}
      </div>
      <div className="my-1 h-px bg-[var(--color-border)]" />
      <Item icon={<Trash2 size={14} />} danger disabled={!task.canDelete} onClick={run(() => remove([task]))}>{t('detail.delete')}</Item>
    </div>,
    document.body,
  )
}

function Item({ icon, children, onClick, disabled, danger, trailing }: {
  icon: ReactNode; children: ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean; trailing?: ReactNode
}) {
  return (
    <button type="button" role="menuitem" disabled={disabled} onClick={onClick}
      className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[var(--color-muted)] disabled:opacity-40 disabled:hover:bg-transparent',
        danger && 'text-[var(--color-error)]')}>
      <span className="flex w-4 shrink-0 justify-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </button>
  )
}
