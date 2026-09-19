import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Paperclip, Upload, X, ExternalLink, FileText, ImageIcon, Sheet, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getApiErrorMessage } from '@/lib/apiError'
import { ATTACHMENT_HINT, MAX_ATTACHMENT_FILES, formatBytes, screenEvidence } from '@/lib/attachmentPolicy'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import type { Attachment } from '@/types/submission'
import { evidenceApi, type EvidenceTarget } from './evidenceApi'

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
export default function EvidenceAttachments({ target, readOnly = false, title = 'Minh chứng đính kèm', compact = false, className }: {
  target: EvidenceTarget
  readOnly?: boolean
  title?: string
  /** Gọn: không viền ngoài, dùng khi đã nằm trong một khối khác. */
  compact?: boolean
  className?: string
}) {
  const qc = useQueryClient()
  const key = ['evidence', target.targetType, target.targetKey]
  const { data: files = [], isLoading } = useQuery({ queryKey: key, queryFn: () => evidenceApi.list(target) })
  const inputRef = useRef<HTMLInputElement>(null)
  const [pendingDelete, setPendingDelete] = useState<Attachment | null>(null)

  const upload = useMutation({
    mutationFn: (picked: File[]) => evidenceApi.upload(target, picked),
    onSuccess: added => {
      qc.setQueryData<Attachment[]>(key, prev => [...(prev ?? []), ...added])
      toast.success(added.length === 1 ? 'Đã đính kèm 1 tệp' : `Đã đính kèm ${added.length} tệp`)
    },
    onError: err => toast.error(getApiErrorMessage(err, 'Không tải được tệp lên')),
  })
  const remove = useMutation({
    mutationFn: (id: string) => evidenceApi.remove(id),
    onSuccess: (_, id) => { qc.setQueryData<Attachment[]>(key, prev => (prev ?? []).filter(a => a.id !== id)); toast.success('Đã xoá tệp') },
    onError: err => toast.error(getApiErrorMessage(err, 'Không xoá được tệp')),
  })

  const onPick = (list: FileList | null) => {
    if (!list?.length) return
    // Cùng bộ lọc với bài nộp: loại, dung lượng, số tệp — báo trước, không để server từ chối.
    const screened = screenEvidence(Array.from(list), [])
    screened.rejected.forEach(r => toast.error(r.reason))
    const room = MAX_ATTACHMENT_FILES - files.length
    if (room <= 0) { toast.error(`Tối đa ${MAX_ATTACHMENT_FILES} tệp cho một lượt chấm`); return }
    const accepted = screened.accepted.slice(0, room)
    if (accepted.length < screened.accepted.length) toast.warning(`Chỉ thêm được ${room} tệp nữa (tối đa ${MAX_ATTACHMENT_FILES})`)
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
          {!readOnly && <p className="mt-0.5 text-caption">{ATTACHMENT_HINT}</p>}
        </div>
        {canAdd && (
          <>
            <input ref={inputRef} type="file" multiple className="hidden" onChange={e => onPick(e.target.files)} aria-label="Chọn tệp minh chứng" />
            <Button variant="outline" size="sm" type="button" onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
              {upload.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
              Đính kèm tệp
            </Button>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="mt-3 h-9 animate-pulse rounded-control bg-[var(--color-muted)]" />
      ) : files.length === 0 ? (
        <p className="mt-2 text-caption">{readOnly ? 'Không có minh chứng đính kèm.' : 'Chưa có tệp nào. Đính kèm ảnh, PDF hoặc tài liệu làm bằng chứng cho lượt chấm này.'}</p>
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
                <Button asChild variant="ghost" size="icon-sm" aria-label={`Mở ${a.fileName}`}>
                  <a href={a.fileUrl} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" /></a>
                </Button>
                {!readOnly && (
                  <Button variant="ghost" size="icon-sm" type="button" className="text-[var(--color-muted-foreground)] hover:text-[var(--color-error)]" onClick={() => setPendingDelete(a)} aria-label={`Xoá ${a.fileName}`}>
                    <X aria-hidden="true" />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) remove.mutate(pendingDelete.id); setPendingDelete(null) }}
        title="Xoá tệp minh chứng?"
        description={`"${pendingDelete?.fileName ?? ''}" sẽ bị xoá khỏi lượt chấm này. Không hoàn tác được.`}
        confirmLabel="Xoá tệp"
        loading={remove.isPending}
      />
    </div>
  )
}
