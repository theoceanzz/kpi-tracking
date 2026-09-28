import { intlDateLocale, intlLocale } from '@/i18n/format'
import DataTable from '@/components/common/DataTable'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useState } from 'react'
import { Ticket } from 'lucide-react'
import VoucherModal from './VoucherModal'
import { RedemptionStatus, type Redemption } from '../types'
import { useMyRedemptions } from '../hooks/useGifts'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

export const REDEMPTION_STATUS_STYLE = perLanguage((): Record<
  RedemptionStatus,
  { label: string; className: string }
> => ({
  [RedemptionStatus.PENDING]: { label: i18n.t('rewards:MyRedemptionsTable.toDeliver'), className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' },
  // Giữ lại cho các yêu cầu tạo từ trước khi bỏ bước duyệt — luồng mới không sinh
  // trạng thái này nữa.
  [RedemptionStatus.APPROVED]: {
    label: i18n.t('rewards:MyRedemptionsTable.toDeliver'),
    className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  },
  [RedemptionStatus.DELIVERED]: {
    label: i18n.t('rewards:MyRedemptionsTable.received'),
    className: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  },
  [RedemptionStatus.REJECTED]: { label: i18n.t('rewards:MyRedemptionsTable.rejected'), className: 'bg-[var(--color-error-bg)] text-[var(--color-error)]' },
  [RedemptionStatus.CANCELLED]: {
    label: i18n.t('rewards:MyRedemptionsTable.cancelled'),
    className: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
  },
  // Khác hẳn "Từ chối": không ai từ chối cả, nhà cung cấp không xuất được quà và điểm
  // đã tự hoàn. Gộp nhãn sẽ khiến nhân viên tưởng công ty chặn mình.
  [RedemptionStatus.FAILED]: {
    label: i18n.t('rewards:MyRedemptionsTable.giftCouldNotBeIssued'),
    className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  },
}))

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(intlDateLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' })

interface MyRedemptionsTableProps {
  data: Redemption[]
}

export default function MyRedemptionsTable({ data }: MyRedemptionsTableProps) {
  const { t } = useTranslation('rewards')
  const [cancelling, setCancelling] = useState<Redemption | null>(null)
  const [viewing, setViewing] = useState<Redemption | null>(null)
  const { cancelRedemption, isCancelling } = useMyRedemptions()

  return (
    <>
      <DataTable<Redemption>
        data={data}
        keyExtractor={(row) => row.id}
        emptyMessage={t('MyRedemptionsTable.youHaveNotRedeemedAnyGifts')}
        renderMobileCard={(row) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">
                {row.giftNameSnapshot}
                {row.quantity > 1 && ` ×${row.quantity}`}
              </span>
              <span
                className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${REDEMPTION_STATUS_STYLE()[row.status].className}`}
              >
                {REDEMPTION_STATUS_STYLE()[row.status].label}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-muted-foreground)]">{fmtDate(row.createdAt)}</span>
              <span className="font-semibold">−{row.pointsSpent.toLocaleString(intlLocale())} {t('MyRedemptionsTable.points')}</span>
            </div>
            {!!row.vouchers?.length && (
              <Button className="w-full" onClick={() => setViewing(row)}>
                <Ticket aria-hidden="true" />
                {t('MyRedemptionsTable.viewGiftCode')}
              </Button>
            )}
            {row.status === RedemptionStatus.PENDING && (
              <Button variant="outline" className="w-full" onClick={() => setCancelling(row)}>
                {t('MyRedemptionsTable.cancelRequest')}
              </Button>
            )}
          </div>
        )}
        columns={[
          {
            key: 'createdAt',
            className: 'align-top',
            header: t('MyRedemptionsTable.redeemedOn'),
            render: (row) => (
              <span className="whitespace-nowrap text-[var(--color-muted-foreground)]">
                {fmtDate(row.createdAt)}
              </span>
            ),
          },
          {
            key: 'gift',
            className: 'align-top',
            header: t('MyRedemptionsTable.gift'),
            render: (row) => (
              <div className="flex items-center gap-2.5">
                {row.giftImageUrl && (
                  <img
                    src={row.giftImageUrl}
                    alt=""
                    className="h-9 w-9 flex-shrink-0 rounded-control object-cover"
                  />
                )}
                <div>
                  <div className="font-medium">{row.giftNameSnapshot}</div>
                  {row.quantity > 1 && (
                    <div className="text-xs text-[var(--color-muted-foreground)]">
                      {t('MyRedemptionsTable.quantity')} {row.quantity}
                    </div>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: 'note',
            className: 'align-top',
            header: t('MyRedemptionsTable.notes'),
            render: (row) => (
              <div>
                <span className="text-[var(--color-muted-foreground)]">{row.note || '—'}</span>
                {/* Yêu cầu treo hoặc hỏng mà không nói lý do sẽ biến thành một cuộc gọi
                    cho bộ phận hỗ trợ. */}
                {row.fulfillmentError && (
                  <div className="mt-0.5 text-xs text-[var(--color-warning)]">{row.fulfillmentError}</div>
                )}
              </div>
            ),
          },
          {
            key: 'pointsSpent',
            className: 'text-right align-top',
            header: t('MyRedemptionsTable.points2'),
            render: (row) => (
              <span className="font-semibold">−{row.pointsSpent.toLocaleString(intlLocale())}</span>
            ),
          },
          {
            key: 'status',
            className: 'align-top',
            header: t('MyRedemptionsTable.status'),
            render: (row) => (
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${REDEMPTION_STATUS_STYLE()[row.status].className}`}
              >
                {REDEMPTION_STATUS_STYLE()[row.status].label}
              </span>
            ),
          },
          {
            key: 'actions',
            className: 'text-right align-top',
            header: '',
            render: (row) => (
              <div className="flex justify-end gap-1.5">
                {!!row.vouchers?.length && (
                  <Button variant="ghost" size="sm" className="whitespace-nowrap" onClick={() => setViewing(row)}>
                    <Ticket aria-hidden="true" />
                    {t('MyRedemptionsTable.viewCode')}
                  </Button>
                )}
                {row.status === RedemptionStatus.PENDING && (
                  <Button variant="outline" size="sm" onClick={() => setCancelling(row)}>
                    {t('MyRedemptionsTable.cancel')}
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />

      <VoucherModal redemption={viewing} onClose={() => setViewing(null)} />

      <ConfirmDialog
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={async () => {
          if (cancelling) await cancelRedemption(cancelling.id)
          setCancelling(null)
        }}
        title={t('MyRedemptionsTable.cancelTheGiftRedemptionRequest')}
        description={
          cancelling
            ? t('MyRedemptionsTable.pointsWillBeRefundedToYour', { value: cancelling.pointsSpent.toLocaleString(intlLocale()) })
            : ''
        }
        confirmLabel={t('MyRedemptionsTable.cancelRequest')}
        loading={isCancelling}
      />
    </>
  )
}
