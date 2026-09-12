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

const STATUS_CLS: Record<SepayEventStatus, string> = {
  [SepayEventStatus.MATCHED]:
    'bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)] dark:text-[var(--color-success)]',
  [SepayEventStatus.UNMATCHED]:
    'bg-[var(--color-error-bg)] text-[var(--color-error)] dark:bg-[var(--color-error-bg)] dark:text-[var(--color-error)]',
  [SepayEventStatus.DUPLICATE]: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
  [SepayEventStatus.IGNORED]: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
}

const STATUS_LABEL: Record<SepayEventStatus, string> = {
  [SepayEventStatus.MATCHED]: 'Đã khớp',
  [SepayEventStatus.UNMATCHED]: 'Chưa khớp',
  [SepayEventStatus.DUPLICATE]: 'Gửi trùng',
  [SepayEventStatus.IGNORED]: 'Bỏ qua',
}

export default function SepayEventsTab() {
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
          id="tour-sepay-status"
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
                Chưa khai số tài khoản nhận tiền trong <strong>Cấu hình ví</strong>. Giao dịch về
                tài khoản chưa khai không hiện ở đây, kể cả khi tiền đã về — hãy lưu đúng số tài
                khoản đã liên kết trên SePay, các giao dịch cũ của tài khoản đó sẽ tự được gán về
                công ty.
              </>
            ) : reconcile.clean ? (
              <>Sổ cái ví tiền cân đối, không có giao dịch nào chờ xử lý.</>
            ) : (
              <>
                <strong>{reconcile.unresolvedEventCount}</strong> giao dịch chưa khớp đơn,{' '}
                <strong>{reconcile.amountMismatchCount}</strong> giao dịch lệch số tiền cần xác nhận
                {reconcile.inconsistentWalletIds.length > 0 && (
                  <>
                    , và <strong>{reconcile.inconsistentWalletIds.length}</strong> ví có số dư lệch
                    so với sổ cái
                  </>
                )}
                .
              </>
            )}
          </span>
        </div>
      )}

      <div id="tour-sepay-scope" className="mb-4 flex gap-2">
        {(['queue', 'all'] as const).map((s) => (
          <ChoiceChip selected={scope === s} variant="solid" className="py-1.5" key={s} onClick={() => {
              setScope(s)
              setPage(0)
            }}>
            {s === 'queue' ? 'Cần xử lý' : 'Toàn bộ lịch sử'}
          </ChoiceChip>
        ))}
      </div>

      {isLoading ? (
        <LoadingSkeleton type="table" rows={4} />
      ) : events.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)]">
          <EmptyState
            title={scope === 'queue' ? 'Không có gì cần xử lý' : 'Chưa có giao dịch SePay nào'}
            description={
              notConfigured
                ? 'Chưa khai số tài khoản nhận tiền nên chưa giao dịch nào được quy về công ty này. Vào Cấu hình ví lưu đúng số tài khoản đã liên kết trên SePay.'
                : scope === 'queue'
                  ? 'Mọi giao dịch chuyển khoản đều đã được ghi có đúng người.'
                  : 'Các callback từ SePay sẽ hiện ở đây ngay khi có tiền về.'
            }
          />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-card border border-[var(--color-border)]">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-[var(--color-muted)]/50 text-left">
                <tr className="text-eyebrow">
                  <th className="px-4 py-3">Nhận lúc</th>
                  <th className="px-4 py-3 text-right">Số tiền</th>
                  <th className="px-4 py-3">Nội dung</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Xử lý</th>
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
                          Đơn {e.matchedOrderCode} · {e.matchedOrderUserName}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLS[e.status]}`}
                      >
                        {STATUS_LABEL[e.status]}
                      </span>
                      {e.amountMismatch && (
                        <div className="mt-1 text-xs text-[var(--color-warning)]">Lệch số tiền</div>
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
                        <Button size="sm" className="whitespace-nowrap" type="button" onClick={() => setSelected(e)}>
                          Xử lý
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
                itemLabel="giao dịch"
              />
            </div>
          )}
        </>
      )}

      <ResolveEventModal event={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
