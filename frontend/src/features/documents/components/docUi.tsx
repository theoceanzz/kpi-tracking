import { FileCode2, FileSpreadsheet, FileText, FileType2, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import type { DocumentAiStatus, KbDocument } from '../types'

export function FileTypeIcon({ doc, size = 18 }: { doc: Pick<KbDocument, 'fileName' | 'contentType'>; size?: number }) {
  const name = doc.fileName?.toLowerCase() ?? ''
  const pdf = doc.contentType === 'application/pdf' || name.endsWith('.pdf')
  const sheet = /\.(xlsx|xls|csv|kgsheet)$/.test(name)
  const text = /\.(txt|md)$/.test(name)
  const Icon = pdf ? FileType2 : sheet ? FileSpreadsheet : text ? FileCode2 : FileText
  const tone = pdf
    ? 'bg-[var(--color-error-bg)] text-[var(--color-error)]'
    : sheet
      ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
      : text
        ? 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
        : 'bg-[var(--color-info-bg)] text-[var(--color-info)]'
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-control p-1.5 ${tone}`} aria-hidden="true">
      <Icon size={size} />
    </span>
  )
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
