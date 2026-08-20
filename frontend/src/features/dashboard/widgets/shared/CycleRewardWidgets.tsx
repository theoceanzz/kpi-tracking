import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, Trophy, HandCoins, TrendingUp } from 'lucide-react'
import UserAvatar from '@/components/common/UserAvatar'
import { cn, formatDateTime } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { kpiCycleApi } from '@/features/kpi/api/kpiCycleApi'
import { kpiCycleEvaluationApi } from '@/features/kpi/api/kpiCycleEvaluationApi'
import { rewardApi } from '@/features/rewards/api/rewardApi'
import { WidgetShell } from '../../components/WidgetShell'
import { useNow } from '../../hooks/useNow'
import { LabeledBar, MetricTile, compactNumber } from './Primitives'

/** Kỳ đang mở gần nhất — mọi widget theo kỳ đều bám vào cùng một kỳ này. */
function useActiveCycle() {
  const { user } = useAuthStore()
  const now = useNow()
  const organizationId = user?.memberships?.[0]?.organizationId

  const { data, isLoading } = useQuery({
    queryKey: ['kpi-cycles', 'active', organizationId],
    queryFn: () => kpiCycleApi.getAll({ organizationId, page: 0, size: 20 }),
    enabled: !!organizationId,
  })

  const cycle = useMemo(() => {
    const list = data?.content ?? []
    // Kỳ đang chạy; nếu không có thì lấy kỳ kết thúc gần nhất để vẫn xem được kết quả
    const running = list.find(c =>
      c.startDate && c.endDate &&
      new Date(c.startDate).getTime() <= now && now <= new Date(c.endDate).getTime())
    if (running) return running
    return [...list]
      .filter(c => c.endDate)
      .sort((a, b) => new Date(b.endDate!).getTime() - new Date(a.endDate!).getTime())[0] ?? null
  }, [data, now])

  return { cycle, isLoading }
}

// ── Trạng thái chốt đánh giá kỳ theo đơn vị ───────────────────────────────────
/**
 * Chốt kỳ chỉ xong khi đơn vị cuối cùng chốt xong. Trước đây phải mở từng đơn vị mới biết
 * ai đang chặn; endpoint mới trả cả danh sách trong một lần gọi, đã giới hạn theo phạm vi
 * quản lý của người xem.
 */
export function CycleUnitStatusWidget({ title }: { title: string }) {
  const { cycle, isLoading: loadingCycle } = useActiveCycle()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['kpi-cycles', cycle?.id, 'evaluation', 'units'],
    queryFn: () => kpiCycleEvaluationApi.listUnitStatuses(cycle!.id),
    enabled: !!cycle?.id,
  })

  const units = data ?? []
  const finalized = units.filter(u => u.status === 'FINALIZED').length
  const percent = units.length ? Math.round((finalized / units.length) * 100) : 0

  return (
    <WidgetShell
      title={title}
      icon={<ClipboardList size={17} />}
      isLoading={loadingCycle || isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={!cycle || units.length === 0}
      emptyMessage={cycle ? 'Chưa có đơn vị nào trong phạm vi của bạn.' : 'Chưa có kỳ đánh giá nào.'}
      actions={cycle ? (
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate max-w-[130px]">
          {cycle.name}
        </span>
      ) : undefined}
    >
      <div className="shrink-0 mb-4">
        <LabeledBar
          label="Đơn vị đã chốt"
          percent={percent}
          tone={percent === 100 ? 'emerald' : percent >= 50 ? 'indigo' : 'amber'}
          right={`${finalized}/${units.length}`}
        />
      </div>

      <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
        {units.map(u => {
          const done = u.status === 'FINALIZED'
          return (
            <li key={u.orgUnitId} className="py-2.5 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{u.orgUnitName}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate tabular-nums">
                  {u.memberCount} nhân sự
                  {done && u.finalizedByName ? ` · ${u.finalizedByName} chốt` : ''}
                  {done && u.finalizedAt ? ` · ${formatDateTime(u.finalizedAt).split(' ')[0]}` : ''}
                </p>
              </div>
              {u.managerScore != null && (
                <span className="shrink-0 text-xs font-black tabular-nums text-slate-700 dark:text-slate-300">
                  {u.managerScore.toFixed(1)}
                </span>
              )}
              <span className={cn(
                'shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap',
                done
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300'
              )}>
                {done ? 'Đã chốt' : 'Chưa chốt'}
              </span>
            </li>
          )
        })}
      </ul>
    </WidgetShell>
  )
}

// ── Xếp hạng chốt kỳ ──────────────────────────────────────────────────────────
/** Người chưa có điểm vẫn hiện ở cuối — đó mới là việc quản lý cần xử lý. */
export function CycleUserRankingWidget({ title }: { title: string }) {
  const { user } = useAuthStore()
  const { cycle, isLoading: loadingCycle } = useActiveCycle()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['kpi-cycles', cycle?.id, 'evaluation', 'users'],
    queryFn: () => kpiCycleEvaluationApi.listUserRankings(cycle!.id),
    enabled: !!cycle?.id,
  })

  const rows = data ?? []
  const unscored = rows.filter(r => r.finalScore == null).length

  return (
    <WidgetShell
      title={title}
      icon={<Trophy size={17} />}
      isLoading={loadingCycle || isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={!cycle || rows.length === 0}
      emptyMessage={cycle ? 'Chưa có phiếu chốt kỳ nào.' : 'Chưa có kỳ đánh giá nào.'}
      actions={unscored > 0 ? (
        <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/25 text-amber-700 dark:text-amber-300 text-[10px] font-black tabular-nums">
          {unscored} chưa có điểm
        </span>
      ) : undefined}
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map(r => {
          const isMe = r.userId === user?.id
          return (
            <li
              key={r.userId}
              className={cn('py-2.5 flex items-center gap-3', isMe && 'bg-indigo-50/60 dark:bg-indigo-500/10 -mx-2 px-2 rounded-xl')}
            >
              <span className={cn(
                'shrink-0 w-7 text-center text-xs font-black tabular-nums',
                r.rank == null ? 'text-slate-300 dark:text-slate-600'
                  : r.rank <= 3 ? 'text-amber-500' : 'text-slate-500'
              )}>
                {r.rank ?? '—'}
              </span>
              <UserAvatar
                fullName={r.userName} avatarUrl={r.userAvatarUrl}
                className="w-8 h-8 rounded-lg shrink-0"
                fallbackClassName="bg-slate-100 dark:bg-slate-800 font-black text-[10px] text-slate-500"
              />
              <div className="min-w-0 flex-1">
                <p className={cn('text-xs font-bold truncate', isMe ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-900 dark:text-white')}>
                  {r.userName}{isMe ? ' (bạn)' : ''}
                </p>
                <p className="text-[10px] font-bold text-slate-400 truncate">{r.orgUnitName ?? ''}</p>
              </div>
              {r.matrixRating != null && (
                <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9px] font-black uppercase tracking-wider">
                  Loại {r.matrixRating}
                </span>
              )}
              <span className={cn(
                'shrink-0 w-12 text-right text-sm font-black tabular-nums',
                r.finalScore == null ? 'text-slate-300 dark:text-slate-600' : 'text-slate-900 dark:text-white'
              )}>
                {r.finalScore != null ? r.finalScore.toFixed(1) : '—'}
              </span>
            </li>
          )
        })}
      </ul>
    </WidgetShell>
  )
}

// ── Top nhận thưởng ───────────────────────────────────────────────────────────
export function RewardLeaderboardWidget() {
  const { cycle } = useActiveCycle()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['rewards', 'leaderboard', cycle?.id],
    queryFn: () => rewardApi.getLeaderboard({
      from: cycle?.startDate ?? undefined,
      to: cycle?.endDate ?? undefined,
      limit: 10,
    }),
  })

  const rows = data ?? []
  const max = Math.max(1, ...rows.map(r => r.totalPoints))

  return (
    <WidgetShell
      title="Nhận thưởng nhiều nhất"
      icon={<HandCoins size={17} />}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={rows.length === 0}
      emptyMessage="Chưa có ai được thưởng điểm trong kỳ này."
      actions={cycle ? (
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate max-w-[130px]">
          {cycle.name}
        </span>
      ) : undefined}
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5 pr-1">
        {rows.map((r, i) => (
          <li key={r.userId} className="flex items-center gap-3">
            <span className={cn(
              'shrink-0 w-5 text-center text-xs font-black tabular-nums',
              i < 3 ? 'text-amber-500' : 'text-slate-400'
            )}>
              {i + 1}
            </span>
            <UserAvatar
              fullName={r.userName} avatarUrl={r.userAvatarUrl}
              className="w-8 h-8 rounded-lg shrink-0"
              fallbackClassName="bg-slate-100 dark:bg-slate-800 font-black text-[10px] text-slate-500"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate mb-1">{r.userName}</p>
              <span className="block h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <span
                  className="block h-full rounded-full bg-amber-500 transition-all duration-700 motion-reduce:transition-none"
                  style={{ width: `${(r.totalPoints / max) * 100}%` }}
                />
              </span>
            </div>
            <span className="shrink-0 text-xs font-black tabular-nums text-slate-700 dark:text-slate-300">
              {compactNumber(r.totalPoints)}
            </span>
          </li>
        ))}
      </ul>
    </WidgetShell>
  )
}

// ── Điểm phát / tiêu theo tháng ───────────────────────────────────────────────
export function RewardMonthlyWidget() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['rewards', 'monthly-summary'],
    queryFn: () => rewardApi.getMonthlySummary(6),
  })

  const points = data ?? []
  const max = Math.max(1, ...points.flatMap(p => [p.earned, p.spent]))
  const totals = points.reduce(
    (acc, p) => ({ earned: acc.earned + p.earned, spent: acc.spent + p.spent }),
    { earned: 0, spent: 0 }
  )

  return (
    <WidgetShell
      title="Điểm phát ra / tiêu đi"
      icon={<TrendingUp size={17} />}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={points.length === 0}
      emptyMessage="Chưa có giao dịch điểm thưởng nào."
    >
      <div className="shrink-0 grid grid-cols-2 gap-3 mb-4">
        <MetricTile label="Đã phát (6 tháng)" value={compactNumber(totals.earned)} tone="emerald" />
        <MetricTile label="Đã tiêu (6 tháng)" value={compactNumber(totals.spent)} tone="indigo" />
      </div>

      <div className="flex-1 min-h-0 flex flex-col justify-end">
        <div className="flex items-end justify-between gap-3 flex-1 min-h-[90px]">
          {points.map(p => (
            <div key={p.month} className="flex-1 flex items-end justify-center gap-1 min-w-0 h-full">
              <div
                className="w-1/2 max-w-[16px] rounded-t bg-emerald-500 transition-all duration-700 motion-reduce:transition-none"
                style={{ height: `${Math.max(2, (p.earned / max) * 100)}%` }}
                role="img"
                aria-label={`${p.month}: phát ${p.earned} điểm`}
              />
              <div
                className="w-1/2 max-w-[16px] rounded-t bg-indigo-600 transition-all duration-700 motion-reduce:transition-none"
                style={{ height: `${Math.max(2, (p.spent / max) * 100)}%` }}
                role="img"
                aria-label={`${p.month}: tiêu ${p.spent} điểm`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between gap-3 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {points.map(p => (
            <span key={p.month} className="flex-1 text-center text-[9px] font-black tracking-wider text-slate-400 truncate min-w-0 tabular-nums">
              {/* yyyy-MM → MM/yy cho gọn */}
              {p.month.slice(5)}/{p.month.slice(2, 4)}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-center gap-4 mt-2.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" aria-hidden="true" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Phát ra</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600" aria-hidden="true" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tiêu đi</span>
          </span>
        </div>
      </div>
    </WidgetShell>
  )
}
