import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUpFromLine, Check, Eye, Inbox, Loader2, Send, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import DraftNotice from '@/components/common/DraftNotice'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import MediaPreviewModal from '@/components/common/MediaPreviewModal'
import { useStateDraft } from '@/hooks/useFormDraft'
import { formatDateTime } from '@/i18n/format'
import { canPreview } from '@/lib/filePreview'
import { promotionFileUrl } from '../api/documentApi'
import {
  useApprovePromotion, useCancelPromotion, useMyPromotions, usePromotionInbox, useRejectPromotion,
} from '../hooks/useDocuments'
import type { DocumentPromotion, PromotionStatus } from '../types'
import { formatBytes } from '../utils'
import { FileTypeIcon } from '../components/docUi'

const STATUS_VARIANT: Record<PromotionStatus, 'warning' | 'success' | 'destructive' | 'secondary'> = {
  PENDING: 'warning', APPROVED: 'success', REJECTED: 'destructive', CANCELLED: 'secondary',
}

/**
 * Đề xuất đưa tài liệu lên đơn vị / công ty (docs/DOCUMENTS_DESIGN.md §16.2): "Chờ tôi duyệt" (người quản lý tài
 * liệu ở nơi đích) và "Tôi đã gửi". Người duyệt xem tệp gốc qua link riêng của đề xuất — tài liệu cá nhân của người
 * khác vẫn không lộ qua danh sách thường.
 */
export default function PromotionsView({ onOpenDocument }: { onOpenDocument: (id: string) => void }) {
  const { t } = useTranslation('documents')
  const inbox = usePromotionInbox(true)
  const mine = useMyPromotions(true)
  const cancel = useCancelPromotion()
  const [preview, setPreview] = useState<DocumentPromotion | null>(null)
  const [deciding, setDeciding] = useState<{ p: DocumentPromotion; mode: 'approve' | 'reject' } | null>(null)

  const target = (p: DocumentPromotion) => p.targetScope === 'COMPANY' ? t('scope.COMPANY') : (p.targetUnitName ?? '—')

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <header className="border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-foreground)]">
            <Inbox size={15} aria-hidden="true" /> {t('promotion.inbox')}
          </h2>
          <p className="text-caption">{t('promotion.inboxIntro')}</p>
        </header>
        {inbox.isLoading ? (
          <div className="p-4"><LoadingSkeleton type="table" rows={3} /></div>
        ) : (inbox.data?.length ?? 0) === 0 ? (
          <EmptyState icon={Inbox} title={t('promotion.inboxEmptyTitle')} description={t('promotion.inboxEmptyDescription')} />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {inbox.data!.map(p => (
              <li key={p.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <FileTypeIcon doc={{ fileName: p.fileName, contentType: p.contentType }} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-medium text-[var(--color-foreground)]">{p.documentTitle ?? '—'}</p>
                  <p className="text-caption">
                    {t('promotion.requestLine', { name: p.requestedByName ?? '—', target: target(p), time: formatDateTime(p.createdAt) })}
                    {p.fileName ? ` · ${p.fileName} · ${formatBytes(p.fileSize)}` : ''}
                  </p>
                  {p.note && <p className="mt-1 whitespace-pre-line text-[var(--color-foreground)]">“{p.note}”</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {canPreview(p.fileName, p.contentType) && (
                    <Button variant="ghost" size="sm" onClick={() => setPreview(p)}><Eye aria-hidden="true" /> {t('actions.preview')}</Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setDeciding({ p, mode: 'reject' })}><X aria-hidden="true" /> {t('promotion.reject')}</Button>
                  <Button size="sm" onClick={() => setDeciding({ p, mode: 'approve' })}><Check aria-hidden="true" /> {t('promotion.approve')}</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <header className="border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-foreground)]">
            <Send size={15} aria-hidden="true" /> {t('promotion.mine')}
          </h2>
          <p className="text-caption">{t('promotion.mineIntro')}</p>
        </header>
        {mine.isLoading ? (
          <div className="p-4"><LoadingSkeleton type="table" rows={3} /></div>
        ) : (mine.data?.length ?? 0) === 0 ? (
          <EmptyState icon={ArrowUpFromLine} title={t('promotion.mineEmptyTitle')} description={t('promotion.mineEmptyDescription')} />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {mine.data!.map(p => (
              <li key={p.id} className="flex flex-wrap items-start gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-[var(--color-foreground)]">{p.documentTitle ?? '—'}</span>
                    <Badge variant={STATUS_VARIANT[p.status]}>{t(`promotion.status.${p.status}`)}</Badge>
                  </p>
                  <p className="text-caption">
                    {t('promotion.mineLine', { target: target(p), time: formatDateTime(p.createdAt) })}
                    {p.decidedByName && p.status !== 'CANCELLED' ? ` · ${t('promotion.decidedBy', { name: p.decidedByName, time: formatDateTime(p.decidedAt) })}` : ''}
                  </p>
                  {p.decisionNote && <p className="mt-1 text-[var(--color-foreground)]">{t('promotion.reason', { note: p.decisionNote })}</p>}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {p.resultDocumentId && (
                    <Button variant="outline" size="sm" onClick={() => onOpenDocument(p.resultDocumentId!)}>{t('promotion.openCopy')}</Button>
                  )}
                  {p.canCancel && (
                    <Button variant="ghost" size="sm" onClick={() => cancel.mutate(p.id)} disabled={cancel.isPending}>{t('promotion.cancel')}</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {preview && (
        <MediaPreviewModal isOpen onClose={() => setPreview(null)} url={promotionFileUrl(preview.id)}
                           fileName={preview.fileName ?? preview.documentTitle ?? ''} contentType={preview.contentType ?? undefined} />
      )}
      {deciding && <DecisionDialog key={deciding.p.id + deciding.mode} promotion={deciding.p} mode={deciding.mode} onClose={() => setDeciding(null)} />}
    </div>
  )
}

function DecisionDialog({ promotion: p, mode, onClose }: { promotion: DocumentPromotion; mode: 'approve' | 'reject'; onClose: () => void }) {
  const { t } = useTranslation('documents')
  const approve = useApprovePromotion()
  const reject = useRejectPromotion()
  const [form, setForm] = useState({ title: p.documentTitle ?? '', note: '' })
  const draft = useStateDraft(form, setForm, { key: `document-promotion:${p.id}:${mode}`, enabled: true })
  const pending = approve.isPending || reject.isPending
  const target = p.targetScope === 'COMPANY' ? t('scope.COMPANY') : (p.targetUnitName ?? '—')

  const submit = () => {
    if (mode === 'approve') approve.mutate({ id: p.id, title: form.title.trim() || undefined, note: form.note.trim() || undefined }, { onSuccess: onClose })
    else reject.mutate({ id: p.id, note: form.note.trim() || undefined }, { onSuccess: onClose })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      dismissible={!pending}
      title={mode === 'approve' ? t('promotion.approveTitle', { target }) : t('promotion.rejectTitle')}
      description={mode === 'approve' ? t('promotion.approveDescription') : t('promotion.rejectDescription', { name: p.requestedByName ?? '—' })}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={pending}>{t('common.cancel')}</Button>}
          primary={
            <Button variant={mode === 'reject' ? 'destructive' : 'default'} onClick={submit}
                    disabled={pending || (mode === 'approve' && !form.title.trim())}>
              {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {mode === 'approve' ? t('promotion.approve') : t('promotion.reject')}
            </Button>
          }
        />
      }
    >
      <DraftNotice draft={draft} className="mb-4" />
      <div className="space-y-4">
        {mode === 'approve' && (
          <div className="space-y-1.5">
            <label className="text-label" htmlFor="promotion-title">{t('promotion.copyTitle')}</label>
            <Input id="promotion-title" value={form.title} maxLength={255} invalid={!form.title.trim()}
                   onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
        )}
        <div className="space-y-1.5">
          <label className="text-label" htmlFor="promotion-note">{mode === 'approve' ? t('promotion.approveNote') : t('promotion.rejectReason')}</label>
          <Textarea id="promotion-note" rows={3} maxLength={2000} value={form.note}
                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
        </div>
      </div>
    </Dialog>
  )
}
