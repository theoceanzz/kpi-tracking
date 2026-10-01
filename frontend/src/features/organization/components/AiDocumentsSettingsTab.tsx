import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { SearchBox } from '@/features/analytics/components/rag/RagDocumentsPanel'
import { documentApi } from '@/features/documents/api/documentApi'

/**
 * Tài liệu của trợ lý AI đã chuyển sang trang Tài liệu (docs/DOCUMENTS_DESIGN.md §8.1): ở đó có tệp gốc, ba phạm vi
 * và phân quyền. Mục này giữ lại làm lối tắt cho người quen đường cũ, cộng ô "thử tìm" — nay chạy với quyền của
 * CHÍNH người thử, nên thấy đúng những gì K.AI sẽ đưa cho họ.
 */
export default function AiDocumentsSettingsTab() {
  const { t } = useTranslation('documents')
  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4 sm:flex-row sm:items-center">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-[var(--color-primary-soft)] text-[var(--color-primary)]" aria-hidden="true">
          <BookOpen size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[var(--color-foreground)]">{t('settingsCard.title')}</h2>
          <p className="text-caption">{t('settingsCard.description')}</p>
        </div>
        <Button asChild>
          <Link to="/documents?tab=company">{t('settingsCard.open')} <ArrowRight aria-hidden="true" /></Link>
        </Button>
      </section>
      <SearchBox scope="documents" search={documentApi.search} placeholder={t('settingsCard.searchPlaceholder')} />
    </div>
  )
}
