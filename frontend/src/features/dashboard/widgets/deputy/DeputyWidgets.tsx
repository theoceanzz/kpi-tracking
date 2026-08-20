import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Gauge, Users, CalendarClock, Eye, FileWarning } from 'lucide-react'
import UserAvatar from '@/components/common/UserAvatar'
import { cn, formatDateTime } from '@/lib/utils'
import { WidgetShell } from '../../components/WidgetShell'
import { useDeputyDashboard } from '../../context/DeputyDashboardContext'
import { useNow } from '../../hooks/useNow'
import { LabeledBar, MetricTile, progressTone } from '../shared/Primitives'

const DEADLINE_WINDOW_DAYS = 7

/**
 * Nhãn nhắc rằng Phó chỉ theo dõi, không phải người bấm nút cuối. Hiện khi Phó không
 * nằm ở vị trí duyệt — thà nói thẳng còn hơn để họ bấm rồi nhận lỗi quyền.
 */
function WatchOnlyNote({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-black uppercase tracking-wider">
      <Eye size={11} aria-hidden="true" /> Theo dõi
    </span>
  )
}

// ── Tổng quan mảng phụ trách ──────────────────────────────────────────────────
export function DeputyScopeOverviewWidget() {
  const { scopeKpis, scopeMembers, isScopeLoading, isApprover, unitName } = useDeputyDashboard()

  const stats = useMemo(() => {
    // API danh sách KPI không trả giá trị thực đạt, chỉ có số kỳ báo cáo đã nộp.
    // Nên ở đây là tiến độ NỘP, không phải mức đạt chỉ tiêu — nhãn phải nói đúng điều đó.
    const withExpected = scopeKpis.filter(k => k.expectedSubmissions > 0)
    const avgProgress = withExpected.length
      ? withExpected.reduce((s, k) =>
          s + Math.min(100, (k.submissionCount / k.expectedSubmissions) * 100), 0) / withExpected.length
      : 0
    return {
      total: scopeKpis.length,
      approved: scopeKpis.filter(k => k.status === 'APPROVED').length,
      pending: scopeKpis.filter(k => k.status === 'PENDING_APPROVAL').length,
      avgProgress: Math.round(avgProgress),
    }
  }, [scopeKpis])

  return (
    <WidgetShell
      title={`Mảng tôi phụ trách · ${unitName}`}
      icon={<Gauge size={17} />}
      isLoading={isScopeLoading}
      isEmpty={scopeKpis.length === 0}
      emptyMessage="Bạn chưa được giao đảm nhiệm chỉ tiêu nào."
      actions={<WatchOnlyNote show={!isApprover} />}
    >
      <div className="shrink-0 mb-4">
        <LabeledBar
          label="Tiến độ nộp báo cáo trung bình"
          percent={stats.avgProgress}
          tone={progressTone(stats.avgProgress)}
        />
      </div>
      <div className="flex-1 grid grid-cols-2 gap-3 content-start">
        <MetricTile label="Chỉ tiêu phụ trách" value={stats.total} tone="indigo" />
        <MetricTile label="Người trong mảng" value={scopeMembers.length} tone="blue" />
        <MetricTile label="Đã duyệt" value={stats.approved} tone="emerald" />
        <MetricTile
          label="Chờ duyệt"
          value={stats.pending}
          tone={stats.pending > 0 ? 'amber' : 'slate'}
        />
      </div>
    </WidgetShell>
  )
}

// ── Tiến độ từng chỉ tiêu trong mảng ──────────────────────────────────────────
export function DeputyScopeKpisWidget() {
  const { scopeKpis, isScopeLoading } = useDeputyDashboard()

  const rows = useMemo(() => {
    return scopeKpis
      .map(k => {
        const expected = k.expectedSubmissions || 0
        const progress = expected > 0 ? Math.min(100, (k.submissionCount / expected) * 100) : 0
        return { kpi: k, expected, progress }
      })
      .sort((a, b) => a.progress - b.progress)
  }, [scopeKpis])

  return (
    <WidgetShell
      title="Tiến độ nộp báo cáo trong mảng"
      icon={<Gauge size={17} />}
      isLoading={isScopeLoading}
      isEmpty={rows.length === 0}
      emptyMessage="Bạn chưa được giao đảm nhiệm chỉ tiêu nào."
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
        {rows.map(({ kpi, expected, progress }) => (
          <li key={kpi.id}>
            <LabeledBar
              label={
                <span className="flex flex-col min-w-0">
                  <span className="truncate">{kpi.name}</span>
                  {kpi.assigneeNames?.length > 0 && (
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 truncate">
                      {kpi.assigneeNames.join(', ')}
                    </span>
                  )}
                </span>
              }
              percent={progress}
              tone={progressTone(progress)}
              right={expected > 0
                ? `đã nộp ${kpi.submissionCount}/${expected}`
                : `${Math.round(progress)}%`}
            />
          </li>
        ))}
      </ul>
    </WidgetShell>
  )
}

// ── Người trong mảng ──────────────────────────────────────────────────────────
/** Không phải toàn bộ nhân sự đơn vị — chỉ những ai cùng đảm nhiệm chỉ tiêu với Phó. */
export function DeputyScopeMembersWidget() {
  const { scopeMembers, isScopeLoading } = useDeputyDashboard()

  return (
    <WidgetShell
      title="Người trong mảng của tôi"
      icon={<Users size={17} />}
      isLoading={isScopeLoading}
      isEmpty={scopeMembers.length === 0}
      emptyMessage="Chưa có ai cùng đảm nhiệm chỉ tiêu với bạn."
      actions={
        <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black tabular-nums">
          {scopeMembers.length} NGƯỜI
        </span>
      }
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
        {scopeMembers.map(m => (
          <li key={m.userId} className="py-2.5 flex items-center gap-3">
            <UserAvatar
              fullName={m.fullName} avatarUrl={m.avatarUrl}
              className="w-8 h-8 rounded-lg shrink-0"
              fallbackClassName="bg-slate-100 dark:bg-slate-800 font-black text-[10px] text-slate-500"
            />
            <span className="min-w-0 flex-1 text-xs font-bold text-slate-900 dark:text-white truncate">
              {m.fullName}
            </span>
            <span className="shrink-0 text-[10px] font-bold text-slate-400 tabular-nums">
              {m.kpiCount} chỉ tiêu chung
            </span>
            <Link
              to={`/employees/${m.userId}/performance`}
              aria-label={`Xem hiệu suất của ${m.fullName}`}
              className="shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Eye size={15} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </WidgetShell>
  )
}

// ── Mảng sắp đến hạn ──────────────────────────────────────────────────────────
export function DeputyScopeDeadlineWidget() {
  const { scopeKpis, isScopeLoading } = useDeputyDashboard()
  const now = useNow()

  const upcoming = useMemo(() => {
    const limit = now + DEADLINE_WINDOW_DAYS * 86_400_000
    return scopeKpis
      .map(k => ({ kpi: k, due: k.effectiveDeadline ?? k.deadline }))
      .filter((x): x is { kpi: typeof x.kpi; due: string } => !!x.due)
      .map(({ kpi, due }) => ({ kpi, at: new Date(due).getTime() }))
      .filter(({ at }) => at <= limit)
      .sort((a, b) => a.at - b.at)
      .slice(0, 10)
  }, [scopeKpis, now])

  return (
    <WidgetShell
      title={`Mảng sắp đến hạn (${DEADLINE_WINDOW_DAYS} ngày)`}
      icon={<CalendarClock size={17} />}
      isLoading={isScopeLoading}
      isEmpty={upcoming.length === 0}
      emptyMessage="Không có chỉ tiêu nào trong mảng sắp đến hạn."
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
        {upcoming.map(({ kpi, at }) => {
          const days = Math.ceil((at - now) / 86_400_000)
          const overdue = days < 0
          return (
            <li key={kpi.id} className="py-2.5 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{kpi.name}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">
                  {kpi.assigneeNames?.join(', ') || 'Chưa có người đảm nhiệm'}
                </p>
              </div>
              <span className={cn(
                'shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap tabular-nums',
                overdue
                  ? 'bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300'
                  : days <= 2
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              )}>
                {overdue ? 'Quá hạn' : days === 0 ? 'Hôm nay' : `Còn ${days} ngày`}
              </span>
            </li>
          )
        })}
      </ul>
    </WidgetShell>
  )
}

// ── Chỉ tiêu trong mảng đang chờ / bị trả lại ─────────────────────────────────
/**
 * Với Phó **là** người duyệt, đây là việc phải xử lý. Với Phó chỉ theo dõi, đây là
 * thứ cần đi thúc trưởng đơn vị — nên nhãn và nút đổi theo `isApprover`.
 */
export function DeputyPendingKpisWidget() {
  const { scopeKpis, isScopeLoading, isApprover } = useDeputyDashboard()

  const rows = useMemo(
    () => scopeKpis.filter(k => k.status === 'PENDING_APPROVAL' || k.status === 'REJECTED'),
    [scopeKpis]
  )

  return (
    <WidgetShell
      title={isApprover ? 'Chỉ tiêu chờ tôi duyệt' : 'Chỉ tiêu đang vướng'}
      icon={<FileWarning size={17} />}
      isLoading={isScopeLoading}
      isEmpty={rows.length === 0}
      emptyMessage="Không có chỉ tiêu nào trong mảng đang chờ hoặc bị trả lại."
      actions={<WatchOnlyNote show={!isApprover} />}
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map(k => {
          const rejected = k.status === 'REJECTED'
          return (
            <li key={k.id} className="py-3">
              <Link
                to={`/performance?section=kpi-criteria&kpiId=${k.id}`}
                className="block rounded-xl -mx-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 text-xs font-bold text-slate-900 dark:text-white truncate">{k.name}</p>
                  <span className={cn(
                    'shrink-0 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider',
                    rejected
                      ? 'bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300'
                  )}>
                    {rejected ? 'Bị trả lại' : 'Chờ duyệt'}
                  </span>
                </div>
                {rejected && k.rejectReason && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 line-clamp-2">{k.rejectReason}</p>
                )}
                <p className="text-[10px] font-bold text-slate-400 mt-1 truncate">
                  {k.approvedByName ? `Người duyệt: ${k.approvedByName}` : 'Chưa xác định người duyệt'}
                  {k.updatedAt ? ` · ${formatDateTime(k.updatedAt).split(' ')[0]}` : ''}
                </p>
              </Link>
            </li>
          )
        })}
      </ul>
    </WidgetShell>
  )
}
