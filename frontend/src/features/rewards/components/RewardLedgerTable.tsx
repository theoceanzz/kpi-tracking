import { intlDateLocale, intlLocale } from '@/i18n/format'
import DataTable from '@/components/common/DataTable'
import { RewardSourceType, RewardTransactionType, type RewardTransaction } from '../types'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

interface RewardLedgerTableProps {
  data: RewardTransaction[]
  emptyMessage?: string
}

const SOURCE_LABEL = perLanguage((): Record<RewardSourceType, string> => ({
  [RewardSourceType.MANUAL_GRANT]: i18n.t('rewards:RewardLedgerTable.directReward'),
  [RewardSourceType.AUTO_RANKING]: i18n.t('rewards:RewardLedgerTable.rankingReward'),
  [RewardSourceType.REDEMPTION]: i18n.t('rewards:RewardLedgerTable.giftRedemption'),
  [RewardSourceType.CHECKIN]: i18n.t('rewards:RewardLedgerTable.dailyCheckIn'),
  [RewardSourceType.SYSTEM]: i18n.t('rewards:RewardLedgerTable.systemAdjustment'),
  [RewardSourceType.EXTERNAL]: i18n.t('rewards:RewardLedgerTable.externalSystem'),
}))

const TYPE_LABEL = perLanguage((): Record<RewardTransactionType, string> => ({
  [RewardTransactionType.EARN]: i18n.t('rewards:RewardLedgerTable.rewarded'),
  [RewardTransactionType.SPEND]: i18n.t('rewards:RewardLedgerTable.giftRedemption'),
  [RewardTransactionType.REFUND]: i18n.t('rewards:RewardLedgerTable.pointRefund'),
  [RewardTransactionType.ADJUST]: i18n.t('rewards:RewardLedgerTable.adjust'),
  [RewardTransactionType.EXPIRE]: i18n.t('rewards:RewardLedgerTable.expired'),
}))

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(intlDateLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

/** Dấu và màu bám theo dấu của số tiền, không bám theo loại — ADJUST có thể là cộng hoặc trừ. */
const AmountCell = ({ amount }: { amount: number }) => (
  <span className={amount > 0 ? 'font-semibold text-[var(--color-success)]' : 'font-semibold text-[var(--color-error)]'}>
    {amount > 0 ? '+' : ''}
    {amount.toLocaleString(intlLocale())}
  </span>
)

export default function RewardLedgerTable({ data, emptyMessage }: RewardLedgerTableProps) {
  const { t } = useTranslation('rewards')
  return (
    <DataTable<RewardTransaction>
      data={data}
      keyExtractor={(row) => row.id}
      emptyMessage={emptyMessage ?? t('RewardLedgerTable.noPointTransactionsYet')}
      columns={[
        {
          key: 'createdAt',
          header: t('RewardLedgerTable.time'),
          render: (row) => (
            <span className="whitespace-nowrap text-[var(--color-muted-foreground)]">
              {fmtDate(row.createdAt)}
            </span>
          ),
        },
        {
          key: 'type',
          header: t('RewardLedgerTable.description'),
          render: (row) => (
            <div>
              <div className="font-medium">{TYPE_LABEL()[row.type]}</div>
              {row.note && (
                <div className="text-xs text-[var(--color-muted-foreground)]">{row.note}</div>
              )}
            </div>
          ),
        },
        {
          key: 'sourceType',
          header: t('RewardLedgerTable.source'),
          render: (row) => (
            <span className="text-[var(--color-muted-foreground)]">
              {SOURCE_LABEL()[row.sourceType]}
            </span>
          ),
        },
        {
          key: 'actorName',
          header: t('RewardLedgerTable.performedBy'),
          render: (row) => row.actorName ?? '—',
        },
        {
          key: 'amount',
          header: t('RewardLedgerTable.points'),
          className: 'text-right',
          render: (row) => <AmountCell amount={row.amount} />,
        },
        {
          key: 'balanceAfter',
          header: t('RewardLedgerTable.balanceAfter'),
          className: 'text-right',
          render: (row) => row.balanceAfter.toLocaleString(intlLocale()),
        },
      ]}
    />
  )
}
