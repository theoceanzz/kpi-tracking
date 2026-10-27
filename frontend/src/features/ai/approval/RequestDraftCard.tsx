import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { FileSignature } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRequestDraftStore } from '@/store/requestDraftStore'
import type { RequestDraft } from '@/features/ai/chat/api/aiApi'

/**
 * Thẻ "đơn K.AI đã điền sẵn" trong khung chat. Chỉ là bản NHÁP: bấm "Mở đơn để nộp" đưa sang hộp nộp đơn đã điền
 * sẵn, người dùng xem lại, bổ sung ô còn thiếu (tệp đính kèm…) rồi tự bấm Nộp.
 */
export default function RequestDraftCard({ draft, onNavigate }: { draft: RequestDraft; onNavigate?: () => void }) {
  const { t } = useTranslation('approvalForms')
  const navigate = useNavigate()
  const open = useRequestDraftStore(s => s.open)

  const go = () => {
    open(draft)
    onNavigate?.()
    navigate(`/requests?tab=submit&form=${draft.formId}`)
  }

  return (
    <div className="mt-2 rounded-card border border-[var(--color-ai-line)] bg-[var(--color-ai-soft)] p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-foreground)]">
        <FileSignature size={15} className="text-[var(--color-ai)]" aria-hidden="true" />
        {draft.formName}
        <span className="text-xs font-normal text-[var(--color-muted-foreground)]">· {t('aiDraft.badge')}</span>
      </p>
      <dl className="mt-2 space-y-1 text-xs">
        {draft.entries.map(e => (
          <div key={e.widgetId} className="flex gap-2">
            <dt className="w-32 shrink-0 truncate text-[var(--color-muted-foreground)]" title={e.label}>{e.label}</dt>
            <dd className="min-w-0 text-[var(--color-foreground)]">{e.display}</dd>
          </div>
        ))}
      </dl>
      {draft.missing.length > 0 && (
        <p className="mt-2 text-xs text-[var(--color-warning)]">{t('aiDraft.missing', { fields: draft.missing.join(', ') })}</p>
      )}
      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={go}>{t('aiDraft.open')}</Button>
      </div>
    </div>
  )
}
