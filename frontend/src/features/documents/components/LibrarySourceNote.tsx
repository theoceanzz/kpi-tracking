import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ExternalLink, Library } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  source: { fromLibrary?: boolean; sourceDocumentTitle?: string | null; sourceDocumentId?: string | null }
  className?: string
}

/**
 * Nhãn nhỏ dưới tệp đính kèm sao từ thư viện: "Từ thư viện: [tên]" + link "Mở bản mới nhất". Máy chủ chỉ trả
 * `sourceDocumentId` khi tài liệu gốc còn và người xem mở được nó (luật phần Tài liệu) — không có thì chỉ còn nhãn.
 * Link mở tab mới để không mất bình luận / công việc đang xem.
 */
export default function LibrarySourceNote({ source, className }: Props) {
  const { t } = useTranslation('documents')
  if (!source.fromLibrary) return null
  const title = source.sourceDocumentTitle
  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-x-2 text-[11px] text-[var(--color-subtle-foreground)]', className)}>
      <span className="inline-flex min-w-0 items-center gap-1" title={title ?? undefined}>
        <Library size={11} className="shrink-0" />
        <span className="truncate">{title ? t('picker.fromLibrary', { title }) : t('picker.fromLibraryUntitled')}</span>
      </span>
      {source.sourceDocumentId && (
        <Link to={`/documents?doc=${source.sourceDocumentId}`} target="_blank" rel="noopener"
          className="inline-flex shrink-0 items-center gap-0.5 font-medium text-[var(--color-primary)] hover:underline">
          {t('picker.openLatest')} <ExternalLink size={10} />
        </Link>
      )}
    </div>
  )
}
