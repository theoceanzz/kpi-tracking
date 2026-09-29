import { useState } from 'react'
import { Download, ExternalLink, FileText, Image as ImageIcon, Loader2, Paperclip, Sheet, FileType2 } from 'lucide-react'
import { cn, downloadFile } from '@/lib/utils'
import { formatBytes } from '@/lib/attachmentPolicy'
import type { Attachment } from '@/types/submission'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'

function iconFor(a: Attachment) {
  const t = (a.contentType || '').toLowerCase()
  const n = (a.fileName || '').toLowerCase()
  if (t.startsWith('image/')) return ImageIcon
  if (t.includes('sheet') || t.includes('excel') || t.includes('csv') || /\.(xlsx?|csv)$/.test(n)) return Sheet
  if (t.includes('pdf') || n.endsWith('.pdf')) return FileType2
  return FileText
}

/** Đuôi tệp viết hoa để làm nhãn loại ("PDF", "XLSX") — tên Cloudinary băm không nói được gì. */
function extOf(a: Attachment): string {
  const m = /\.([a-z0-9]{2,5})$/i.exec(a.fileName || '')
  if (m) return m[1]!.toUpperCase()
  const t = (a.contentType || '').split('/')[1]
  return t ? t.toUpperCase().slice(0, 5) : i18n.t('evidence:AttachmentChips.files')
}

/**
 * Tệp đính kèm của một bài nộp, dạng GỌN: một chip "📎 3 tệp" mở ra danh sách có tên đầy đủ,
 * loại, dung lượng và nút Tải / Mở cho từng tệp.
 *
 * Trước đây mỗi tệp là một chip nhỏ ghi tên băm "17897868426…" cắt cụt — năm chip xếp hai hàng
 * trong một ô bảng, không đọc được tên và không có gì nói "bấm vào là tải". Gom lại thì ô bảng
 * chỉ tốn một chip, mở ra mới thấy chi tiết, và tải là một nút có chữ "Tải".
 */
export default function AttachmentChips({ files, className }: { files?: Attachment[] | null; className?: string }) {
  const { t } = useTranslation('evidence')
  const [busyId, setBusyId] = useState<string | null>(null)
  if (!files?.length) return null

  const save = async (a: Attachment) => {
    setBusyId(a.id)
    try { await downloadFile(a.fileUrl, a.fileName) } finally { setBusyId(null) }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            // Nền primary đặc: chip này là lối vào duy nhất tới minh chứng, phải bắt mắt hơn
            // chữ xám "Trọng số 10%" đứng cạnh — viền mỏng cùng màu nền thẻ thì lẫn vào bảng.
            'inline-flex items-center gap-1 rounded-control bg-[var(--color-primary)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary-foreground)] shadow-sm transition-opacity hover:opacity-90',
            className,
          )}
          title={t('AttachmentChips.viewAndDownloadAttachments')}
        >
          <Paperclip size={11} aria-hidden="true" /> {files.length} {t('AttachmentChips.files2')} <Download size={11} aria-hidden="true" className="opacity-80" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,380px)] p-0">
        <p className="text-eyebrow border-b border-[var(--color-border)] px-3 py-2">{t('AttachmentChips.evidenceAttached')} {files.length}</p>
        <ul className="custom-scrollbar max-h-72 divide-y divide-[var(--color-border)] overflow-y-auto">
          {files.map(a => {
            const Icon = iconFor(a)
            const isImage = (a.contentType || '').startsWith('image/')
            return (
              <li key={a.id} className="flex items-center gap-2.5 px-3 py-2">
                {/* Ảnh thì hiện thumbnail — nhìn là biết tệp gì, khỏi mở. */}
                {isImage ? (
                  <img src={a.fileUrl} alt="" className="h-9 w-9 shrink-0 rounded-control object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--color-foreground)]" title={a.fileName}>{a.fileName}</span>
                  <span className="text-caption block">{extOf(a)}{a.fileSize ? ` · ${formatBytes(a.fileSize)}` : ''}</span>
                </span>
                <Button variant="outline" size="sm" type="button" onClick={() => save(a)} disabled={busyId === a.id} aria-label={t('AttachmentChips.download', { fileName: a.fileName })}>
                  {busyId === a.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />} {t('AttachmentChips.download2')}
                </Button>
                <Button asChild variant="ghost" size="icon-sm" aria-label={t('AttachmentChips.openInANewTab', { fileName: a.fileName })} title={t('AttachmentChips.openInANewTab2')}>
                  <a href={a.fileUrl} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" /></a>
                </Button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
