import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Users, Target, Clock, AlertCircle, CheckCircle, ChevronRight, FileText,
  Inbox, UserX, BarChart3,
} from 'lucide-react'
import UserAvatar from '@/components/common/UserAvatar'
import Pagination from '@/components/common/Pagination'
import SubmissionStatusChart from '@/components/charts/SubmissionStatusChart'
import { cn } from '@/lib/utils'
import type { EmployeeKpiStats } from '@/types/stats'
import { exportDetailedPerformanceToExcel } from '@/utils/performanceExport'
import { statsApi } from '../../api/statsApi'
import { WidgetShell } from '../../components/WidgetShell'
import { useHeadDashboard, EMPLOYEE_PAGE_SIZE } from '../../context/HeadDashboardContext'
import { useScopedAlerts } from '../../hooks/useScopedAlerts'
import { useMyKpiProgress } from '../../hooks/useMyKpiProgress'


// ── Hàng đợi cần xử lý ────────────────────────────────────────────────────────
/**
 * Việc số một của trưởng đơn vị. Trước đây ba con số này nằm rời ở ba thẻ thống kê,
 * người dùng phải tự suy ra "vậy tôi phải bấm vào đâu".
 */
export function HeadQueueWidget() {
  const { stats, pendingSub, roleRank, isStatsLoading } = useHeadDashboard()

  const items = useMemo(() => ([
    {
      key: 'kpi',
      label: 'KPI chờ phê duyệt',
      count: stats?.pendingKpi ?? 0,
      to: '/performance?section=kpi-criteria-pending',
      cta: 'Duyệt KPI',
    },
    {
      key: 'submission',
      label: 'Báo cáo chờ duyệt',
      count: pendingSub,
      to: roleRank === 1 ? '/evaluations' : '/submissions/org-unit',
      cta: roleRank === 1 ? 'Chấm điểm' : 'Duyệt báo cáo',
    },
  ].filter(i => i.count > 0)), [stats, pendingSub, roleRank])

  return (
    <WidgetShell
      title="Hàng đợi cần tôi xử lý"
      icon={<Inbox size={17} />}
      isLoading={isStatsLoading}
      isEmpty={items.length === 0}
      emptyMessage="Không còn việc nào chờ bạn xử lý."
    >
      <ul className="flex-1 space-y-3">
        {items.map(item => (
          <li key={item.key}>
            <Link
              to={item.to}
              className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors group"
            >
              <span className="text-3xl font-black tabular-nums text-indigo-600 dark:text-indigo-400 shrink-0">{item.count}</span>
              <span className="flex-1 min-w-0 text-sm font-bold text-slate-900 dark:text-white truncate">{item.label}</span>
              <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center gap-1">
                {item.cta} <ChevronRight size={14} aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </WidgetShell>
  )
}

// ── Thành viên rủi ro ─────────────────────────────────────────────────────────
/** Dùng `useScopedAlerts('HEAD')` nên dữ liệu đã giới hạn trong đơn vị của người đang xem. */
export function HeadAtRiskWidget() {
  const { orgUnitId, daysRemaining, organization } = useHeadDashboard()
  const { alerts, isLoading } = useScopedAlerts('HEAD', {
    orgUnitId,
    daysRemaining,
    lowScoreThreshold: (organization?.evaluationMaxScore ?? 100) * 0.6,
  })

  const memberAlerts = useMemo(() => alerts.filter(a => a.kind === 'EMPLOYEE').slice(0, 10), [alerts])

  return (
    <WidgetShell
      title="Thành viên cần chú ý"
      icon={<AlertCircle size={17} />}
      isLoading={isLoading}
      isEmpty={memberAlerts.length === 0}
      emptyMessage="Không có thành viên nào đang gặp vấn đề."
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
        {memberAlerts.map(alert => (
          <li key={alert.id} className="py-3 flex items-start gap-3">
            <span className={cn(
              'shrink-0 mt-0.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider',
              alert.severity === 'URGENT' ? 'bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300'
                : alert.severity === 'REVIEW' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            )}>
              {alert.severity === 'URGENT' ? 'Gấp' : alert.severity === 'REVIEW' ? 'Xem xét' : 'Theo dõi'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{alert.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{alert.reasons.join(' · ')}</p>
            </div>
            {alert.employee && (
              <Link
                to={`/employees/${alert.employee.userId}/performance`}
                aria-label={`Xem hiệu suất của ${alert.employee.fullName}`}
                className="shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </WidgetShell>
  )
}

// ── Độ phủ giao KPI ───────────────────────────────────────────────────────────
/** Điểm mù hay gặp: có người trong đơn vị chưa được giao KPI nào nên không xuất hiện ở đâu cả. */
export function HeadCoverageWidget() {
  const { allEmployees, isEmployeesLoading } = useHeadDashboard()

  const uncovered = useMemo(() => allEmployees.filter(e => e.assignedKpi === 0), [allEmployees])
  const total = allEmployees.length
  const coveredPercent = total > 0 ? Math.round(((total - uncovered.length) / total) * 100) : 0

  return (
    <WidgetShell
      title="Độ phủ giao KPI"
      icon={<UserX size={17} />}
      isLoading={isEmployeesLoading}
      isEmpty={total === 0}
      emptyMessage="Chưa có nhân sự nào trong đơn vị."
    >
      <div className="shrink-0 mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-3xl font-black tabular-nums text-slate-900 dark:text-white">{coveredPercent}%</span>
          <span className="text-xs font-bold text-slate-500 tabular-nums">{total - uncovered.length}/{total} người đã có KPI</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700 motion-reduce:transition-none', coveredPercent >= 90 ? 'bg-emerald-500' : coveredPercent >= 60 ? 'bg-amber-500' : 'bg-red-500')}
            style={{ width: `${coveredPercent}%` }}
          />
        </div>
      </div>

      {uncovered.length === 0 ? (
        <p className="flex-1 flex items-center justify-center text-sm text-slate-400 text-center px-4">
          Mọi thành viên đều đã được giao KPI.
        </p>
      ) : (
        <>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 shrink-0">
            Chưa được giao ({uncovered.length})
          </p>
          <ul className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
            {uncovered.map(e => (
              <li key={e.userId} className="flex items-center gap-2.5 py-1.5">
                <UserAvatar
                  fullName={e.fullName} avatarUrl={e.avatarUrl}
                  className="w-7 h-7 rounded-lg shrink-0"
                  fallbackClassName="bg-slate-100 dark:bg-slate-800 font-black text-[9px] text-slate-500"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{e.fullName}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </WidgetShell>
  )
}


function Tile({ label, value, tone }: { label: string; value: string | number; tone: 'indigo' | 'emerald' | 'red' | 'blue' }) {
  const tones = {
    indigo: 'text-indigo-600 dark:text-indigo-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-red-600 dark:text-red-400',
    blue: 'text-blue-600 dark:text-blue-400',
  }
  return (
    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
      <p className={cn('text-2xl font-black tabular-nums', tones[tone])}>{value}</p>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{label}</p>
    </div>
  )
}

// ── Trạng thái báo cáo ────────────────────────────────────────────────────────
export function HeadSubmissionStatusWidget() {
  const { pendingSub, approvedSub, rejectedSub, totalSubCount, approvalRate, isStatsLoading } = useHeadDashboard()

  return (
    <WidgetShell
      title="Trạng thái báo cáo"
      icon={<BarChart3 size={17} />}
      isLoading={isStatsLoading}
      isEmpty={totalSubCount === 0}
      emptyMessage="Chưa có báo cáo nào trong đơn vị."
    >
      <div className="flex-1 flex flex-col justify-between gap-5 min-h-0">
        <div className="relative w-full aspect-square max-w-[150px] mx-auto shrink-0">
          <SubmissionStatusChart pending={pendingSub} approved={approvedSub} rejected={rejectedSub} />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-3xl font-black text-slate-900 dark:text-white leading-none tabular-nums">{totalSubCount}</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Tổng nộp</span>
          </div>
        </div>

        <div className="space-y-2.5">
          <MetricRow label="Đã phê duyệt" value={approvedSub} total={totalSubCount} color="emerald" icon={<CheckCircle size={13} />} />
          <MetricRow label="Đang chờ duyệt" value={pendingSub} total={totalSubCount} color="amber" icon={<Clock size={13} />} />
          <MetricRow label="Bị từ chối" value={rejectedSub} total={totalSubCount} color="rose" icon={<AlertCircle size={13} />} />
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tỷ lệ duyệt</p>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{approvalRate}%</span>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cần xử lý</p>
            <span className={cn('text-xl font-black tabular-nums', pendingSub > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400')}>{pendingSub}</span>
          </div>
        </div>
      </div>
    </WidgetShell>
  )
}

function MetricRow({ label, value, total, color, icon }: {
  label: string; value: number; total: number; color: 'emerald' | 'amber' | 'rose'; icon: React.ReactNode
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  const text = { emerald: 'text-emerald-500', amber: 'text-amber-500', rose: 'text-rose-500' }[color]
  const bar = { emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500' }[color]

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-end">
        <span className="flex items-center gap-2">
          <span className={text} aria-hidden="true">{icon}</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
        </span>
        <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums">{value}</span>
      </div>
      <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700 motion-reduce:transition-none', bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Hiệu suất đội ngũ ─────────────────────────────────────────────────────────
export function HeadTeamWidget() {
  const {
    employees, page, setPage, totalEmployeePages, totalEmployees, isEmployeesLoading,
    orgUnitId, unitName, activePeriod, organization, levelOrder,
  } = useHeadDashboard()
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    if (!activePeriod) { toast.error('Không xác định được chu kỳ hiện tại'); return }
    setIsExporting(true)
    try {
      const detailed = await statsApi.getDetailedExportStats(orgUnitId, activePeriod.id)
      if (!detailed?.length) { toast.error('Không có dữ liệu chi tiết để xuất'); return }
      await exportDetailedPerformanceToExcel(
        detailed,
        levelOrder ?? 3,
        `BÁO CÁO CHI TIẾT KPI - ${unitName.toUpperCase()} - ${activePeriod.name.toUpperCase()}`,
        organization?.enableOkr
      )
      toast.success('Đã xuất báo cáo chi tiết thành công')
    } catch (err) {
      console.error('Export error:', err)
      toast.error('Có lỗi xảy ra khi xuất báo cáo chi tiết')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <WidgetShell
      title="Hiệu suất đội ngũ"
      icon={<Users size={17} />}
      isLoading={isEmployeesLoading}
      isEmpty={employees.length === 0}
      emptyMessage="Chưa có nhân sự nào trong đơn vị."
      actions={
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 min-h-[36px] px-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors cursor-pointer"
        >
          {isExporting
            ? <span className="w-3 h-3 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" aria-hidden="true" />
            : <FileText size={13} aria-hidden="true" />}
          {isExporting ? 'Đang xuất…' : 'Xuất Excel'}
        </button>
      }
    >
      <div className="flex-1 overflow-auto custom-scrollbar min-h-0">
        {/* Bảng ở desktop */}
        <table className="hidden md:table w-full text-left border-collapse">
          <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
            <tr>
              <th scope="col" className="py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Thành viên</th>
              <th scope="col" className="py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Tiến độ</th>
              <th scope="col" className="py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Trạng thái</th>
              <th scope="col" className="py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Điểm TB</th>
              <th scope="col" className="py-3"><span className="sr-only">Xem chi tiết</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {employees.map((emp: EmployeeKpiStats) => (
              <tr key={emp.userId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar
                      fullName={emp.fullName} avatarUrl={emp.avatarUrl}
                      className="w-9 h-9 rounded-xl shrink-0"
                      fallbackClassName="bg-slate-100 dark:bg-slate-800 font-black text-[10px] text-slate-500"
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] font-black text-slate-900 dark:text-white truncate">{emp.fullName}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase truncate">{emp.orgUnitName}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3"><ProgressCell emp={emp} /></td>
                <td className="py-3 px-3 text-center"><LateBadge count={emp.lateSubmissions} /></td>
                <td className="py-3 px-3 text-center"><ScoreBadge score={emp.averageScore} /></td>
                <td className="py-3 text-right">
                  <Link
                    to={`/employees/${emp.userId}/performance`}
                    aria-label={`Xem hiệu suất của ${emp.fullName}`}
                    className="inline-flex min-w-[36px] min-h-[36px] items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <ChevronRight size={17} aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Thẻ ở mobile — bảng 5 cột không đọc được ở 375px */}
        <ul className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {employees.map((emp: EmployeeKpiStats) => (
            <li key={emp.userId} className="py-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    fullName={emp.fullName} avatarUrl={emp.avatarUrl}
                    className="w-10 h-10 rounded-xl shrink-0"
                    fallbackClassName="bg-slate-100 dark:bg-slate-800 font-black text-[10px] text-slate-500"
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-black text-slate-900 dark:text-white truncate">{emp.fullName}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase truncate">{emp.orgUnitName}</p>
                  </div>
                </div>
                <Link
                  to={`/employees/${emp.userId}/performance`}
                  aria-label={`Xem hiệu suất của ${emp.fullName}`}
                  className="shrink-0 inline-flex min-w-[44px] min-h-[44px] items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <ChevronRight size={18} aria-hidden="true" />
                </Link>
              </div>
              <ProgressCell emp={emp} />
              <div className="flex items-center justify-between gap-2">
                <LateBadge count={emp.lateSubmissions} />
                <ScoreBadge score={emp.averageScore} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {totalEmployeePages > 1 && (
        <div className="pt-3 mt-1 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <Pagination
            currentPage={page} totalPages={totalEmployeePages} totalElements={totalEmployees}
            size={EMPLOYEE_PAGE_SIZE} onPageChange={setPage}
          />
        </div>
      )}
    </WidgetShell>
  )
}

function ProgressCell({ emp }: { emp: EmployeeKpiStats }) {
  const ratio = emp.assignedKpi > 0 ? emp.approvedSubmissions / emp.assignedKpi : 0
  const pct = Math.round(ratio * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 md:max-w-[100px] md:mx-auto h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700 motion-reduce:transition-none', ratio >= 0.8 ? 'bg-emerald-500' : ratio >= 0.4 ? 'bg-amber-500' : 'bg-rose-500')}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className="text-[10px] font-black text-slate-500 tabular-nums shrink-0">{emp.approvedSubmissions}/{emp.assignedKpi}</span>
    </div>
  )
}

function LateBadge({ count }: { count: number }) {
  return count > 0
    ? <span className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-900/25 text-rose-700 dark:text-rose-300 text-[9px] font-black uppercase whitespace-nowrap">Trễ {count} bài</span>
    : <span className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/25 text-emerald-700 dark:text-emerald-300 text-[9px] font-black uppercase whitespace-nowrap">Đúng hạn</span>
}

// ── Việc của chính tôi ────────────────────────────────────────────────────────
/**
 * Trưởng đơn vị cũng có KPI riêng, nhưng hôm nay phải chuyển sang "Dashboard cá nhân"
 * mới thấy. Đây là bản rút gọn để họ không bỏ sót việc của mình.
 */
export function HeadMyWorkWidget() {
  const { data, isLoading, error, refetch } = useMyKpiProgress(0, 5)
  const tasks = data?.tasks?.content ?? []
  const overdue = tasks.filter(t => t.status === 'OVERDUE').length

  return (
    <WidgetShell
      title="Việc của chính tôi"
      icon={<Target size={17} />}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={!isLoading && (data?.totalAssignedKpi ?? 0) === 0}
      emptyMessage="Bạn chưa được giao KPI cá nhân nào."
      actions={
        <Link
          to="/dashboard?view=staff"
          className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
        >
          Xem đầy đủ
        </Link>
      }
    >
      <div className="grid grid-cols-3 gap-3 shrink-0 mb-4">
        <Tile label="Được giao" value={data?.totalAssignedKpi ?? 0} tone="indigo" />
        <Tile label="Chờ duyệt" value={data?.pendingSubmissions ?? 0} tone="blue" />
        <Tile label="Quá hạn" value={overdue} tone={overdue > 0 ? 'red' : 'emerald'} />
      </div>

      <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
        {tasks.slice(0, 5).map(t => (
          <li key={t.id} className="py-2.5 flex items-center gap-3">
            <span className="min-w-0 flex-1 text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{t.name}</span>
            <span className={cn(
              'shrink-0 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider',
              t.status === 'OVERDUE'
                ? 'bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            )}>
              {t.status === 'OVERDUE' ? 'Quá hạn' : t.periodName}
            </span>
          </li>
        ))}
      </ul>
    </WidgetShell>
  )
}

function ScoreBadge({ score }: { score: number | null }) {
  return (
    <span className={cn(
      'px-2 py-1 rounded-lg text-[11px] font-black tabular-nums',
      (score ?? 0) >= 80
        ? 'bg-emerald-50 dark:bg-emerald-900/25 text-emerald-700 dark:text-emerald-300'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
    )}>
      {score !== null ? score.toFixed(1) : '—'}
    </span>
  )
}
