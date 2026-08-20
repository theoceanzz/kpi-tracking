import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Gauge, CalendarClock, BarChart2, Medal, SendHorizonal, Flame } from 'lucide-react'
import UserAvatar from '@/components/common/UserAvatar'
import { cn, formatDateTime } from '@/lib/utils'
import { useSummaryStats } from '@/features/analytics/hooks/useAnalytics'
import { WidgetShell } from '../../components/WidgetShell'
import { useHeadDashboard } from '../../context/HeadDashboardContext'
import { useNow } from '../../hooks/useNow'
import KpiReminderModal, { type ReminderRecipient } from '../../components/KpiReminderModal'
import {
  DistributionChart, LabeledBar, MetricTile, compactNumber, progressTone,
  type DistributionBucket,
} from '../shared/Primitives'

const DEADLINE_WINDOW_DAYS = 7

// ── Tiến độ từng KPI của đơn vị ───────────────────────────────────────────────
/**
 * Bảng nhân sự chỉ trả lời "ai nộp bao nhiêu bài". Câu hỏi thật của trưởng đơn vị là
 * "chỉ tiêu doanh số của phòng đã đạt bao nhiêu" — con số đó nằm ở target/actual của từng KPI.
 */
export function HeadUnitKpisWidget() {
  const { unitKpis, isUnitKpisLoading } = useHeadDashboard()

  const sorted = useMemo(
    () => [...unitKpis].sort((a, b) => (a.progress ?? 0) - (b.progress ?? 0)),
    [unitKpis]
  )

  return (
    <WidgetShell
      title="Tiến độ chỉ tiêu đơn vị"
      icon={<Gauge size={17} />}
      isLoading={isUnitKpisLoading}
      isEmpty={sorted.length === 0}
      emptyMessage="Đơn vị chưa có chỉ tiêu nào có số liệu đo lường."
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
        {sorted.map(kpi => {
          const progress = kpi.progress ?? 0
          return (
            <li key={kpi.kpiId}>
              <LabeledBar
                label={
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{kpi.kpiName}</span>
                    {kpi.assigneeName && (
                      <span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-slate-400">
                        {kpi.assigneeName.split(' ').pop()}
                      </span>
                    )}
                  </span>
                }
                percent={progress}
                tone={progressTone(progress)}
                right={kpi.targetValue > 0
                  ? `${compactNumber(kpi.actualValue)}/${compactNumber(kpi.targetValue)}${kpi.unit ? ` ${kpi.unit}` : ''} · ${Math.round(progress)}%`
                  : `${Math.round(progress)}%`}
              />
            </li>
          )
        })}
      </ul>
    </WidgetShell>
  )
}

// ── KPI quá hạn của đơn vị ────────────────────────────────────────────────────
/** "Vi phạm deadline: 3" không giúp xử lý được gì. Đây là danh sách cụ thể để đi nhắc từng người. */
export function HeadOverdueKpisWidget() {
  const { overdueKpis, isOverdueLoading } = useHeadDashboard()

  return (
    <WidgetShell
      title="Chỉ tiêu đã quá hạn"
      icon={<Flame size={17} />}
      isLoading={isOverdueLoading}
      isEmpty={overdueKpis.length === 0}
      emptyMessage="Đơn vị không có chỉ tiêu nào quá hạn."
      actions={overdueKpis.length > 0 ? (
        <span className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-900/25 text-red-700 dark:text-red-300 text-[10px] font-black tabular-nums">
          {overdueKpis.length} MỤC
        </span>
      ) : undefined}
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
        {overdueKpis.map(kpi => (
          <li key={kpi.kpiId} className="py-3">
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{kpi.kpiName}</p>
            <div className="flex items-center justify-between gap-3 mt-1">
              <span className="text-[11px] font-bold text-slate-500 truncate min-w-0">
                {kpi.assigneeNames.length > 0 ? kpi.assigneeNames.join(', ') : 'Chưa có người đảm nhiệm'}
              </span>
              {kpi.deadline && (
                <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-red-600 dark:text-red-400">
                  Hạn {formatDateTime(kpi.deadline).split(' ')[0]}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </WidgetShell>
  )
}

// ── Deadline sắp tới của cả đội ───────────────────────────────────────────────
export function HeadTeamDeadlineWidget() {
  const { unitKpis, isUnitKpisLoading } = useHeadDashboard()
  const now = useNow()

  const upcoming = useMemo(() => {
    const limit = now + DEADLINE_WINDOW_DAYS * 86_400_000
    return unitKpis
      .filter(k => k.periodEnd)
      .map(k => ({ kpi: k, at: new Date(k.periodEnd!).getTime() }))
      .filter(({ at }) => at >= now && at <= limit)
      .sort((a, b) => a.at - b.at)
      .slice(0, 10)
  }, [unitKpis, now])

  return (
    <WidgetShell
      title={`Đội sắp đến hạn (${DEADLINE_WINDOW_DAYS} ngày)`}
      icon={<CalendarClock size={17} />}
      isLoading={isUnitKpisLoading}
      isEmpty={upcoming.length === 0}
      emptyMessage="Không có chỉ tiêu nào của đội sắp đến hạn."
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
        {upcoming.map(({ kpi, at }) => {
          const days = Math.ceil((at - now) / 86_400_000)
          const progress = kpi.progress ?? 0
          return (
            <li key={kpi.kpiId} className="py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{kpi.kpiName}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">
                  {kpi.assigneeName ?? `${kpi.participantCount} người`} · đạt {Math.round(progress)}%
                </p>
              </div>
              <span className={cn(
                'shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap tabular-nums',
                days <= 2
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              )}>
                {days === 0 ? 'Hôm nay' : `Còn ${days} ngày`}
              </span>
            </li>
          )
        })}
      </ul>
    </WidgetShell>
  )
}

// ── Phân bố điểm của đội ──────────────────────────────────────────────────────
/**
 * "Điểm TB đội 7.5" che mất việc đội đang phân hoá. Nửa đội 9 điểm nửa đội 6 điểm
 * cần cách xử lý hoàn toàn khác với cả đội đều 7.5.
 */
export function HeadScoreDistributionWidget() {
  const { allEmployees, isEmployeesLoading, organization } = useHeadDashboard()
  const max = organization?.evaluationMaxScore ?? 100

  const buckets = useMemo<DistributionBucket[]>(() => {
    const scored = allEmployees.filter(e => e.averageScore !== null)
    const pct = (e: typeof scored[number]) => ((e.averageScore ?? 0) / max) * 100
    return [
      { label: 'Dưới 50%', count: scored.filter(e => pct(e) < 50).length, tone: 'red' },
      { label: '50–70%', count: scored.filter(e => pct(e) >= 50 && pct(e) < 70).length, tone: 'amber' },
      { label: '70–90%', count: scored.filter(e => pct(e) >= 70 && pct(e) < 90).length, tone: 'indigo' },
      { label: 'Từ 90%', count: scored.filter(e => pct(e) >= 90).length, tone: 'emerald' },
    ]
  }, [allEmployees, max])

  const scoredCount = buckets.reduce((s, b) => s + b.count, 0)

  return (
    <WidgetShell
      title="Phân bố điểm của đội"
      icon={<BarChart2 size={17} />}
      isLoading={isEmployeesLoading}
      isEmpty={scoredCount === 0}
      emptyMessage="Chưa có thành viên nào được chấm điểm."
    >
      <DistributionChart buckets={buckets} unitLabel="người" />
    </WidgetShell>
  )
}

// ── Đơn vị tôi so với các đơn vị khác ─────────────────────────────────────────
/** Trưởng đơn vị luôn muốn biết mình đứng đâu, nhưng dashboard cũ không có mốc so sánh nào. */
export function HeadBenchmarkWidget() {
  const { unitName } = useHeadDashboard()
  const { data, isLoading, error, refetch } = useSummaryStats()

  const ranked = useMemo(() => {
    const units = [...(data?.topPerformingUnits ?? []), ...(data?.worstPerformingUnits ?? [])]
    // Hai danh sách có thể chồng nhau khi tổ chức ít đơn vị
    const unique = new Map(units.map(u => [u.unitName, u]))
    return [...unique.values()].sort((a, b) => b.completionRate - a.completionRate)
  }, [data])

  const myIndex = ranked.findIndex(u => u.unitName === unitName)
  const me = myIndex >= 0 ? ranked[myIndex] : null
  const avg = ranked.length ? ranked.reduce((s, u) => s + u.completionRate, 0) / ranked.length : 0

  return (
    <WidgetShell
      title="Đơn vị tôi so với các đơn vị khác"
      icon={<Medal size={17} />}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={ranked.length === 0}
      emptyMessage="Chưa đủ dữ liệu để so sánh giữa các đơn vị."
    >
      {me && (
        <div className="shrink-0 mb-4 flex items-baseline gap-2">
          <span className="text-3xl font-black tabular-nums text-indigo-600 dark:text-indigo-400">#{myIndex + 1}</span>
          <span className="text-xs font-bold text-slate-500 tabular-nums">
            / {ranked.length} đơn vị · TB chung {Math.round(avg)}%
          </span>
        </div>
      )}

      <ul className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
        {ranked.map(u => {
          const mine = u.unitName === unitName
          return (
            <li key={u.unitName} className={cn(mine && 'rounded-xl bg-indigo-50/60 dark:bg-indigo-500/10 -mx-2 px-2 py-1.5')}>
              <LabeledBar
                label={
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={cn('truncate', mine && 'text-indigo-700 dark:text-indigo-300 font-black')}>{u.unitName}</span>
                    {mine && <span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Đơn vị tôi</span>}
                  </span>
                }
                percent={u.completionRate}
                tone={mine ? 'indigo' : 'slate'}
              />
            </li>
          )
        })}
      </ul>
    </WidgetShell>
  )
}

// ── Ai chưa nộp gì trong kỳ ───────────────────────────────────────────────────
/** Người có KPI nhưng chưa nộp bài nào là rủi ro im lặng — không xuất hiện ở bất kỳ báo cáo nào. */
export function HeadNoSubmissionWidget() {
  const { allEmployees, isEmployeesLoading, activePeriod } = useHeadDashboard()
  const [reminderTarget, setReminderTarget] = useState<ReminderRecipient | null>(null)

  const silent = useMemo(
    () => allEmployees.filter(e => e.assignedKpi > 0 && e.totalSubmissions === 0),
    [allEmployees]
  )

  return (
    <WidgetShell
      title="Chưa nộp bài nào"
      icon={<SendHorizonal size={17} />}
      isLoading={isEmployeesLoading}
      isEmpty={silent.length === 0}
      emptyMessage="Mọi thành viên có KPI đều đã nộp ít nhất một bài."
      actions={silent.length > 0 ? (
        <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/25 text-amber-700 dark:text-amber-300 text-[10px] font-black tabular-nums">
          {silent.length} NGƯỜI
        </span>
      ) : undefined}
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
        {silent.map(e => (
          <li key={e.userId} className="py-2.5 flex items-center gap-3">
            <UserAvatar
              fullName={e.fullName} avatarUrl={e.avatarUrl}
              className="w-8 h-8 rounded-lg shrink-0"
              fallbackClassName="bg-slate-100 dark:bg-slate-800 font-black text-[10px] text-slate-500"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{e.fullName}</p>
              <p className="text-[10px] font-bold text-slate-400 tabular-nums">{e.assignedKpi} chỉ tiêu được giao</p>
            </div>
            <button
              onClick={() => setReminderTarget({ userId: e.userId, fullName: e.fullName, email: e.email })}
              className="shrink-0 min-h-[36px] px-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 dark:hover:bg-indigo-900/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer"
            >
              Nhắc
            </button>
          </li>
        ))}
      </ul>

      <KpiReminderModal
        open={!!reminderTarget}
        onClose={() => setReminderTarget(null)}
        recipient={reminderTarget}
        periodName={activePeriod?.name}
      />
    </WidgetShell>
  )
}

// ── Sức khoẻ đơn vị (thay 4 thẻ số rời) ───────────────────────────────────────
/**
 * Gộp bốn con số vốn nằm rải rác vào một khối có ngữ cảnh: tiến độ đơn vị đứng cạnh
 * số KPI rủi ro thì mới đọc được là "đang ổn" hay "đang có vấn đề".
 */
export function HeadUnitHealthWidget() {
  const { unitMetrics, stats, allEmployees, unitName, isStatsLoading } = useHeadDashboard()

  const avgScore = useMemo(() => {
    const scored = allEmployees.filter(e => e.averageScore !== null)
    if (!scored.length) return null
    return scored.reduce((s, e) => s + (e.averageScore ?? 0), 0) / scored.length
  }, [allEmployees])

  const progress = Math.round(unitMetrics?.averageProgress ?? 0)

  return (
    <WidgetShell title={`Sức khoẻ ${unitName}`} icon={<Gauge size={17} />} isLoading={isStatsLoading}>
      <div className="shrink-0 mb-4">
        <LabeledBar label="Tiến độ chỉ tiêu toàn đơn vị" percent={progress} tone={progressTone(progress)} />
      </div>
      <div className="flex-1 grid grid-cols-2 gap-3 content-start">
        <MetricTile label="Nhân sự" value={stats?.totalUsers ?? 0} tone="blue" />
        <MetricTile label="Điểm TB đội" value={avgScore !== null ? avgScore.toFixed(1) : '—'} tone="indigo" />
        <MetricTile label="KPI đang chạy" value={unitMetrics?.runningKpis ?? 0} tone="slate" />
        <MetricTile
          label="KPI rủi ro"
          value={unitMetrics?.riskKpis ?? 0}
          tone={(unitMetrics?.riskKpis ?? 0) > 0 ? 'red' : 'emerald'}
        />
      </div>
      <Link
        to="/performance?section=submissions-org-unit"
        className="mt-4 shrink-0 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded self-start"
      >
        Mở trung tâm duyệt
      </Link>
    </WidgetShell>
  )
}
