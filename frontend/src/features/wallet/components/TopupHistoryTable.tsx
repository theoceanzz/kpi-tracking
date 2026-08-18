import { formatCurrency, formatDateTime } from '@/lib/utils'
import { TopupOrderStatus, type TopupOrder } from '../types'

const STATUS_META: Record<TopupOrderStatus, { label: string; cls: string }> = {
  [TopupOrderStatus.PENDING]: {
    label: 'Chờ chuyển khoản',
    cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  [TopupOrderStatus.PAID]: {
    label: 'Đã nhận tiền',
    cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  [TopupOrderStatus.EXPIRED]: {
    label: 'Hết hạn',
    cls: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
  },
  [TopupOrderStatus.CANCELLED]: {
    label: 'Đã huỷ',
    cls: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
  },
}

interface TopupHistoryTableProps {
  data: TopupOrder[]
}

export default function TopupHistoryTable({ data }: TopupHistoryTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
      <table className="w-full min-w-[680px] text-sm">
        <thead className="bg-[var(--color-muted)]/50 text-left">
          <tr className="text-[11px] font-black uppercase tracking-wider text-[var(--color-muted-foreground)]">
            <th className="px-4 py-3">Thời gian</th>
            <th className="px-4 py-3">Mã đơn</th>
            <th className="px-4 py-3 text-right">Đề nghị</th>
            <th className="px-4 py-3 text-right">Thực nhận</th>
            <th className="px-4 py-3">Trạng thái</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {data.map((o) => {
            const meta = STATUS_META[o.status]
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
                    mismatch ? 'text-amber-600' : ''
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
                    <div className="mt-1 text-xs text-amber-600">Lệch so với số đề nghị</div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
