import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Gauge, History, Trophy, Flame, Coins, Bell, CalendarPlus, TrendingUp, TrendingDown,
} from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useSummaryStats } from '@/features/analytics/hooks/useAnalytics'
import { checkinApi } from '@/features/rewards/api/checkinApi'
import { WidgetShell } from '../../components/WidgetShell'
import { useStaffDashboard } from '../../context/StaffDashboardContext'
import { useNow } from '../../hooks/useNow'
import { LabeledBar, MetricTile, compactNumber, progressTone } from '../shared/Primitives'

// ── Tiến độ từng KPI (chỉ tiêu vs thực đạt) ───────────────────────────────────
/**
 * Câu hỏi thật của nhân viên không phải "tôi nộp mấy bài" mà "chỉ tiêu doanh số của tôi
 * đã đạt bao nhiêu trên bao nhiêu". Số này nằm ở `kpiItems` (targetValue/actualValue),
 * trước giờ chỉ có trong tab Thống kê chứ chưa từng lên trang chủ.
 */
export function StaffKpiProgressWidget() {
  const { kpiItems, isAnalyticsLoading } = useStaffDashboard()

  const sorted = useMemo(
    () => [...kpiItems].sort((a, b) => a.completionRate - b.completionRate),
    [kpiItems]
  )

  return (
    <WidgetShell
      title="Tiến độ chỉ tiêu của tôi"
      icon={<Gauge size={17} />}
      isLoading={isAnalyticsLoading}
      isEmpty={sorted.length === 0}
      emptyMessage="Bạn chưa được giao chỉ tiêu nào có số liệu đo lường."
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
        {sorted.map(item => {
          const hasTarget = item.targetValue !== null && item.targetValue > 0
          const actual = item.actualValue ?? 0
          return (
            <li key={item.kpiId}>
              <LabeledBar
                label={item.kpiName}
                percent={item.completionRate}
                tone={progressTone(item.completionRate)}
                right={
                  hasTarget
                    // Con số nghiệp vụ đứng trước, phần trăm chỉ là phụ chú
                    ? `${compactNumber(actual)}/${compactNumber(item.targetValue!)}${item.unit ? ` ${item.unit}` : ''} · ${Math.round(item.completionRate)}%`
                    : `${Math.round(item.completionRate)}%`
                }
              />
            </li>
          )
        })}
      </ul>
    </WidgetShell>
  )
}

// ── Lịch sử điểm được chấm ────────────────────────────────────────────────────
export function StaffScoreHistoryWidget() {
  const { evaluationHistory, isAnalyticsLoading } = useStaffDashboard()

  const items = useMemo(
    () => [...evaluationHistory]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 12),
    [evaluationHistory]
  )

  // So sánh hai lần chấm gần nhất để nói được "đang lên hay đang xuống"
  const trend = useMemo(() => {
    const scored = items.filter(i => i.score !== null)
    if (scored.length < 2) return null
    const diff = (scored[0]!.score ?? 0) - (scored[1]!.score ?? 0)
    return Math.round(diff * 10) / 10
  }, [items])

  return (
    <WidgetShell
      title="Điểm được chấm gần đây"
      icon={<History size={17} />}
      isLoading={isAnalyticsLoading}
      isEmpty={items.length === 0}
      emptyMessage="Chưa có lần chấm điểm nào cho bạn."
      actions={trend !== null && trend !== 0 ? (
        <span className={cn(
          'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black tabular-nums',
          trend > 0
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300'
            : 'bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300'
        )}>
          {trend > 0 ? <TrendingUp size={12} aria-hidden="true" /> : <TrendingDown size={12} aria-hidden="true" />}
          {trend > 0 ? '+' : ''}{trend} so với lần trước
        </span>
      ) : undefined}
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
        {items.map(item => (
          <li key={item.id} className="py-2.5 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.kpiName}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">
                {item.evaluatorName} · {formatDateTime(item.createdAt).split(' ')[0]}
              </p>
              {item.comment && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{item.comment}</p>
              )}
            </div>
            <span className="shrink-0 text-lg font-black tabular-nums text-slate-900 dark:text-white">
              {item.score !== null ? item.score.toFixed(1) : '—'}
            </span>
          </li>
        ))}
      </ul>
    </WidgetShell>
  )
}

// ── Vị trí của tôi trong đơn vị ───────────────────────────────────────────────
/** "Tôi làm tốt hay chưa" chỉ trả lời được khi có mốc so sánh với đồng nghiệp. */
export function StaffMyRankWidget() {
  const { user } = useAuthStore()
  const { data, isLoading, error, refetch } = useSummaryStats()

  const me = useMemo(() => {
    const rankings = data?.rankings ?? []
    const idx = rankings.findIndex(r => r.name === user?.fullName)
    if (idx === -1) return null
    const avg = rankings.reduce((s, r) => s + (r.score ?? 0), 0) / (rankings.length || 1)
    return { rank: idx + 1, total: rankings.length, item: rankings[idx]!, unitAvg: avg }
  }, [data, user?.fullName])

  return (
    <WidgetShell
      title="Vị trí của tôi"
      icon={<Trophy size={17} />}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={!me}
      emptyMessage="Chưa đủ dữ liệu xếp hạng trong đơn vị của bạn."
    >
      {me && (
        <div className="flex-1 flex flex-col justify-center gap-5">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black tabular-nums text-indigo-600 dark:text-indigo-400">#{me.rank}</span>
            <span className="text-sm font-bold text-slate-500 tabular-nums">/ {me.total} người trong đơn vị</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricTile label="Điểm của tôi" value={(me.item.score ?? 0).toFixed(1)} tone="indigo" />
            <MetricTile label="TB đơn vị" value={me.unitAvg.toFixed(1)} tone="slate" />
          </div>

          <p className="text-xs font-bold text-slate-500">
            {me.item.score >= me.unitAvg
              ? `Bạn đang cao hơn trung bình đơn vị ${(me.item.score - me.unitAvg).toFixed(1)} điểm.`
              : `Bạn đang thấp hơn trung bình đơn vị ${(me.unitAvg - me.item.score).toFixed(1)} điểm.`}
          </p>
        </div>
      )}
    </WidgetShell>
  )
}

// ── Điểm danh & chuỗi ─────────────────────────────────────────────────────────
export function StaffCheckinWidget() {
  const { checkin } = useStaffDashboard()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => checkinApi.checkin(),
    onSuccess: res => {
      queryClient.invalidateQueries({ queryKey: ['reward-checkins', 'me'] })
      queryClient.invalidateQueries({ queryKey: ['rewards', 'me'] })
      toast.success(res.todayPoints ? `Đã điểm danh, +${res.todayPoints} điểm` : 'Đã điểm danh')
    },
    onError: () => toast.error('Không thể điểm danh lúc này'),
  })

  if (!checkin?.enabled || checkin.exempt) {
    return (
      <WidgetShell title="Điểm danh" icon={<Flame size={17} />} isEmpty emptyMessage="Tổ chức chưa bật điểm danh, hoặc bạn được miễn.">
        <span />
      </WidgetShell>
    )
  }

  return (
    <WidgetShell title="Điểm danh hôm nay" icon={<Flame size={17} />}>
      <div className="flex-1 flex flex-col justify-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl font-black tabular-nums text-amber-500">{checkin.streakLength}</span>
          <span className="text-xs font-bold text-slate-500 leading-tight">
            ngày liên tiếp<br />đã đạt được
          </span>
        </div>

        {checkin.checkedInToday ? (
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            Hôm nay bạn đã điểm danh rồi.
          </p>
        ) : (
          <>
            <button
              onClick={() => mutation.mutate()}
              disabled={!checkin.canCheckin || mutation.isPending}
              className="min-h-[44px] px-5 rounded-2xl bg-amber-500 text-white font-black text-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 transition-colors cursor-pointer"
            >
              {mutation.isPending ? 'Đang ghi nhận…' : 'Điểm danh ngay'}
            </button>
            {!checkin.canCheckin && checkin.blockedReason && (
              <p className="text-[11px] font-bold text-slate-400">{checkin.blockedReason}</p>
            )}
          </>
        )}

        {checkin.nextPoints != null && !checkin.checkedInToday && (
          <p className="text-[11px] font-bold text-slate-400 tabular-nums">
            Lần bấm tới: +{checkin.nextPoints} điểm
            {checkin.nextBonusPoints ? ` (thưởng chuỗi +${checkin.nextBonusPoints})` : ''}
          </p>
        )}
      </div>
    </WidgetShell>
  )
}

// ── Ví điểm thưởng ────────────────────────────────────────────────────────────
export function StaffWalletWidget() {
  const { rewardEnabled, walletBalance, lifetimeEarned } = useStaffDashboard()

  return (
    <WidgetShell
      title="Điểm thưởng của tôi"
      icon={<Coins size={17} />}
      isEmpty={!rewardEnabled}
      emptyMessage="Tổ chức chưa bật tính năng thưởng."
      actions={
        <Link
          to="/me?section=rewards"
          className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
        >
          Đổi quà
        </Link>
      }
    >
      <div className="flex-1 flex flex-col justify-center gap-4">
        <div>
          <p className="text-4xl font-black tabular-nums text-slate-900 dark:text-white">
            {compactNumber(walletBalance ?? 0)}
          </p>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Điểm khả dụng</p>
        </div>
        <MetricTile label="Tích luỹ từ trước tới nay" value={compactNumber(lifetimeEarned ?? 0)} tone="emerald" />
      </div>
    </WidgetShell>
  )
}

// ── KPI sắp bắt đầu ───────────────────────────────────────────────────────────
/** Nhìn trước được việc sắp tới thay vì đợi tới ngày mới biết mình có thêm chỉ tiêu. */
export function StaffUpcomingWidget() {
  const { tasks, isProgressLoading } = useStaffDashboard()
  const now = useNow()

  const upcoming = useMemo(() => {
    return tasks
      .filter(t => t.startDate && new Date(t.startDate).getTime() > now)
      .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime())
      .slice(0, 8)
  }, [tasks, now])

  return (
    <WidgetShell
      title="Sắp bắt đầu"
      icon={<CalendarPlus size={17} />}
      isLoading={isProgressLoading}
      isEmpty={upcoming.length === 0}
      emptyMessage="Không có chỉ tiêu nào sắp mở trong thời gian tới."
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
        {upcoming.map(t => {
          const days = Math.ceil((new Date(t.startDate!).getTime() - now) / 86_400_000)
          return (
            <li key={t.id} className="py-2.5 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{t.name}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5 truncate">{t.periodName}</p>
              </div>
              <span className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider whitespace-nowrap tabular-nums">
                {days <= 1 ? 'Ngày mai' : `Sau ${days} ngày`}
              </span>
            </li>
          )
        })}
      </ul>
    </WidgetShell>
  )
}

// ── Thông báo chưa đọc ────────────────────────────────────────────────────────
export function StaffNotificationsWidget() {
  const { unreadNotifications } = useStaffDashboard()

  return (
    <WidgetShell title="Thông báo" icon={<Bell size={17} />}>
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
        <span className={cn(
          'text-5xl font-black tabular-nums',
          unreadNotifications > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-700'
        )}>
          {unreadNotifications}
        </span>
        <p className="text-xs font-bold text-slate-500">
          {unreadNotifications > 0 ? 'thông báo chưa đọc' : 'Bạn đã đọc hết thông báo'}
        </p>
        {unreadNotifications > 0 && (
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
