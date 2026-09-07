import DataTable from '@/components/common/DataTable'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useState } from 'react'
import { Ticket } from 'lucide-react'
import VoucherModal from './VoucherModal'
import { RedemptionStatus, type Redemption } from '../types'
import { useMyRedemptions } from '../hooks/useGifts'

export const REDEMPTION_STATUS_STYLE: Record<
  RedemptionStatus,
  { label: string; className: string }
> = {
  [RedemptionStatus.PENDING]: { label: 'Chờ giao', className: 'bg-amber-500/15 text-amber-700' },
  // Giữ lại cho các yêu cầu tạo từ trước khi bỏ bước duyệt — luồng mới không sinh
  // trạng thái này nữa.
  [RedemptionStatus.APPROVED]: {
    label: 'Chờ giao',
    className: 'bg-amber-500/15 text-amber-700',
  },
  [RedemptionStatus.DELIVERED]: {
    label: 'Đã nhận',
    className: 'bg-emerald-500/15 text-emerald-700',
  },
  [RedemptionStatus.REJECTED]: { label: 'Từ chối', className: 'bg-rose-500/15 text-rose-700' },
  [RedemptionStatus.CANCELLED]: {
    label: 'Đã huỷ',
    className: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
  },
  // Khác hẳn "Từ chối": không ai từ chối cả, nhà cung cấp không xuất được quà và điểm
  // đã tự hoàn. Gộp nhãn sẽ khiến nhân viên tưởng công ty chặn mình.
  [RedemptionStatus.FAILED]: {
    label: 'Không xuất được quà',
    className: 'bg-orange-500/15 text-orange-700',
  },
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

interface MyRedemptionsTableProps {
  data: Redemption[]
}

export default function MyRedemptionsTable({ data }: MyRedemptionsTableProps) {
  const [cancelling, setCancelling] = useState<Redemption | null>(null)
  const [viewing, setViewing] = useState<Redemption | null>(null)
  const { cancelRedemption, isCancelling } = useMyRedemptions()

  return (
    <>
      <DataTable<Redemption>
        data={data}
        keyExtractor={(row) => row.id}
        emptyMessage="Bạn chưa đổi quà nào"
        renderMobileCard={(row) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">
                {row.giftNameSnapshot}
                {row.quantity > 1 && ` ×${row.quantity}`}
              </span>
              <span
                className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${REDEMPTION_STATUS_STYLE[row.status].className}`}
              >
                {REDEMPTION_STATUS_STYLE[row.status].label}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-muted-foreground)]">{fmtDate(row.createdAt)}</span>
              <span className="font-semibold">−{row.pointsSpent.toLocaleString('vi-VN')} điểm</span>
            </div>
            {!!row.vouchers?.length && (
              <button
                onClick={() => setViewing(row)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--color-primary)] py-2 text-sm font-medium text-white"
              >
                <Ticket size={14} />
                Xem mã quà
              </button>
            )}
            {row.status === RedemptionStatus.PENDING && (
              <button
                onClick={() => setCancelling(row)}
                className="w-full rounded-lg border border-[var(--color-border)] py-2 text-sm"
              >
                Huỷ yêu cầu
              </button>
            )}
          </div>
        )}
        columns={[
          {
            key: 'createdAt',
            className: 'align-top',
            header: 'Ngày đổi',
            render: (row) => (
              <span className="whitespace-nowrap text-[var(--color-muted-foreground)]">
                {fmtDate(row.createdAt)}
              </span>
            ),
          },
          {
            key: 'gift',
            className: 'align-top',
            header: 'Quà',
            render: (row) => (
              <div className="flex items-center gap-2.5">
                {row.giftImageUrl && (
                  <img
                    src={row.giftImageUrl}
                    alt=""
                    className="h-9 w-9 flex-shrink-0 rounded-lg object-cover"
                  />
                )}
                <div>
                  <div className="font-medium">{row.giftNameSnapshot}</div>
                  {row.quantity > 1 && (
                    <div className="text-xs text-[var(--color-muted-foreground)]">
                      Số lượng: {row.quantity}
                    </div>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: 'note',
            className: 'align-top',
            header: 'Ghi chú',
            render: (row) => (
              <div>
                <span className="text-[var(--color-muted-foreground)]">{row.note || '—'}</span>
                {/* Yêu cầu treo hoặc hỏng mà không nói lý do sẽ biến thành một cuộc gọi
                    cho bộ phận hỗ trợ. */}
                {row.fulfillmentError && (
                  <div className="mt-0.5 text-xs text-orange-700">{row.fulfillmentError}</div>
                )}
              </div>
            ),
          },
          {
            key: 'pointsSpent',
            className: 'text-right align-top',
            header: 'Điểm',
            render: (row) => (
              <span className="font-semibold">−{row.pointsSpent.toLocaleString('vi-VN')}</span>
            ),
          },
          {
            key: 'status',
            className: 'align-top',
            header: 'Trạng thái',
            render: (row) => (
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${REDEMPTION_STATUS_STYLE[row.status].className}`}
              >
                {REDEMPTION_STATUS_STYLE[row.status].label}
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
                  <button
                    onClick={() => setViewing(row)}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary)]"
                  >
                    <Ticket size={14} />
                    Xem mã
                  </button>
                )}
                {row.status === RedemptionStatus.PENDING && (
                  <button
                    onClick={() => setCancelling(row)}
                    className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
                  >
                    Huỷ
                  </button>
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
        title="Huỷ yêu cầu đổi quà?"
        description={
          cancelling
            ? `${cancelling.pointsSpent.toLocaleString('vi-VN')} điểm sẽ được hoàn lại vào ví của bạn ngay.`
            : ''
        }
        confirmLabel="Huỷ yêu cầu"
        loading={isCancelling}
      />
    </>
  )
}
