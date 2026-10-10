import { useState } from 'react'
import { CheckCircle2, ShieldAlert } from 'lucide-react'
import Pagination from '@/components/common/Pagination'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { useSepayEvents, useWalletReconcile } from '../hooks/useWallet'
import ResolveEventModal from './ResolveEventModal'
import { SepayEventStatus, type SepayEvent } from '../types'
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'
import { tourAnchor } from '@/components/common/tours/anchors'

const STATUS_CLS: Record<SepayEventStatus, string> = {
  [SepayEventStatus.MATCHED]:
    'bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)] dark:text-[var(--color-success)]',
  [SepayEventStatus.UNMATCHED]:
    'bg-[var(--color-error-bg)] text-[var(--color-error)] dark:bg-[var(--color-error-bg)] dark:text-[var(--color-error)]',
  [SepayEventStatus.DUPLICATE]: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
  [SepayEventStatus.IGNORED]: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
}

const STATUS_LABEL = perLanguage((): Record<SepayEventStatus, string> => ({
  [SepayEventStatus.MATCHED]: i18n.t('wallet:SepayEventsTab.matched'),
  [SepayEventStatus.UNMATCHED]: i18n.t('wallet:SepayEventsTab.unmatched'),
  [SepayEventStatus.DUPLICATE]: i18n.t('wallet:SepayEventsTab.duplicate'),
  [SepayEventStatus.IGNORED]: i18n.t('wallet:SepayEventsTab.skip'),
}))

export default function SepayEventsTab() {
  const { t } = useTranslation('wallet')
  const [scope, setScope] = useState<'queue' | 'all'>('queue')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<SepayEvent | null>(null)
  const size = 20

  const { data, isLoading } = useSepayEvents(scope, page, size)
  const { data: reconcile } = useWalletReconcile()

  const events = data?.content ?? []

  // Hàng đợi chỉ chứa giao dịch đã quy được về công ty này. Chưa khai số tài khoản
  // thì nó luôn trống KỂ CẢ khi tiền đã về thật, nên không được báo "sổ đã sạch" —
  // đó đúng là lúc người dùng cần biết là chưa nối xong với SePay.
  const notConfigured = reconcile ? !reconcile.bankConfigured : false
  const allGood = !!reconcile?.clean && !notConfigured

  return (
    <div>
      {/* Đối soát sạch là bất biến của sổ tiền, nên nói thẳng ra chứ không bắt
          người dùng tự suy từ một bảng rỗng. */}
      {reconcile && (
        <div
          id="tour-sepay-status" {...tourAnchor('sepay.status')}
          className={`mb-5 flex flex-wrap items-center gap-3 rounded-card border px-5 py-4 text-sm ${
            allGood
              ? 'border-[var(--color-success-border)] bg-[var(--color-success-bg)]'
              : 'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)]'
          }`}
        >
          {allGood ? (
            <CheckCircle2 size={18} className="text-[var(--color-success)]" />
          ) : (
            <ShieldAlert size={18} className="text-[var(--color-warning)]" />
          )}
          <span>
            {notConfigured ? (
              <>
                {t('SepayEventsTab.theReceivingAccountNumberHasNot')} <strong>{t('SepayEventsTab.walletConfiguration')}</strong>{t('SepayEventsTab.transactionsToAnUndeclaredAccountDo')}
              </>
            ) : reconcile.clean ? (
              <>{t('SepayEventsTab.theWalletLedgerBalancesWithNo')}</>
            ) : (
              <>
                <strong>{reconcile.unresolvedEventCount}</strong> {t('SepayEventsTab.transactionsNotMatchedToAnOrder')}{' '}
                <strong>{reconcile.amountMismatchCount}</strong> {t('SepayEventsTab.transactionsWithAmountMismatchesToConfirm')}
                {reconcile.inconsistentWalletIds.length > 0 && (
                  <>
                    {t('SepayEventsTab.and')} <strong>{reconcile.inconsistentWalletIds.length}</strong> {t('SepayEventsTab.walletsWithABalanceOutOf')}
                  </>
                )}
                .
              </>
            )}
          </span>
        </div>
      )}

      <div {...tourAnchor('sepay.scope')} id="tour-sepay-scope" className="mb-4 flex gap-2">
        {(['queue', 'all'] as const).map((s) => (
          <ChoiceChip selected={scope === s} variant="solid" className="py-1.5" key={s} onClick={() => {
              setScope(s)
              setPage(0)
            }}>
            {s === 'queue' ? t('SepayEventsTab.needsHandling') : t('SepayEventsTab.fullHistory')}
          </ChoiceChip>
        ))}
      </div>

      {isLoading ? (
        <LoadingSkeleton type="table" rows={4} />
      ) : events.length === 0 ? (
        <div {...tourAnchor('sepay.table')} className="rounded-card border border-dashed border-[var(--color-border)]">
          <EmptyState
            title={scope === 'queue' ? t('SepayEventsTab.nothingNeedsHandling') : t('SepayEventsTab.noSepayTransactionsYet')}
            description={
              notConfigured
                ? t('SepayEventsTab.theReceivingAccountNumberHasNot2')
                : scope === 'queue'
                  ? t('SepayEventsTab.everyTransferHasBeenCreditedTo')
                  : t('SepayEventsTab.callbacksFromSepayAppearHereAs')
            }
          />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-card border border-[var(--color-border)]">
            <table {...tourAnchor('sepay.table')} className="w-full min-w-[900px] text-sm">
              <thead className="bg-[var(--color-muted)]/50 text-left">
                <tr className="text-eyebrow">
                  <th className="px-4 py-3">{t('SepayEventsTab.receivedAt')}</th>
                  <th className="px-4 py-3 text-right">{t('SepayEventsTab.amount')}</th>
                  <th className="px-4 py-3">{t('SepayEventsTab.description')}</th>
                  <th className="px-4 py-3">{t('SepayEventsTab.status')}</th>
                  <th className="px-4 py-3">{t('SepayEventsTab.handle')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {events.map((e) => (
                  <tr key={e.id} className="hover:bg-[var(--color-muted)]/30">
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--color-muted-foreground)]">
                      {formatDateTime(e.receivedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                      {formatCurrency(e.transferAmount ?? 0)}
                    </td>
                    <td className="max-w-[260px] px-4 py-3">
                      <div className="truncate">{e.content || '—'}</div>
                      {e.matchedOrderCode && (
                        <div className="mt-0.5 truncate text-xs text-[var(--color-muted-foreground)]">
                          {t('SepayEventsTab.order')} {e.matchedOrderCode} · {e.matchedOrderUserName}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLS[e.status]}`}
                      >
                        {STATUS_LABEL()[e.status]}
                      </span>
                      {e.amountMismatch && (
                        <div className="mt-1 text-xs text-[var(--color-warning)]">{t('SepayEventsTab.amountMismatch')}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {e.resolvedAt ? (
                        <div className="text-[var(--color-muted-foreground)]">
                          <div>{e.resolvedByName}</div>
                          <div>{formatDateTime(e.resolvedAt)}</div>
                          {e.resolutionNote && (
                            <div className="mt-0.5 max-w-[200px] truncate italic">
                              {e.resolutionNote}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[var(--color-muted-foreground)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {e.inQueue && (
                        <Button {...tourAnchor('sepay.handle')} size="sm" className="whitespace-nowrap" type="button" onClick={() => setSelected(e)}>
                          {t('SepayEventsTab.handle')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(data?.totalPages ?? 0) > 1 && (
            <div className="mt-4">
              <Pagination
                currentPage={page}
                totalPages={data?.totalPages ?? 0}
                totalElements={data?.totalElements ?? 0}
                size={size}
                onPageChange={setPage}
                itemLabel={t('SepayEventsTab.transactions')}
              />
            </div>
          )}
        </>
      )}

      <ResolveEventModal event={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
