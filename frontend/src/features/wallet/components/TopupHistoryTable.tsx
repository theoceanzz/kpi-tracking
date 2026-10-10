import { useState } from 'react'
import { QrCode, Receipt } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { TopupOrderStatus, type TopupOrder } from '../types'
import ReceiptModal from './ReceiptModal'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'
import { tourAnchor } from '@/components/common/tours/anchors'

const STATUS_META = perLanguage((): Record<TopupOrderStatus, { label: string; cls: string }> => ({
  [TopupOrderStatus.PENDING]: {
    label: i18n.t('wallet:TopupHistoryTable.waitingForTransfer'),
    cls: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)] dark:text-[var(--color-warning)]',
  },
  [TopupOrderStatus.PAID]: {
    label: i18n.t('wallet:TopupHistoryTable.moneyReceived'),
    cls: 'bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)] dark:text-[var(--color-success)]',
  },
  [TopupOrderStatus.EXPIRED]: {
    label: i18n.t('wallet:TopupHistoryTable.expired'),
    cls: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
  },
  [TopupOrderStatus.CANCELLED]: {
    label: i18n.t('wallet:TopupHistoryTable.cancelled'),
    cls: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
  },
}))

interface TopupHistoryTableProps {
  data: TopupOrder[]
  /**
   * Mở lại một đơn còn chờ để chuyển khoản tiếp. Không có đường này thì đơn lỡ dở là ngõ
   * cụt: mã QR đã đóng mất, mà tạo đơn mới thì đụng trần 5 đơn treo của backend.
   */
  onResume?: (order: TopupOrder) => void
}

export default function TopupHistoryTable({ data, onResume }: TopupHistoryTableProps) {
  const { t } = useTranslation('wallet')
  const [receiptOrderId, setReceiptOrderId] = useState<string | null>(null)

  return (
    <div className="overflow-x-auto rounded-card border border-[var(--color-border)]">
      <table className="w-full min-w-[680px] text-sm">
        <thead className="bg-[var(--color-muted)]/50 text-left">
          <tr className="text-eyebrow">
            <th className="px-4 py-3">{t('TopupHistoryTable.time')}</th>
            <th className="px-4 py-3">{t('TopupHistoryTable.orderCode')}</th>
            <th className="px-4 py-3 text-right">{t('TopupHistoryTable.requested')}</th>
            <th className="px-4 py-3 text-right">{t('TopupHistoryTable.actuallyReceived')}</th>
            <th {...tourAnchor('topups.status')} className="px-4 py-3">{t('TopupHistoryTable.status')}</th>
            <th className="px-4 py-3 text-right">{t('TopupHistoryTable.actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {data.map((o) => {
            const meta = STATUS_META()[o.status]
            const mismatch = o.paidAmount != null && o.paidAmount !== o.amount
            return (
              <tr key={o.id} className="hover:bg-[var(--color-muted)]/30">
                <td className="whitespace-nowrap px-4 py-3 text-[var(--color-muted-foreground)]">
                  {formatDateTime(o.createdAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold">{o.code}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {formatCurrency(o.amount)}
                </td>
                <td
                  className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${
                    mismatch ? 'text-[var(--color-warning)]' : ''
                  }`}
                >
                  {o.paidAmount != null ? formatCurrency(o.paidAmount) : '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${meta.cls}`}
                  >
                    {meta.label}
                  </span>
                  {/* Đơn đã huỷ hoặc hết hạn VẪN có thể nhận tiền về sau — webhook
                      cố ý ghi có cho chúng. Không được để người dùng tưởng là mất tiền. */}
                  {mismatch && (
                    <div className="mt-1 text-xs text-[var(--color-warning)]">{t('TopupHistoryTable.differsFromTheRequestedAmount')}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {/* Chỉ đơn ĐÃ NHẬN TIỀN mới có biên nhận: chứng từ này xác nhận đã thu tiền,
                      nên nó không tồn tại cho đơn chờ, đơn huỷ hay đơn hết hạn. */}
                  {o.status === TopupOrderStatus.PAID && (
                    <Button {...tourAnchor('topups.receipt')} variant="outline" size="sm" className="whitespace-nowrap" type="button" onClick={() => setReceiptOrderId(o.id)}>
                      <Receipt aria-hidden="true" />
                      {t('TopupHistoryTable.receipt')}
                    </Button>
                  )}
                  {/* Đơn còn chờ thì mở lại được mã QR cũ để chuyển tiếp — cùng một mã đơn,
                      nên tiền vẫn về đúng chỗ và không sinh thêm đơn treo. */}
                  {o.status === TopupOrderStatus.PENDING && onResume && (
                    <Button {...tourAnchor('topups.resume')} variant="ghost" size="sm" className="whitespace-nowrap" type="button" onClick={() => onResume(o)}>
                      <QrCode aria-hidden="true" />
                      {t('TopupHistoryTable.continueTransfer')}
                    </Button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {receiptOrderId && (
        <ReceiptModal orderId={receiptOrderId} onClose={() => setReceiptOrderId(null)} />
      )}
    </div>
  )
}
