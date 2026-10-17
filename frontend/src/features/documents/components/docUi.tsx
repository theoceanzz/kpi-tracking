import { Bot, FileCode2, FileSpreadsheet, FileText, FileType2, Folder, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { DocumentAiStatus, KbDocument } from '../types'

/** Icon loại tài liệu kiểu Lark: ô vuông màu đặc, hình trắng (tài liệu xanh dương, bảng tính xanh lá, PDF đỏ). */
export function FileTypeIcon({ doc, size = 18 }: { doc: Pick<KbDocument, 'fileName' | 'contentType'>; size?: number }) {
  const name = doc.fileName?.toLowerCase() ?? ''
  const pdf = doc.contentType === 'application/pdf' || name.endsWith('.pdf')
  const sheet = /\.(xlsx|xls|csv|kgsheet)$/.test(name)
  const text = /\.(txt|md)$/.test(name)
  const Icon = pdf ? FileType2 : sheet ? FileSpreadsheet : text ? FileCode2 : FileText
  const tone = pdf ? 'bg-[var(--color-error)]'
    : sheet ? 'bg-[var(--color-success)]'
      : text ? 'bg-[var(--color-muted-foreground)]'
        : 'bg-[var(--color-info)]'
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-md p-[3px] text-white', tone)} aria-hidden="true">
      <Icon size={size} strokeWidth={2} />
    </span>
  )
}

/** Thư mục kiểu Lark: hình thư mục vàng. */
export function FolderIcon({ size = 22 }: { size?: number }) {
  return <Folder size={size} className="shrink-0 fill-[var(--color-warning)] text-[var(--color-warning)]" aria-hidden="true" />
}

/** Trạng thái nạp vào kho tri thức. Lỗi thì lý do nằm trong tooltip (title) — backend đã dịch. */
export function AiStatusBadge({ status, error }: { status: DocumentAiStatus; error?: string | null }) {
  const { t } = useTranslation('documents')
  switch (status) {
    case 'READY':
      return <Badge variant="success">{t('aiStatus.READY')}</Badge>
    case 'PENDING':
    case 'INDEXING':
      return (
        <Badge variant="warning">
          <Loader2 size={12} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {t(`aiStatus.${status}`)}
        </Badge>
      )
    case 'FAILED':
      return <Badge variant="destructive" title={error ?? undefined}>{t('aiStatus.FAILED')}</Badge>
    case 'UNSUPPORTED':
      return <Badge variant="warning" title={error ?? undefined}>{t('aiStatus.UNSUPPORTED')}</Badge>
    default:
      return <Badge variant="secondary">{t('aiStatus.NONE')}</Badge>
  }
}

/**
 * Trạng thái K.AI gọn cho một ô bảng (Lark không có cột này — KeyGo cần biết tài liệu đã vào kho tri thức chưa): một icon
 * nhỏ đổi màu, chữ đầy đủ trong tooltip. Bật / tắt cho K.AI đọc nằm trong menu ⋯.
 */
export function AiStatusIcon({ doc }: { doc: Pick<KbDocument, 'aiEnabled' | 'aiStatus' | 'aiError'> }) {
  const { t } = useTranslation('documents')
  const status = doc.aiEnabled ? doc.aiStatus : 'NONE'
  const label = `${t('table.ai')}: ${doc.aiEnabled ? t(`aiStatus.${status}`) : t('ai.off')}${doc.aiError ? ` — ${doc.aiError}` : ''}`
  const tone = status === 'READY' ? 'text-[var(--color-success)]'
    : status === 'FAILED' ? 'text-[var(--color-error)]'
      : status === 'PENDING' || status === 'INDEXING' || status === 'UNSUPPORTED' ? 'text-[var(--color-warning)]'
        : 'text-[var(--color-border-strong,var(--color-muted-foreground))] opacity-50'
  return (
    <span className={cn('inline-flex items-center', tone)} title={label} aria-label={label} role="img">
      {status === 'PENDING' || status === 'INDEXING'
        ? <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        : <Bot size={15} aria-hidden="true" />}
    </span>
  )
}
