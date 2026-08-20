import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertOctagon, Landmark, Grid3x3 } from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { walletApi } from '@/features/wallet/api/walletApi'
import { matrixAnalyticsApi } from '@/features/analytics/api/matrixAnalyticsApi'
import { WidgetShell } from '../../components/WidgetShell'
import { MetricTile, compactNumber } from '../shared/Primitives'

// ── Đối soát nạp tiền chưa khớp ───────────────────────────────────────────────
/**
 * Giao dịch SePay về nhưng không khớp lệnh nạp nào (hoặc lệch số tiền) là tiền treo:
 * người dùng đã chuyển khoản mà ví chưa cộng. Càng để lâu càng khó truy.
 */
export function DirectorSepayQueueWidget() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['cash', 'sepay-events', 'queue', 'dashboard'],
    queryFn: () => walletApi.getSepayEvents({ scope: 'queue', page: 0, size: 10 }),
  })
  const items = data?.content ?? []

  return (
    <WidgetShell
      title="Nạp tiền chưa đối soát"
      icon={<AlertOctagon size={17} />}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={items.length === 0}
      emptyMessage="Mọi giao dịch nạp đều đã khớp lệnh."
      actions={items.length > 0 ? (
        <Link
          to="/wallet?tab=reconcile"
          className="min-h-[36px] px-3 inline-flex items-center rounded-lg bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors"
        >
          Đối soát ({data?.totalElements ?? items.length})
        </Link>
      ) : undefined}
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
        {items.map(e => (
          <li key={e.id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {e.code || e.referenceCode || `SePay #${e.sepayId}`}
                </p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">
                  {e.gateway ?? 'Không rõ cổng'}
                  {e.transactionDate ? ` · ${formatDateTime(e.transactionDate).split(' ')[0]}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-sm font-black tabular-nums text-slate-900 dark:text-white">
                {new Intl.NumberFormat('vi-VN').format(e.transferAmount ?? 0)} đ
              </span>
            </div>
            <span className={cn(
              'inline-block mt-1.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider',
              e.amountMismatch
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300'
                : 'bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300'
            )}>
              {e.amountMismatch ? 'Lệch số tiền' : 'Chưa khớp lệnh'}
            </span>
            {e.errorMessage && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{e.errorMessage}</p>
            )}
          </li>
        ))}
      </ul>
    </WidgetShell>
  )
}

// ── Tổng nạp / quy đổi ────────────────────────────────────────────────────────
export function DirectorCashSummaryWidget() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['cash', 'wallets', 'summary'],
    queryFn: () => walletApi.getWalletSummary(),
  })

  const fmt = (n: number) => `${new Intl.NumberFormat('vi-VN').format(n)} đ`

  return (
    <WidgetShell
      title="Dòng tiền ví"
      icon={<Landmark size={17} />}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={!data}
      actions={
        <Link
          to="/wallet"
          className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
        >
          Chi tiết
        </Link>
      }
    >
      <div className="flex-1 flex flex-col justify-center gap-4">
        <div>
          <p className="text-3xl font-black tabular-nums text-slate-900 dark:text-white">
            {fmt(data?.totalBalance ?? 0)}
          </p>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
            Tổng số dư đang giữ hộ nhân viên
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MetricTile label="Đã nạp tích luỹ" value={compactNumber(data?.totalTopup ?? 0)} tone="emerald" />
          <MetricTile label="Đã quy đổi điểm" value={compactNumber(data?.totalConverted ?? 0)} tone="indigo" />
        </div>
        <MetricTile label="Số ví đang hoạt động" value={data?.walletCount ?? 0} tone="slate" />
      </div>
    </WidgetShell>
  )
}

// ── Phân bố xếp loại ma trận hiệu suất ────────────────────────────────────────
/**
 * Ma trận 9-box/25-box gộp hiệu suất và hành vi thành một ô xếp loại. Phân bố của nó
 * cho biết tổ chức đang "đều đều" hay có cụm cần can thiệp — thứ mà điểm trung bình giấu đi.
 */
export function DirectorMatrixWidget() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['stats', 'matrix', 'overview', 'dashboard'],
    queryFn: () => matrixAnalyticsApi.getOverview({}),
  })

  const buckets = useMemo(() => {
    const dist = data?.distribution ?? []
    const total = dist.reduce((s, b) => s + b.count, 0)
    return dist
      .slice()
      .sort((a, b) => b.rating - a.rating)
      .map(b => ({ ...b, share: total ? Math.round((b.count / total) * 100) : 0 }))
  }, [data])

  const maxCount = Math.max(1, ...buckets.map(b => b.count))

  return (
    <WidgetShell
      title="Xếp loại ma trận hiệu suất"
      icon={<Grid3x3 size={17} />}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={buckets.length === 0}
      emptyMessage="Chưa có đánh giá nào được xếp loại theo ma trận."
      actions={data?.averageRating != null ? (
        <span className="text-sm font-black tabular-nums text-slate-900 dark:text-white">
          TB {data.averageRating.toFixed(1)}
        </span>
      ) : undefined}
    >
      <div className="shrink-0 grid grid-cols-2 gap-3 mb-4">
        <MetricTile label="Hành vi TB" value={(data?.averageBehavior ?? 0).toFixed(1)} tone="purple" />
        <MetricTile label="Hoàn thành TB" value={`${Math.round(data?.averageCompletion ?? 0)}%`} tone="indigo" />
      </div>

      {/* Xếp loại càng cao càng tốt, nên vẽ từ cao xuống thấp */}
      <ul className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5 pr-1">
        {buckets.map(b => (
          <li key={b.rating} className="flex items-center gap-3">
            <span className="shrink-0 w-10 text-[11px] font-black tabular-nums text-slate-600 dark:text-slate-300">
              Loại {b.rating}
            </span>
            <span className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <span
                className={cn(
                  'block h-full rounded-full transition-all duration-700 motion-reduce:transition-none',
                  b.rating >= 4 ? 'bg-emerald-500' : b.rating >= 3 ? 'bg-indigo-600' : b.rating >= 2 ? 'bg-amber-500' : 'bg-red-500'
                )}
                style={{ width: `${(b.count / maxCount) * 100}%` }}
              />
            </span>
            <span className="shrink-0 w-16 text-right text-[11px] font-black tabular-nums text-slate-700 dark:text-slate-300">
              {b.count} · {b.share}%
            </span>
          </li>
        ))}
      </ul>

      <p className="shrink-0 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 tabular-nums">
        Dựa trên {data?.evaluationCount ?? 0} phiếu đánh giá.
      </p>
    </WidgetShell>
  )
}
