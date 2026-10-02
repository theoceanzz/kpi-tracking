import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Paperclip, Upload, X, ExternalLink, Eye, FileText, ImageIcon, Sheet, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getApiErrorMessage } from '@/lib/apiError'
import { ATTACHMENT_EXTENSIONS, ATTACHMENT_HINT, MAX_ATTACHMENT_FILES, formatBytes, screenEvidence } from '@/lib/attachmentPolicy'
import { canPreview } from '@/lib/filePreview'
import MediaPreviewModal from '@/components/common/MediaPreviewModal'
import { PickFromLibraryButton } from '@/features/documents/components/DocumentPickerDialog'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import type { Attachment } from '@/types/submission'
import { evidenceApi, type EvidenceTarget } from './evidenceApi'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'

function iconFor(a: Attachment) {
  const t = a.contentType || ''
  if (t.startsWith('image/')) return ImageIcon
  if (t.includes('sheet') || t.includes('excel') || t.includes('csv')) return Sheet
  return FileText
}

/**
 * Khối "Minh chứng đính kèm" dùng chung cho mọi lượt chấm (đợt, kỳ, hạnh kiểm): danh sách tệp,
 * nút tải lên, xoá tệp mình tải. Tệp gắn vào khoá đích nên đính kèm được NGAY cả khi lượt chấm
 * chưa lưu — xem `evidenceApi`.
 *
 * `readOnly`: chỉ xem (người được chấm xem minh chứng của người chấm, hoặc lượt đã khoá).
 */
export default function EvidenceAttachments({ target, readOnly = false, title = i18n.t('evidence:EvidenceAttachments.evidenceAttached'), compact = false, className }: {
  target: EvidenceTarget
  readOnly?: boolean
  title?: string
  /** Gọn: không viền ngoài, dùng khi đã nằm trong một khối khác. */
  compact?: boolean
  className?: string
}) {
  const { t } = useTranslation('evidence')
  const qc = useQueryClient()
  const key = ['evidence', target.targetType, target.targetKey]
  const { data: files = [], isLoading } = useQuery({ queryKey: key, queryFn: () => evidenceApi.list(target) })
  const inputRef = useRef<HTMLInputElement>(null)
  const [pendingDelete, setPendingDelete] = useState<Attachment | null>(null)
  const [previewing, setPreviewing] = useState<Attachment | null>(null)

  const upload = useMutation({
    mutationFn: (picked: File[]) => evidenceApi.upload(target, picked),
    onSuccess: added => {
      qc.setQueryData<Attachment[]>(key, prev => [...(prev ?? []), ...added])
      toast.success(added.length === 1 ? t('EvidenceAttachments.n1FileAttached') : t('EvidenceAttachments.filesAttached', { count: added.length }))
    },
    onError: err => toast.error(getApiErrorMessage(err, t('EvidenceAttachments.couldNotUploadTheFile'))),
  })
  const remove = useMutation({
    mutationFn: (id: string) => evidenceApi.remove(id),
    onSuccess: (_, id) => { qc.setQueryData<Attachment[]>(key, prev => (prev ?? []).filter(a => a.id !== id)); toast.success(t('EvidenceAttachments.fileDeleted')) },
    onError: err => toast.error(getApiErrorMessage(err, t('EvidenceAttachments.couldNotDeleteTheFile'))),
  })

  const onPick = (list: FileList | File[] | null) => {
    if (!list?.length) return
    // Cùng bộ lọc với bài nộp: loại, dung lượng, số tệp — báo trước, không để server từ chối.
    const screened = screenEvidence(Array.from(list), [])
    screened.rejected.forEach(r => toast.error(r.reason))
    const room = MAX_ATTACHMENT_FILES - files.length
    if (room <= 0) { toast.error(t('EvidenceAttachments.upToFilesPerScoring', { MAX_ATTACHMENT_FILES })); return }
    const accepted = screened.accepted.slice(0, room)
    if (accepted.length < screened.accepted.length) toast.warning(t('EvidenceAttachments.onlyMoreFilesCanBeAdded', { room, MAX_ATTACHMENT_FILES }))
    if (accepted.length) upload.mutate(accepted)
    if (inputRef.current) inputRef.current.value = ''
  }

  const canAdd = !readOnly && files.length < MAX_ATTACHMENT_FILES

  return (
    <div className={cn(!compact && 'rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-foreground)]">
            <Paperclip size={15} aria-hidden="true" className="text-[var(--color-muted-foreground)]" />
            {title}
            <span className="text-caption font-normal">{files.length}/{MAX_ATTACHMENT_FILES}</span>
          </h4>
          {!readOnly && <p className="mt-0.5 text-caption">{ATTACHMENT_HINT()}</p>}
        </div>
        {canAdd && (
          <>
            <input ref={inputRef} type="file" multiple className="hidden" onChange={e => onPick(e.target.files)} aria-label={t('EvidenceAttachments.chooseEvidenceFiles')} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
                {upload.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
                {t('EvidenceAttachments.attachFiles')}
              </Button>
              <PickFromLibraryButton accept={ATTACHMENT_EXTENSIONS} max={MAX_ATTACHMENT_FILES - files.length}
                                     disabled={upload.isPending} onPicked={picked => onPick(picked)} />
            </div>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="mt-3 h-9 animate-pulse rounded-control bg-[var(--color-muted)]" />
      ) : files.length === 0 ? (
        <p className="mt-2 text-caption">{readOnly ? t('EvidenceAttachments.noEvidenceAttached') : t('EvidenceAttachments.noFilesYetAttachImagesPdfs')}</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--color-border)] rounded-card border border-[var(--color-border)]">
          {files.map(a => {
            const Icon = iconFor(a)
            return (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2">
                <Icon size={16} aria-hidden="true" className="shrink-0 text-[var(--color-muted-foreground)]" />
                <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-foreground)] hover:text-[var(--color-primary)]" title={a.fileName}>
                  {a.fileName}
                </a>
                <span className="shrink-0 text-caption tabular-nums">{a.fileSize ? formatBytes(a.fileSize) : ''}</span>
                {canPreview(a.fileName, a.contentType) && (
                  <Button variant="ghost" size="icon-sm" type="button" onClick={() => setPreviewing(a)}
                          aria-label={t('EvidenceAttachments.preview', { fileName: a.fileName })} title={t('EvidenceAttachments.preview', { fileName: a.fileName })}>
                    <Eye aria-hidden="true" />
                  </Button>
                )}
                <Button asChild variant="ghost" size="icon-sm" aria-label={t('EvidenceAttachments.open', { fileName: a.fileName })}>
                  <a href={a.fileUrl} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" /></a>
                </Button>
                {!readOnly && (
                  <Button variant="ghost" size="icon-sm" type="button" className="text-[var(--color-muted-foreground)] hover:text-[var(--color-error)]" onClick={() => setPendingDelete(a)} aria-label={t('EvidenceAttachments.delete', { fileName: a.fileName })}>
                    <X aria-hidden="true" />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {previewing && (
        <MediaPreviewModal isOpen onClose={() => setPreviewing(null)} url={previewing.fileUrl}
                           fileName={previewing.fileName} contentType={previewing.contentType} />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) remove.mutate(pendingDelete.id); setPendingDelete(null) }}
        title={t('EvidenceAttachments.deleteEvidenceFile')}
        description={t('EvidenceAttachments.willBeRemovedFromThisScoring', { value: pendingDelete?.fileName ?? '' })}
        confirmLabel={t('EvidenceAttachments.deleteFile')}
        loading={remove.isPending}
      />
    </div>
  )
}
