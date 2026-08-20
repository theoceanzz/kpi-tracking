import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, Gift, HandCoins, Sparkles, Compass, Target } from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { notificationApi } from '@/features/notifications/api/notificationApi'
import { rewardApi } from '@/features/rewards/api/rewardApi'
import { giftApi } from '@/features/rewards/api/giftApi'
import { RedemptionStatus, RewardGrantStatus } from '@/features/rewards/types'
import { aiQuotaApi } from '@/features/organization/api/ai-quota.api'
import { bscAnalyticsApi } from '@/features/analytics/api/bscAnalyticsApi'
import { okrApi } from '@/features/okr/api/okr.api'
import { WidgetShell } from '../../components/WidgetShell'
import { LabeledBar, MetricTile, compactNumber, progressTone } from './Primitives'

/**
 * Widget dùng chung cho nhiều vai trò. Nội dung giống nhau nhưng phạm vi dữ liệu do
 * chính endpoint quyết định (backend đã lọc theo quyền của người gọi), nên không cần
 * truyền scope từ frontend.
 */

// ── Thông báo chưa đọc ────────────────────────────────────────────────────────
export function NotificationsWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationApi.getUnreadCount(),
  })
  const count = typeof data === 'number' ? data : 0

  return (
    <WidgetShell title="Thông báo" icon={<Bell size={17} />} isLoading={isLoading}>
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
        <span className={cn(
          'text-5xl font-black tabular-nums',
          count > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-700'
        )}>
          {count}
        </span>
        <p className="text-xs font-bold text-slate-500">
          {count > 0 ? 'thông báo chưa đọc' : 'Bạn đã đọc hết thông báo'}
        </p>
        {count > 0 && (
          <Link
            to="/notifications"
            className="min-h-[44px] px-5 inline-flex items-center rounded-2xl bg-indigo-600 text-white font-black text-xs hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 transition-colors"
          >
            Xem thông báo
          </Link>
        )}
      </div>
    </WidgetShell>
  )
}

// ── Đề nghị thưởng chờ duyệt ──────────────────────────────────────────────────
/**
 * `GET /reward-grants` đã lọc theo quyền người gọi, nên giám đốc thấy toàn tổ chức còn
 * trưởng đơn vị chỉ thấy phần thuộc phạm vi mình — không cần tham số scope ở frontend.
 */
export function RewardGrantsPendingWidget() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reward-grants', 'pending', 'dashboard'],
    queryFn: () => rewardApi.getGrants({ status: RewardGrantStatus.PENDING_APPROVAL, page: 0, size: 10 }),
  })
  const items = data?.content ?? []

  return (
    <WidgetShell
      title="Đề nghị thưởng chờ duyệt"
      icon={<HandCoins size={17} />}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={items.length === 0}
      emptyMessage="Không có đề nghị thưởng nào đang chờ duyệt."
      actions={items.length > 0 ? (
        <Link
          to="/rewards"
          className="min-h-[36px] px-3 inline-flex items-center rounded-lg bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
        >
          Duyệt ngay
        </Link>
      ) : undefined}
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
        {items.map(g => (
          <li key={g.id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{g.reason}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">
                  {g.grantorName}{g.orgUnitName ? ` · ${g.orgUnitName}` : ''} · {formatDateTime(g.createdAt ?? '').split(' ')[0]}
                </p>
              </div>
              <span className="shrink-0 text-sm font-black tabular-nums text-indigo-600 dark:text-indigo-400">
                {compactNumber(g.totalPoints)} đ
              </span>
            </div>
            {/* Lý do phải qua duyệt là thứ người duyệt cần đọc trước khi bấm */}
            {g.approvalReason && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1.5 line-clamp-2">{g.approvalReason}</p>
            )}
          </li>
        ))}
      </ul>
    </WidgetShell>
  )
}

// ── Đơn đổi quà cần xử lý ─────────────────────────────────────────────────────
export function RedemptionQueueWidget() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['rewards', 'redemptions', 'pending', 'dashboard'],
    queryFn: () => giftApi.getRedemptions({ status: RedemptionStatus.PENDING, page: 0, size: 10 }),
  })
  const items = data?.content ?? []

  return (
    <WidgetShell
      title="Đơn đổi quà chờ xử lý"
      icon={<Gift size={17} />}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={items.length === 0}
      emptyMessage="Không có đơn đổi quà nào đang chờ."
      actions={items.length > 0 ? (
        <Link
          to="/rewards"
          className="min-h-[36px] px-3 inline-flex items-center rounded-lg bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
        >
          Xử lý
        </Link>
      ) : undefined}
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
        {items.map(r => (
          <li key={r.id} className="py-2.5 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{r.giftNameSnapshot}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">
                {r.userFullName} · {formatDateTime(r.createdAt).split(' ')[0]}
              </p>
            </div>
            <span className="shrink-0 text-xs font-black tabular-nums text-slate-700 dark:text-slate-300">
              {r.quantity} × {compactNumber(r.pointsSpent)}
            </span>
          </li>
        ))}
      </ul>
    </WidgetShell>
  )
}

// ── Hạn mức AI ────────────────────────────────────────────────────────────────
/** Dùng cho cả giám đốc (ngân sách công ty) và trưởng đơn vị (túi được chia). */
export function AiQuotaOverviewWidget() {
  const { data: overview, isLoading, error, refetch } = useQuery({
    queryKey: ['ai', 'quota', 'overview'],
    queryFn: () => aiQuotaApi.getOverview(),
  })
  const { data: allocations } = useQuery({
    queryKey: ['ai', 'quota', 'allocations', 'dashboard'],
    queryFn: () => aiQuotaApi.getAllocations({ page: 0, size: 100 }),
    enabled: overview?.canAllocate === true,
  })

  const topUsers = useMemo(
    () => [...(allocations?.content ?? [])]
      .filter(a => a.usedThisMonth > 0)
      .sort((a, b) => b.usedThisMonth - a.usedThisMonth)
      .slice(0, 6),
    [allocations]
  )

  const pool = overview?.allocatablePool ?? 0
  const allocated = overview?.allocated ?? 0
  const percent = pool > 0 ? Math.round((allocated / pool) * 100) : 0

  return (
    <WidgetShell
      title="Hạn mức AI"
      icon={<Sparkles size={17} />}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={!overview || pool === 0}
      emptyMessage="Chưa có ngân sách AI nào được cấp."
      actions={
        <Link
          to="/organization?tab=ai"
          className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
        >
          Phân bổ
        </Link>
      }
    >
      <div className="shrink-0 mb-4 space-y-3">
        <LabeledBar
          label="Đã phân bổ trên túi được cấp"
          percent={percent}
          tone={percent >= 90 ? 'red' : percent >= 70 ? 'amber' : 'indigo'}
          right={`${compactNumber(allocated)}/${compactNumber(pool)}`}
        />
        <div className="grid grid-cols-2 gap-3">
          <MetricTile label="Còn cấp được" value={compactNumber(overview?.remainingToAllocate ?? 0)} tone="emerald" />
          <MetricTile label="Ngân sách công ty" value={compactNumber(overview?.companyMonthlyLimit ?? 0)} tone="slate" />
        </div>
      </div>

      {topUsers.length > 0 && (
        <>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 shrink-0">
            Dùng nhiều nhất tháng này
          </p>
          <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
            {topUsers.map(u => (
              <li key={u.userId} className="py-2 flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{u.fullName}</span>
                  <span className="block text-[10px] font-bold text-slate-400 truncate">{u.orgUnitName ?? u.roleName ?? ''}</span>
                </span>
                <span className="shrink-0 text-xs font-black tabular-nums text-slate-700 dark:text-slate-300">
                  {compactNumber(u.usedThisMonth)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </WidgetShell>
  )
}

// ── Điểm BSC theo viễn cảnh (đơn vị / tổ chức) ────────────────────────────────
export function BscBalanceWidget({ orgUnitId, title }: { orgUnitId?: string; title: string }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['stats', 'bsc', 'balance', orgUnitId ?? 'org'],
    queryFn: () => bscAnalyticsApi.getBalance({ orgUnitId }),
  })

  const perspectives = data?.perspectives ?? []

  return (
    <WidgetShell
      title={title}
      icon={<Compass size={17} />}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={perspectives.length === 0}
      emptyMessage="Chưa có điểm BSC nào trong phạm vi này."
      actions={
        <span className="flex items-center gap-2">
          {data?.scoringMode === 'SHADOW' && (
            // Chế độ SHADOW nghĩa là điểm BSC chưa tính vào kết quả chính thức
            <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/25 text-amber-700 dark:text-amber-300 text-[9px] font-black uppercase tracking-wider">
              Chạy thử
            </span>
          )}
          {data?.averageBscScore != null && (
            <span className="text-sm font-black tabular-nums text-slate-900 dark:text-white">
              TB {data.averageBscScore.toFixed(1)}
            </span>
          )}
        </span>
      }
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
                right={`${score.toFixed(1)}${p.kpiCount ? ` · ${p.kpiCount} KPI` : ''}`}
              />
            </li>
          )
        })}
      </ul>

      {(data?.unmappedKpiCount ?? 0) > 0 && (
        <p className="shrink-0 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] font-bold text-amber-600 dark:text-amber-400 tabular-nums">
          {data!.unmappedKpiCount} KPI chưa gắn viễn cảnh nào — không được tính vào điểm BSC.
        </p>
      )}
    </WidgetShell>
  )
}

// ── Objective (OKR) ───────────────────────────────────────────────────────────
export function OkrObjectivesWidget({ scope, id, title }: {
  scope: 'organization' | 'org-unit'
  id?: string
  title: string
}) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['okr', scope, id],
    queryFn: () => scope === 'organization'
      ? okrApi.getObjectivesByOrganization(id!)
      : okrApi.getObjectivesByOrgUnit(id!),
    enabled: !!id,
  })

  /** Tiến độ Objective = trung bình tiến độ các Key Result của nó. */
  const objectives = useMemo(
    () => (data ?? [])
      .filter(o => o.status === 'ACTIVE')
      .map(o => ({
        id: o.id,
        name: o.name,
        krCount: o.keyResults.length,
        progress: o.keyResults.length
          ? o.keyResults.reduce((s, kr) => s + kr.progress, 0) / o.keyResults.length
          : 0,
        // Không có Key Result nào nhúc nhích là dấu hiệu Objective bị bỏ quên
        stalled: o.keyResults.length > 0 && o.keyResults.every(kr => kr.currentValue === 0),
      }))
      .sort((a, b) => a.progress - b.progress),
    [data]
  )

  const atRisk = objectives.filter(o => o.stalled || o.progress < 30)

  return (
    <WidgetShell
      title={title}
      icon={<Target size={17} />}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={objectives.length === 0}
      emptyMessage="Chưa có Objective nào đang chạy."
      actions={atRisk.length > 0 ? (
        <span className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-900/25 text-red-700 dark:text-red-300 text-[10px] font-black tabular-nums">
          {atRisk.length} có nguy cơ
        </span>
      ) : undefined}
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
        {objectives.map(o => (
          <li key={o.id}>
            <LabeledBar
              label={
                <span className="flex items-center gap-2 min-w-0">
                  <span className="truncate">{o.name}</span>
                  {o.stalled && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-900/25 text-red-700 dark:text-red-300 text-[9px] font-black uppercase tracking-wider">
                      Chưa tiến triển
                    </span>
                  )}
                </span>
              }
              percent={o.progress}
              tone={o.stalled ? 'red' : progressTone(o.progress)}
              right={`${Math.round(o.progress)}% · ${o.krCount} KR`}
            />
          </li>
        ))}
      </ul>
    </WidgetShell>
  )
}
