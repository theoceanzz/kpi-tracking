import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FileText } from 'lucide-react'
import type { DocumentSource } from '@/features/analytics/api/aiApi'

/** Tab của trang Tài liệu chứa tài liệu thuộc phạm vi này. */
const TAB_OF: Record<string, string> = { PERSONAL: 'mine', UNIT: 'unit', COMPANY: 'company' }

/**
 * Chip nguồn dưới câu trả lời của K.AI: tài liệu nào đã được đọc để trả lời (docs/DOCUMENTS_DESIGN.md §8.5).
 * Bấm mở thẳng tài liệu ở trang Tài liệu — vẫn qua kiểm quyền, nên quyền bị thu sau đó thì chỉ báo không tìm thấy.
 */
export default function SourceChips({ sources, onNavigate }: { sources: DocumentSource[]; onNavigate?: () => void }) {
  const { t } = useTranslation('documents')
  if (!sources.length) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label={t('sources.label')}>
      <span className="text-caption">{t('sources.label')}</span>
      {sources.map(s => (
        <Link
          key={s.docId}
          to={`/documents?tab=${TAB_OF[s.scope] ?? 'company'}&doc=${encodeURIComponent(s.docId)}${s.legacy ? '&legacy=1' : ''}`}
          onClick={onNavigate}
          title={s.section ? `${s.title} — ${s.section}` : s.title}
          className="inline-flex max-w-[260px] items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1 text-xs font-medium text-[var(--color-foreground)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
        >
          <FileText size={12} className="shrink-0" aria-hidden="true" />
          <span className="truncate">{s.title}</span>
          <span className="shrink-0 font-normal text-[var(--color-muted-foreground)]">
            · {s.scope === 'PERSONAL' ? t('sources.yours') : t(`scope.${s.scope}`)}
          </span>
        </Link>
      ))}
    </div>
  )
}
