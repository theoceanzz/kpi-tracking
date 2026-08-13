import DataTable from '@/components/common/DataTable'
import { RewardSourceType, RewardTransactionType, type RewardTransaction } from '../types'

interface RewardLedgerTableProps {
  data: RewardTransaction[]
  emptyMessage?: string
}

const SOURCE_LABEL: Record<RewardSourceType, string> = {
  [RewardSourceType.MANUAL_GRANT]: 'Thưởng trực tiếp',
  [RewardSourceType.AUTO_RANKING]: 'Thưởng theo xếp hạng',
  [RewardSourceType.REDEMPTION]: 'Đổi quà',
  [RewardSourceType.SYSTEM]: 'Điều chỉnh hệ thống',
  [RewardSourceType.EXTERNAL]: 'Hệ thống ngoài',
}

const TYPE_LABEL: Record<RewardTransactionType, string> = {
  [RewardTransactionType.EARN]: 'Được thưởng',
  [RewardTransactionType.SPEND]: 'Đổi quà',
  [RewardTransactionType.REFUND]: 'Hoàn điểm',
  [RewardTransactionType.ADJUST]: 'Điều chỉnh',
  [RewardTransactionType.EXPIRE]: 'Hết hạn',
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

/** Dấu và màu bám theo dấu của số tiền, không bám theo loại — ADJUST có thể là cộng hoặc trừ. */
const AmountCell = ({ amount }: { amount: number }) => (
  <span className={amount > 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>
    {amount > 0 ? '+' : ''}
    {amount.toLocaleString('vi-VN')}
  </span>
)

export default function RewardLedgerTable({ data, emptyMessage }: RewardLedgerTableProps) {
  return (
    <DataTable<RewardTransaction>
      data={data}
      keyExtractor={(row) => row.id}
      emptyMessage={emptyMessage ?? 'Chưa có giao dịch điểm nào'}
      columns={[
        {
          key: 'createdAt',
          header: 'Thời gian',
          render: (row) => (
            <span className="whitespace-nowrap text-[var(--color-muted-foreground)]">
              {fmtDate(row.createdAt)}
            </span>
          ),
        },
        {
          key: 'type',
          header: 'Nội dung',
          render: (row) => (
            <div>
              <div className="font-medium">{TYPE_LABEL[row.type]}</div>
              {row.note && (
                <div className="text-xs text-[var(--color-muted-foreground)]">{row.note}</div>
              )}
            </div>
          ),
        },
        {
          key: 'sourceType',
          header: 'Nguồn',
          render: (row) => (
            <span className="text-[var(--color-muted-foreground)]">
              {SOURCE_LABEL[row.sourceType]}
            </span>
          ),
        },
        {
          key: 'actorName',
          header: 'Người thực hiện',
          render: (row) => row.actorName ?? '—',
        },
        {
          key: 'amount',
          header: 'Điểm',
          className: 'text-right',
          render: (row) => <AmountCell amount={row.amount} />,
        },
        {
          key: 'balanceAfter',
          header: 'Số dư sau',
          className: 'text-right',
          render: (row) => row.balanceAfter.toLocaleString('vi-VN'),
        },
      ]}
    />
  )
}
