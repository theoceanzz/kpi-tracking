import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Banknote, Gift, Sparkles, Compass, Target } from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { walletApi } from '@/features/wallet/api/walletApi'
import { giftApi } from '@/features/rewards/api/giftApi'
import { aiQuotaApi } from '@/features/organization/api/ai-quota.api'
import { bscAnalyticsApi } from '@/features/analytics/api/bscAnalyticsApi'
import { okrApi } from '@/features/okr/api/okr.api'
import { WidgetShell } from '../../components/WidgetShell'
import { LabeledBar, MetricTile, compactNumber, progressTone } from '../shared/Primitives'

// ── Ví tiền ───────────────────────────────────────────────────────────────────
export function StaffCashWalletWidget() {
  const { data: wallet, isLoading, error, refetch } = useQuery({
    queryKey: ['cash', 'me'],
    queryFn: () => walletApi.getMyWallet(),
  })
  const { data: topups } = useQuery({
    queryKey: ['cash', 'topups', 'me', 'dashboard'],
    queryFn: () => walletApi.getMyTopups(0, 5),
  })

  const pending = useMemo(
    () => (topups?.content ?? []).filter(t => t.status === 'PENDING').length,
    [topups]
  )

  return (
    <WidgetShell
      title="Ví tiền của tôi"
      icon={<Banknote size={17} />}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={!wallet}
      actions={
        <Link
          to="/me?section=wallet"
          className="min-h-[36px] px-3 inline-flex items-center rounded-lg bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
        >
          Nạp tiền
        </Link>
      }
    >
      <div className="flex-1 flex flex-col justify-center gap-4">
        <div>
          <p className="text-3xl font-black tabular-nums text-slate-900 dark:text-white">
            {new Intl.NumberFormat('vi-VN').format(wallet?.balance ?? 0)} đ
          </p>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Số dư khả dụng</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MetricTile
            label="Quy đổi được"
            value={`${compactNumber(wallet?.convertiblePoints ?? 0)} điểm`}
            tone="indigo"
            hint={`Tỷ giá: ${new Intl.NumberFormat('vi-VN').format(wallet?.pointExchangeRate ?? 0)} đ / 1 điểm`}
          />
          <MetricTile label="Đã nạp tích luỹ" value={compactNumber(wallet?.lifetimeTopup ?? 0)} tone="emerald" />
        </div>
        {pending > 0 && (
          <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {pending} lệnh nạp đang chờ đối soát.
          </p>
        )}
      </div>
    </WidgetShell>
  )
}

// ── Đổi quà của tôi ───────────────────────────────────────────────────────────
export function StaffRedemptionWidget() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['rewards', 'redemptions', 'me', 'dashboard'],
    queryFn: () => giftApi.getMyRedemptions(0, 6),
  })
  const items = data?.content ?? []

  return (
    <WidgetShell
      title="Đổi quà của tôi"
      icon={<Gift size={17} />}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={items.length === 0}
      emptyMessage="Bạn chưa đổi quà nào."
      actions={
        <Link
          to="/me?section=rewards"
          className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
        >
          Cửa hàng
        </Link>
      }
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
        {items.map(r => (
          <li key={r.id} className="py-2.5 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{r.giftNameSnapshot}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5 tabular-nums">
                {r.quantity} × · {compactNumber(r.pointsSpent)} điểm · {formatDateTime(r.createdAt).split(' ')[0]}
              </p>
            </div>
            <RedemptionBadge status={r.status} />
          </li>
        ))}
      </ul>
    </WidgetShell>
  )
}

function RedemptionBadge({ status }: { status: string }) {
  const meta: Record<string, { label: string; cls: string }> = {
    PENDING: { label: 'Chờ xử lý', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300' },
    APPROVED: { label: 'Đã duyệt', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/25 dark:text-blue-300' },
    DELIVERED: { label: 'Đã giao', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300' },
    REJECTED: { label: 'Từ chối', cls: 'bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300' },
    FAILED: { label: 'Thất bại', cls: 'bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300' },
    CANCELLED: { label: 'Đã huỷ', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  }
  const m = meta[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' }
  return (
    <span className={cn('shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap', m.cls)}>
      {m.label}
    </span>
  )
}

// ── Hạn mức AI cá nhân ────────────────────────────────────────────────────────
export function StaffAiUsageWidget() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ai', 'quota', 'me'],
    queryFn: () => aiQuotaApi.getMyQuota(),
  })

  const spendable = data?.spendable ?? 0
  const used = data?.used ?? 0
  const percent = spendable > 0 ? Math.round((used / spendable) * 100) : 0

  return (
    <WidgetShell
      title="Hạn mức AI của tôi"
      icon={<Sparkles size={17} />}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={!data || data.monthlyLimit === 0}
      emptyMessage="Bạn chưa được cấp hạn mức AI trong tháng này."
    >
      <div className="flex-1 flex flex-col justify-center gap-4">
        <LabeledBar
          label="Token đã dùng trong tháng"
          percent={percent}
          // Dùng nhiều không xấu, chỉ cảnh báo khi sắp cạn hạn mức
          tone={percent >= 90 ? 'red' : percent >= 70 ? 'amber' : 'indigo'}
          right={`${compactNumber(used)}/${compactNumber(spendable)}`}
        />
        <div className="grid grid-cols-2 gap-3">
          <MetricTile label="Còn lại" value={compactNumber(data?.remaining ?? 0)} tone="emerald" />
          <MetricTile label="Đã chia cho cấp dưới" value={compactNumber(data?.allocatedToOthers ?? 0)} tone="slate" />
        </div>
      </div>
    </WidgetShell>
  )
}

// ── Điểm BSC theo viễn cảnh ───────────────────────────────────────────────────
export function StaffBscWidget() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['stats', 'bsc', 'balance', 'me'],
    queryFn: () => bscAnalyticsApi.getBalance({}),
  })

  const perspectives = data?.perspectives ?? []

  return (
    <WidgetShell
      title="Điểm BSC theo viễn cảnh"
      icon={<Compass size={17} />}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={perspectives.length === 0}
      emptyMessage="Chưa có điểm BSC nào được chấm cho bạn."
      actions={data?.averageBscScore != null ? (
        <span className="text-sm font-black tabular-nums text-slate-900 dark:text-white">
          TB {data.averageBscScore.toFixed(1)}
        </span>
      ) : undefined}
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar space-y-3.5 pr-1">
        {perspectives.map(p => {
          const score = p.averageScore ?? 0
          return (
            <li key={p.perspectiveId}>
              <LabeledBar
                label={
                  <span className="flex items-center gap-2 min-w-0">
                    {p.color && <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: p.color }} aria-hidden="true" />}
                    <span className="truncate">{p.name}</span>
                  </span>
                }
                percent={score}
                tone={progressTone(score)}
                right={`${score.toFixed(1)}${p.weightPercentage != null ? ` · trọng số ${p.weightPercentage}%` : ''}`}
              />
            </li>
          )
        })}
      </ul>
    </WidgetShell>
  )
}

// ── Key Result cá nhân đóng góp ───────────────────────────────────────────────
export function StaffOkrWidget() {
  const { user } = useAuthStore()
  const orgUnitId = user?.memberships?.[0]?.orgUnitId

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['okr', 'org-unit', orgUnitId],
    queryFn: () => okrApi.getObjectivesByOrgUnit(orgUnitId!),
    enabled: !!orgUnitId,
  })

  // Một Objective có nhiều Key Result; đơn vị chỉ đóng góp vào một phần trong đó
  const keyResults = useMemo(
    () => (data ?? [])
      .filter(o => o.status === 'ACTIVE')
      .flatMap(o => o.keyResults.map(kr => ({ ...kr, objectiveName: o.name })))
      .sort((a, b) => a.progress - b.progress)
      .slice(0, 10),
    [data]
  )

  return (
    <WidgetShell
      title="Key Result tôi đóng góp"
      icon={<Target size={17} />}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={keyResults.length === 0}
      emptyMessage="Đơn vị của bạn chưa có Key Result nào đang chạy."
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
        {keyResults.map(kr => (
          <li key={kr.id}>
            <LabeledBar
              label={
                <span className="flex flex-col min-w-0">
                  <span className="truncate">{kr.name}</span>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 truncate">{kr.objectiveName}</span>
                </span>
              }
              percent={kr.progress}
              tone={progressTone(kr.progress)}
              right={`${compactNumber(kr.currentValue)}/${compactNumber(kr.targetValue)}${kr.unit ? ` ${kr.unit}` : ''}`}
            />
          </li>
        ))}
      </ul>
    </WidgetShell>
  )
}
