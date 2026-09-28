import { intlLocale } from '@/i18n/format'
import { ArrowDownToLine, Coins, SlidersHorizontal } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { CashTransactionType, type CashTransaction } from '../types'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

const TYPE_META = perLanguage((): Record<
  CashTransactionType,
  { label: string; icon: React.ReactNode; cls: string }
> => ({
  [CashTransactionType.TOPUP]: {
    label: i18n.t('wallet:CashLedgerTable.topUp'),
    icon: <ArrowDownToLine size={14} />,
    cls: 'bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)] dark:text-[var(--color-success)]',
  },
  [CashTransactionType.CONVERT]: {
    label: i18n.t('wallet:CashLedgerTable.convertedToPoints'),
    icon: <Coins size={14} />,
    cls: 'bg-[var(--color-info-bg)] text-[var(--color-info)] dark:bg-[var(--color-info-bg)] dark:text-[var(--color-info)]',
  },
  [CashTransactionType.ADJUST]: {
    label: i18n.t('wallet:CashLedgerTable.adjust'),
    icon: <SlidersHorizontal size={14} />,
    cls: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)] dark:text-[var(--color-warning)]',
  },
}))

interface CashLedgerTableProps {
  data: CashTransaction[]
}

export default function CashLedgerTable({ data }: CashLedgerTableProps) {
  const { t: tr } = useTranslation('wallet')
  return (
    // Bảng tiền có nhiều cột số dài; cho cuộn ngang TRONG khung thay vì để cả
    // trang trượt theo.
    <div className="overflow-x-auto rounded-card border border-[var(--color-border)]">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-[var(--color-muted)]/50 text-left">
          <tr className="text-eyebrow">
            <th className="px-4 py-3">{tr('CashLedgerTable.time')}</th>
            <th className="px-4 py-3">{tr('CashLedgerTable.type')}</th>
            <th className="px-4 py-3 text-right">{tr('CashLedgerTable.amount')}</th>
            <th className="px-4 py-3 text-right">{tr('CashLedgerTable.balanceAfter')}</th>
            <th className="px-4 py-3">{tr('CashLedgerTable.explanation')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {data.map((t) => {
            const meta = TYPE_META()[t.type]
            const positive = t.amount > 0
            return (
              <tr key={t.id} className="hover:bg-[var(--color-muted)]/30">
                <td className="whitespace-nowrap px-4 py-3 text-[var(--color-muted-foreground)]">
                  {formatDateTime(t.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${meta.cls}`}
                  >
                    {meta.icon}
                    {meta.label}
                  </span>
                </td>
                <td
                  className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${
                    positive ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'
                  }`}
                >
                  {positive ? '+' : '−'}
                  {formatCurrency(Math.abs(t.amount))}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[var(--color-muted-foreground)]">
                  {formatCurrency(t.balanceAfter)}
                </td>
                <td className="px-4 py-3">
                  <div className="text-[var(--color-foreground)]">{t.note || '—'}</div>
                  {/* Số điểm nhận được là thứ người dùng quan tâm nhất ở dòng quy
                      đổi, quan trọng hơn cả số tiền bị trừ. */}
                  {t.pointsGranted != null && (
                    <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                      {tr('CashLedgerTable.received')} {t.pointsGranted.toLocaleString(intlLocale())} {tr('CashLedgerTable.points')}
                      {t.rateSnapshot != null && tr('CashLedgerTable.ratePoint', { rateSnapshot: formatCurrency(t.rateSnapshot) })}
                    </div>
                  )}
                  {t.actorName && (
                    <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                      {tr('CashLedgerTable.performedBy')} {t.actorName}
                    </div>
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
