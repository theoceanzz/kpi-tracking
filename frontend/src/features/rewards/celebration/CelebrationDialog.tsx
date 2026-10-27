import { Award, Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { useApiAllowed } from '@/hooks/useApiAllowed'
import { useFormat } from '@/i18n/useFormat'
import { useCertificateCatalog } from '../hooks/useCertificates'
import type { RewardGrant } from '../types'
import { PreviewFrame } from '../components/certificate/CertificateModal'
import { certificateDataFor, designForKey, preferredTemplateKey } from '../components/certificate/certificateData'
import type { CelebrationShow } from './celebrationPlan'
import { useCountUp } from './useCountUp'
import { isGentleMode } from './celebrationSettings'

interface Props {
  show: CelebrationShow
  onClose: () => void
  /** Mở màn xem / tải giấy khen (đóng hộp chúc mừng trước). */
  onOpenCertificate: (grant: RewardGrant) => void
}

/** Giấy khen thu nhỏ trượt vào trong hộp chúc mừng — cùng mẫu với màn in (`preferredTemplateKey`). */
function CertificatePeek({ grant }: { grant: RewardGrant }) {
  const allowed = useApiAllowed('GET', '/reward-certificate-templates')
  const { data: catalog, isPending } = useCertificateCatalog(allowed)
  const userId = useAuthStore((s) => s.user?.id)
  if (!allowed || isPending) return <div className="h-40 animate-pulse rounded-card bg-[var(--color-muted)]" />

  // Người nhận là chính mình. Không thấy mình trong danh sách (dữ liệu thiếu) thì lấy người đầu
  // tiên để vẫn có hình — nút "Xem / Tải" vẫn khoá đúng người qua `lockedRecipientId`.
  const recipient = grant.recipients.find((r) => r.userId === userId) ?? grant.recipients[0]
  if (!recipient) return null
  const design = designForKey(preferredTemplateKey(grant, catalog), catalog)
  return (
    <div className="celebration-cert pointer-events-none">
      <PreviewFrame design={design} data={certificateDataFor(grant, recipient, catalog)} />
    </div>
  )
}

/**
 * Hộp chúc mừng cấp "lớn" (được thưởng điểm) và "lớn nhất" (kèm giấy khen).
 *
 * Nút chính là "Tuyệt vời!" chứ không phải "Nhận": điểm ĐÃ vào ví trước khi hộp hiện, không có gì
 * để bấm nhận cả. Nhiều lượt thưởng về cùng lúc thì gộp một hộp (tổng điểm + danh sách), và mọi
 * giấy khen trong nhóm vẫn có nút xem riêng.
 *
 * Người thưởng cũng có thể là chính người nhận (tự đứng tên trong danh sách nhận): vẫn ăn mừng và
 * hiện tên người thưởng y như mọi người nhận khác — cố ý KHÔNG có nhánh riêng, để một lượt thưởng
 * luôn được thể hiện giống nhau với mọi người nhận.
 */
export default function CelebrationDialog({ show, onClose, onOpenCertificate }: Props) {
  const { t } = useTranslation('rewards')
  const fmt = useFormat()
  const points = useCountUp(show.totalPoints, 1400, !isGentleMode())

  const single = show.events.length === 1 ? show.events[0]! : null
  const firstCertificate = show.certificates[0]?.certificate ?? null

  const title = single ? t('Celebration.congratulations') : t('Celebration.youReceivedRewards', { count: show.events.length })

  return (
    <Dialog
      open
      onClose={onClose}
      size={firstCertificate ? 'lg' : 'md'}
      title={title}
      footer={
        <DialogFooter
          secondary={
            show.certificates.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {show.certificates.map((c, i) => (
                  <Button key={c.refId ?? i} variant="outline" onClick={() => onOpenCertificate(c.certificate!)}>
                    <Award aria-hidden="true" />
                    {show.certificates.length > 1
                      ? t('Celebration.viewCertificateNumbered', { index: i + 1 })
                      : t('Celebration.viewCertificate')}
                  </Button>
                ))}
              </div>
            ) : undefined
          }
          primary={<Button onClick={onClose}>{t('Celebration.awesome')}</Button>}
        />
      }
    >
      <div className="flex flex-col items-center text-center">
        <div className="celebration-badge flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning)]">
          {firstCertificate ? <Award size={32} aria-hidden="true" /> : <Trophy size={32} aria-hidden="true" />}
        </div>

        <p className="celebration-rise mt-4 text-sm text-[var(--color-muted-foreground)]">
          {single ? t('Celebration.youHaveBeenRewarded') : t('Celebration.totalPoints')}
        </p>
        <p className="celebration-rise mt-1 text-5xl font-bold tracking-tight tabular-nums text-[var(--color-warning)]" aria-live="polite">
          +{fmt.number(points)}
          <span className="ml-2 text-lg font-semibold text-[var(--color-muted-foreground)]">{t('Celebration.pointsUnit')}</span>
        </p>

        {single ? (
          <div className="celebration-rise mt-4 space-y-1" style={{ animationDelay: '150ms' }}>
            {single.grantorName && (
              <p className="text-sm">
                {t('Celebration.from')} <b>{single.grantorName}</b>
              </p>
            )}
            {single.reason && (
              <p className="text-sm italic text-[var(--color-muted-foreground)]">“{single.reason}”</p>
            )}
          </div>
        ) : (
          <ul className="celebration-rise mt-4 w-full divide-y divide-[var(--color-border)] rounded-card border border-[var(--color-border)] text-left text-sm" style={{ animationDelay: '150ms' }}>
            {show.events.map((e, i) => (
              <li key={e.refId ?? i} className="flex items-start justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.reason || t('Celebration.reward')}</p>
                  {e.grantorName && (
                    <p className="truncate text-xs text-[var(--color-muted-foreground)]">
                      {t('Celebration.from')} {e.grantorName}
                      {e.certificate ? ` · ${t('Celebration.withCertificate')}` : ''}
                    </p>
                  )}
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-[var(--color-warning)]">+{fmt.number(e.points)}</span>
              </li>
            ))}
          </ul>
        )}

        {firstCertificate && (
          <div className="mt-5 w-full">
            <CertificatePeek grant={firstCertificate} />
          </div>
        )}
      </div>
    </Dialog>
  )
}
