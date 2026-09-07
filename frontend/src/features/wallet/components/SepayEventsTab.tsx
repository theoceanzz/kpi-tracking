import { useState } from 'react'
import { CheckCircle2, ShieldAlert } from 'lucide-react'
import Pagination from '@/components/common/Pagination'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { useSepayEvents, useWalletReconcile } from '../hooks/useWallet'
import ResolveEventModal from './ResolveEventModal'
import { SepayEventStatus, type SepayEvent } from '../types'

const STATUS_CLS: Record<SepayEventStatus, string> = {
  [SepayEventStatus.MATCHED]:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  [SepayEventStatus.UNMATCHED]:
    'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
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

  return (
    <div>
      {/* Đối soát sạch là bất biến của sổ tiền, nên nói thẳng ra chứ không bắt
          người dùng tự suy từ một bảng rỗng. */}
      {reconcile && (
        <div
          id="tour-sepay-status"
          className={`mb-5 flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-4 text-sm ${
            reconcile.clean
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : 'border-amber-500/40 bg-amber-500/10'
          }`}
        >
          {reconcile.clean ? (
            <CheckCircle2 size={18} className="text-emerald-600" />
          ) : (
            <ShieldAlert size={18} className="text-amber-600" />
          )}
          <span>
            {reconcile.clean ? (
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
          <button
            key={s}
            type="button"
            onClick={() => {
              setScope(s)
              setPage(0)
            }}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
              scope === s
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                : 'border-[var(--color-border)] text-[var(--color-muted-foreground)]'
            }`}
          >
            {s === 'queue' ? 'Cần xử lý' : 'Toàn bộ lịch sử'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSkeleton type="table" rows={4} />
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)]">
          <EmptyState
            title={scope === 'queue' ? 'Không có gì cần xử lý' : 'Chưa có giao dịch SePay nào'}
            description={
              scope === 'queue'
                ? 'Mọi giao dịch chuyển khoản đều đã được ghi có đúng người.'
                : 'Các callback từ SePay sẽ hiện ở đây ngay khi có tiền về.'
            }
          />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-[var(--color-muted)]/50 text-left">
                <tr className="text-[11px] font-black uppercase tracking-wider text-[var(--color-muted-foreground)]">
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
                    <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums">
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
                        <div className="mt-1 text-xs text-amber-600">Lệch số tiền</div>
                      )}
                      {/* Tiền về một tài khoản chưa ai khai. Phải nói ra ở bảng chứ
                          không đợi tới lúc bấm xử lý mới báo, vì nó là dấu hiệu của
                          cấu hình sai chứ không phải của một giao dịch cá biệt. */}
                      {e.unattributed && (
                        <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                          Chưa xác định tổ chức
                        </div>
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
                        <button
                          type="button"
                          onClick={() => setSelected(e)}
                          className="whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Xử lý
                        </button>
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
