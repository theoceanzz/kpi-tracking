import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Folder, Loader2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { useDocumentFolders, useMoveDocument } from '../hooks/useDocuments'
import type { DocumentFolder, KbDocument } from '../types'

/**
 * Chọn thư mục đích để chuyển tài liệu. Chỉ duyệt trong ĐÚNG phạm vi của tài liệu (cùng kho cá nhân / đơn vị /
 * công ty) — chuyển sang phạm vi khác là đổi quyền xem, việc đó làm ở ô "Phạm vi" trong drawer.
 */
export default function MoveDocumentDialog({ doc, onClose }: { doc: KbDocument; onClose: () => void }) {
  const { t } = useTranslation('documents')
  const move = useMoveDocument()
  const [at, setAt] = useState<DocumentFolder | null>(null)
  const { data, isLoading } = useDocumentFolders(at
    ? { parentId: at.id }
    : { scope: doc.scope, unitId: doc.orgUnitId ?? undefined })

  const rootLabel = doc.scope === 'PERSONAL' ? t('location.mine') : doc.scope === 'UNIT' ? (doc.orgUnitName ?? t('scope.UNIT')) : t('scope.COMPANY')
  const target = at?.id ?? null
  const same = target === (doc.folderId ?? null)

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      dismissible={!move.isPending}
      title={t('move.title', { title: doc.title })}
      description={t('move.description')}
      footer={
        <DialogFooter
          note={same ? t('move.alreadyHere') : undefined}
          secondary={<Button variant="outline" onClick={onClose} disabled={move.isPending}>{t('common.cancel')}</Button>}
          primary={
            <Button disabled={same || move.isPending} onClick={() => move.mutate({ id: doc.id, folderId: target }, { onSuccess: onClose })}>
              {move.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {t('move.here')}
            </Button>
          }
        />
      }
    >
      <nav aria-label={t('drive.breadcrumb')} className="mb-3 flex flex-wrap items-center gap-1 text-sm">
        <button type="button" onClick={() => setAt(null)}
                className="rounded-control px-1.5 py-0.5 font-medium text-[var(--color-primary)] hover:bg-[var(--color-muted)]">
          {rootLabel}
        </button>
        {(data?.breadcrumb ?? []).map(f => (
          <span key={f.id} className="flex items-center gap-1">
            <ChevronRight size={14} className="text-[var(--color-muted-foreground)]" aria-hidden="true" />
            <button type="button" onClick={() => setAt(f)}
                    className="max-w-[180px] truncate rounded-control px-1.5 py-0.5 text-[var(--color-foreground)] hover:bg-[var(--color-muted)]">
              {f.name}
            </button>
          </span>
        ))}
      </nav>
      <div className="min-h-[200px] rounded-card border border-[var(--color-border)]">
        {isLoading ? (
          <div className="p-3"><LoadingSkeleton type="table" rows={3} /></div>
        ) : (data?.folders.length ?? 0) === 0 ? (
          <p className="p-6 text-center text-caption">{t('move.noSubfolders')}</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {data!.folders.map(f => (
              <li key={f.id}>
                <button type="button" onClick={() => setAt(f)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-[var(--color-muted)]">
                  <Folder size={16} className="shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-[var(--color-foreground)]">{f.name}</span>
                  <ChevronRight size={14} className="text-[var(--color-muted-foreground)]" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  )
}
