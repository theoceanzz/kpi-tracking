import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Ban, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { useFormat } from '@/i18n/useFormat'
import { useDocumentPublicLinks, useRevokePublicLink } from '../hooks/useDocuments'
import type { DocumentPublicLink, KbDocument } from '../types'
import { useOptionalDocumentActions } from './DocumentActions'

/**
 * "Gửi qua email" trong tab Chia sẻ: nút soạn thư + các lần đã gửi (ai nhận, hạn link, đã mở mấy lần). Thu hồi một lần
 * gửi = link trong thư đó chết ngay; chia sẻ trong tổ chức (phía dưới) không bị ảnh hưởng.
 */
export default function PublicLinksSection({ doc, onEmail }: { doc: KbDocument; onEmail?: () => void }) {
  const { t } = useTranslation('documents')
  const { dateTime } = useFormat()
  const actions = useOptionalDocumentActions()
  const links = useDocumentPublicLinks(doc.id, true)
  const revoke = useRevokePublicLink()
  const [revoking, setRevoking] = useState<DocumentPublicLink | null>(null)

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--color-foreground)]">{t('email.sectionTitle')}</h3>
          <p className="text-caption">{t('email.sectionHint')}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => (onEmail ? onEmail() : actions?.email(doc))}>
          <Mail aria-hidden="true" /> {t('email.compose')}
        </Button>
      </div>
      {links.isLoading ? (
        <LoadingSkeleton type="table" rows={1} />
      ) : (links.data?.length ?? 0) > 0 && (
        <ul className="divide-y divide-[var(--color-border)] rounded-card border border-[var(--color-border)]">
          {links.data!.map(l => (
            <li key={l.id} className="flex items-start gap-3 px-3 py-2 text-sm">
              <Mail size={16} className="mt-0.5 shrink-0 text-[var(--color-muted-foreground)]" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-[var(--color-foreground)]" title={l.recipients.join(', ')}>
                  {l.recipients.join(', ')}
                </span>
                <span className="block truncate text-caption">
                  {t('email.sentLine', { name: l.senderName, time: dateTime(l.createdAt) })}
                  {' · '}
                  {l.viewCount > 0 ? t('email.views', { count: l.viewCount }) : t('email.notOpened')}
                </span>
                <span className="block truncate text-caption">
                  {l.revokedAt ? t('email.revokedAt', { time: dateTime(l.revokedAt) })
                    : l.active ? t('email.expiresAt', { time: dateTime(l.expiresAt) })
                      : t('email.expiredAt', { time: dateTime(l.expiresAt) })}
                </span>
              </span>
              {l.active ? (
                <Button size="sm" variant="ghost" className="shrink-0 text-[var(--color-error)]"
                        onClick={() => setRevoking(l)} disabled={revoke.isPending}>
                  <Ban aria-hidden="true" /> {t('email.revoke')}
                </Button>
              ) : (
                <Badge variant="secondary" className="shrink-0">{l.revokedAt ? t('email.revoked') : t('email.expired')}</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        onConfirm={() => revoking && revoke.mutate({ id: doc.id, linkId: revoking.id }, { onSuccess: () => setRevoking(null) })}
        title={t('email.revokeTitle')}
        description={t('email.revokeDescription', { recipients: revoking?.recipients.join(', ') ?? '' })}
        confirmLabel={t('email.revoke')}
        loading={revoke.isPending}
      />
    </section>
  )
}
