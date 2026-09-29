import { History } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useFormat } from '@/i18n/useFormat'
import type { FormDraftHandle } from '@/hooks/useFormDraft'
import { cn } from '@/lib/utils'

/**
 * Dòng báo "đã khôi phục dữ liệu nhập dở" đặt ở đầu thân modal có `useFormDraft`. Không có nháp thì
 * không hiện gì.
 */
export default function DraftNotice({ draft, className }: { draft: FormDraftHandle; className?: string }) {
  const { t } = useTranslation('common')
  const { dateTime } = useFormat()
  if (draft.restoredAt == null) return null
  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-3 py-2 text-sm',
        className,
      )}
    >
      <History size={15} className="shrink-0 text-[var(--color-info)]" aria-hidden="true" />
      <span className="min-w-0 flex-1">{t('formDraft.restored', { time: dateTime(draft.restoredAt) })}</span>
      <Button type="button" variant="ghost" size="sm" onClick={draft.discard}>
        {t('formDraft.discard')}
      </Button>
    </div>
  )
}
