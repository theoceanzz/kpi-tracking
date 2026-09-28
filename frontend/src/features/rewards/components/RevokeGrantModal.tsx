import { intlLocale } from '@/i18n/format'
import { useQuery } from '@tanstack/react-query'
import { Loader2, AlertTriangle } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { rewardApi } from '../api/rewardApi'
import { useRewardGrants } from '../hooks/useRewards'
import type { RewardGrant } from '../types'
import { useTranslation } from 'react-i18next'

interface RevokeGrantModalProps {
  /** null = đóng. */
  grant: RewardGrant | null
  onClose: () => void
}

/**
 * Xác nhận thu hồi, kèm hậu quả CỤ THỂ của từng người nhận.
 *
 * <p>Không dùng ConfirmDialog chung: thu hồi ghi thẳng vào sổ cái, không hoàn tác được,
 * và có thể đẩy số dư nhân viên xuống âm. Một câu cảnh báo chung chung buộc người quản
 * trị phải đoán xem ai bị ảnh hưởng — trong khi hệ thống biết chính xác.
 */
export default function RevokeGrantModal({ grant, onClose }: RevokeGrantModalProps) {
  const { t } = useTranslation('rewards')
  const { revokeGrant, isRevoking } = useRewardGrants({ size: 1 })

  const { data: preview, isLoading } = useQuery({
    queryKey: ['revokePreview', grant?.id],
    queryFn: () => rewardApi.previewRevoke(grant!.id),
    enabled: !!grant,
  })

  if (!grant) return null

  const handleConfirm = async () => {
    // force = true là sự đồng ý CÓ HIỂU BIẾT: người dùng vừa nhìn thấy danh sách ai âm
    // bao nhiêu. Không phải cờ bỏ qua kiểm tra.
    await revokeGrant({ id: grant.id, data: { force: true } })
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      dismissible={!isRevoking}
      title={t('RevokeGrantModal.revokeRewardPoints')}
      footer={
        <DialogFooter
          note={t('RevokeGrantModal.recordsAnOffsettingTransactionInThe')}
          secondary={<Button variant="outline" onClick={onClose} disabled={isRevoking}>{t('RevokeGrantModal.cancel')}</Button>}
          primary={
            <Button variant="destructive" onClick={handleConfirm} disabled={isLoading || isRevoking}>
              {isRevoking && <Loader2 className="animate-spin" aria-hidden="true" />}
              {t('RevokeGrantModal.confirmRevoke')}
            </Button>
          }
        />
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-foreground)]">
          {t('RevokeGrantModal.revoke')} <b className="font-semibold tabular-nums">{grant.totalPoints.toLocaleString(intlLocale())} {t('RevokeGrantModal.points')}</b> {t('RevokeGrantModal.rewardedTo')}{' '}
          <b className="font-semibold">{t('RevokeGrantModal.employeeCount', { count: grant.recipients.length })}</b> {t('RevokeGrantModal.withTheReason')}{grant.reason}”.
        </p>

        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-[var(--color-muted-foreground)]">
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            {t('RevokeGrantModal.calculatingTheImpact')}
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-card border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-muted)]">
                    <th className="px-3 py-2 text-left text-eyebrow">{t('RevokeGrantModal.employee')}</th>
                    <th className="px-3 py-2 text-right text-eyebrow">{t('RevokeGrantModal.deduct')}</th>
                    <th className="px-3 py-2 text-right text-eyebrow">{t('RevokeGrantModal.balanceAfter')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {preview?.items.map((it) => (
                    <tr key={it.userId}>
                      <td className="px-3 py-2">{it.fullName}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--color-error)]">
                        −{it.points.toLocaleString(intlLocale())}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-medium tabular-nums ${it.goesNegative ? 'text-[var(--color-error)]' : ''}`}
                      >
                        {it.balanceAfter.toLocaleString(intlLocale())}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview?.anyGoesNegative ? (
              <div className="flex items-start gap-2 rounded-card border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-4 py-3 text-sm">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-error)]" aria-hidden="true" />
                <span>
                  {t('RevokeGrantModal.someEmployees')} <b>{t('RevokeGrantModal.haveSpentThesePoints')}</b> {t('RevokeGrantModal.soTheirBalanceWillGoNegative')}
                </span>
              </div>
            ) : (
              <div className="rounded-card bg-[var(--color-muted)] px-4 py-3 text-sm text-[var(--color-muted-foreground)]">
                {t('RevokeGrantModal.allEmployeesStillHaveEnoughPoints')}
              </div>
            )}

            <p className="text-caption">
              {t('RevokeGrantModal.toGiveThePointsBackYou')}
            </p>
          </>
        )}
      </div>
    </Dialog>
  )
}
