import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Target, Clock, TrendingUp, Gauge, FileText, Award, Zap, CheckCircle, Pencil, Calendar,
  ArrowUpRight, ChevronLeft, ChevronRight, AlertTriangle, CalendarClock,
} from 'lucide-react'
import StatusBadge from '@/components/common/StatusBadge'
import { cn, formatDateTime } from '@/lib/utils'
import type { KpiTask } from '@/types/stats'
import { WidgetShell } from '../../components/WidgetShell'
import { StatCard } from '../shared/StatCard'
import { ProgressCircle } from '../shared/ProgressCircle'
import { useStaffDashboard } from '../../context/StaffDashboardContext'
import { useNow } from '../../hooks/useNow'

/** Số ngày tới hạn được coi là "sắp đến hạn". */
const DEADLINE_WINDOW_DAYS = 7

// ── Dải chỉ số cá nhân ────────────────────────────────────────────────────────
export function StaffStatsWidget() {
  const { progress, isProgressLoading, approvalRate, overallAvgScore, completedCount, inProgressCount, kpiItems } = useStaffDashboard()
  const lateSub = progress?.lateSubmissions ?? 0
  // Trung bình tiến độ thực tế trên các chỉ tiêu có số đo, khác với "đã nộp mấy bài"
  const avgCompletion = kpiItems.length
    ? Math.round(kpiItems.reduce((s, k) => s + k.completionRate, 0) / kpiItems.length)
    : 0

  if (isProgressLoading) return <WidgetShell title="Chỉ số của tôi" isLoading bare><span /></WidgetShell>

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 h-full">
      <StatCard
        label={inProgressCount > 0 ? `${inProgressCount} đang thực hiện` : 'Mục tiêu KPI'}
        value={
          <div className="flex items-baseline gap-1.5 overflow-hidden">
            <span className="text-2xl font-black tabular-nums">{completedCount}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase truncate">hoàn thành</span>
          </div>
        }
        icon={<Target size={18} />}
        color="indigo"
      />
      <StatCard label="Quá hạn" value={lateSub} icon={<Clock size={18} />} color="red" highlight={lateSub > 0} />
      <StatCard label="Tỷ lệ duyệt" value={`${approvalRate}%`} icon={<TrendingUp size={18} />} color="emerald" />
      <StatCard label="Tiến độ chỉ tiêu" value={`${avgCompletion}%`} icon={<Gauge size={18} />} color="amber" />
      <StatCard label="Điểm TB" value={`${overallAvgScore}%`} icon={<Award size={18} />} color="blue" />
    </div>
  )
}

// ── Trạng thái kỳ ─────────────────────────────────────────────────────────────
/**
 * Đặt tiến độ công việc cạnh tiến độ thời gian của kỳ. Chỉ nhìn "đã xong 40%" thì không biết
 * là sớm hay muộn; so với "kỳ đã trôi 80%" thì thấy ngay mình đang chậm.
 */
export function StaffPeriodWidget() {
  const { activePeriod, daysRemaining, periodElapsedPercent, progress, completedCount } = useStaffDashboard()

  if (!activePeriod) {
    return (
      <WidgetShell title="Kỳ đánh giá" icon={<CalendarClock size={17} />} isEmpty emptyMessage="Hiện không có kỳ đánh giá nào đang mở.">
        <span />
      </WidgetShell>
    )
  }

  const totalAssigned = progress?.totalAssignedKpi ?? 0
  const workPercent = totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0
  const isBehind = periodElapsedPercent !== null && workPercent < periodElapsedPercent - 10
  const urgent = daysRemaining !== null && daysRemaining <= DEADLINE_WINDOW_DAYS

  return (
    <WidgetShell title="Kỳ đánh giá" icon={<CalendarClock size={17} />}>
      <div className="flex-1 flex flex-col justify-center gap-5">
        <div>
          <p className="font-black text-lg text-slate-900 dark:text-white truncate">{activePeriod.name}</p>
          <p className={cn('text-xs font-bold mt-1', urgent ? 'text-red-600 dark:text-red-400' : 'text-slate-500')}>
            {daysRemaining === null ? 'Chưa xác định hạn' : `Còn ${daysRemaining} ngày là hết kỳ`}
          </p>
        </div>

        <div className="space-y-3">
          <Bar label="Thời gian đã trôi" percent={periodElapsedPercent ?? 0} tone="slate" />
          <Bar label="Công việc đã xong" percent={workPercent} tone={isBehind ? 'red' : 'indigo'} />
        </div>

        {isBehind && (
          // Không chỉ tô đỏ — nói thẳng vấn đề, vì màu sắc không được là tín hiệu duy nhất
          <p className="flex items-start gap-2 text-xs font-bold text-red-600 dark:text-red-400">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
            Tiến độ công việc đang chậm hơn tiến độ thời gian của kỳ.
          </p>
        )}
      </div>
    </WidgetShell>
  )
}

function Bar({ label, percent, tone }: { label: string; percent: number; tone: 'slate' | 'indigo' | 'red' }) {
  const fill = { slate: 'bg-slate-400', indigo: 'bg-indigo-600', red: 'bg-red-500' }[tone]
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
        <span>{label}</span>
        <span className="tabular-nums text-slate-600 dark:text-slate-300">{percent}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700 motion-reduce:transition-none', fill)} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
    </div>
  )
}

// ── Sắp đến hạn ───────────────────────────────────────────────────────────────
/**
 * Thông tin nhân viên cần nhất mỗi sáng nhưng trước đây chìm trong danh sách nhiệm vụ:
 * cái gì sắp hết hạn, còn mấy ngày, bấm đâu để nộp.
 */
export function StaffDeadlineWidget() {
  const { tasks, isProgressLoading } = useStaffDashboard()
  const now = useNow()

  const upcoming = useMemo(() => {
    const limit = now + DEADLINE_WINDOW_DAYS * 86_400_000
    return tasks
      .filter(t => t.deadline && t.status !== 'APPROVED' && t.status !== 'PENDING')
      .map(t => ({ task: t, at: new Date(t.deadline!).getTime() }))
      .filter(({ at, task }) => task.status === 'OVERDUE' || (at >= now && at <= limit))
      .sort((a, b) => a.at - b.at)
      .slice(0, 8)
  }, [tasks, now])

  return (
    <WidgetShell
      title={`Sắp đến hạn (${DEADLINE_WINDOW_DAYS} ngày)`}
      icon={<CalendarClock size={17} />}
      isLoading={isProgressLoading}
      isEmpty={upcoming.length === 0}
      emptyMessage="Không có nhiệm vụ nào sắp đến hạn. Bạn đang theo kịp tiến độ."
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800 -mx-1">
        {upcoming.map(({ task, at }) => {
          const days = Math.ceil((at - now) / 86_400_000)
          const overdue = task.status === 'OVERDUE' || days < 0
          return (
            <li key={task.id} className="flex items-center gap-3 py-3 px-1">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{task.name}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5 truncate">{task.periodName}</p>
              </div>
              <span className={cn(
                'shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap',
                overdue
                  ? 'bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300'
                  : days <= 2
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              )}>
                {overdue ? 'Quá hạn' : days === 0 ? 'Hôm nay' : `Còn ${days} ngày`}
              </span>
              <Link
                to={`/submissions/new?kpiId=${task.id}`}
                className="shrink-0 min-h-[36px] px-3 flex items-center rounded-lg bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
              >
                Nộp
              </Link>
            </li>
          )
        })}
      </ul>
    </WidgetShell>
  )
}

// ── Bài nộp bị từ chối ────────────────────────────────────────────────────────
/** Bài bị từ chối là việc phải làm lại, nhưng trước đây nằm lẫn trong lịch sử chung. */
export function StaffRejectedWidget() {
  const { allSubmissions, isSubmissionsLoading } = useStaffDashboard()
  const rejected = useMemo(() => allSubmissions.filter(s => s.status === 'REJECTED').slice(0, 8), [allSubmissions])

  return (
    <WidgetShell
      title="Cần sửa & nộp lại"
      icon={<AlertTriangle size={17} />}
      isLoading={isSubmissionsLoading}
      isEmpty={rejected.length === 0}
      emptyMessage="Không có bài nộp nào bị từ chối."
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
        {rejected.map(s => (
          <li key={s.id}>
            <Link
              to={`/submissions/edit/${s.id}`}
              className="block p-3 rounded-2xl border border-red-100 dark:border-red-900/40 bg-red-50/40 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors"
            >
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{s.kpiCriteriaName}</p>
              {s.reviewNote && (
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                  <span className="font-black uppercase tracking-wider text-[10px] text-red-600 dark:text-red-400">Lý do: </span>
                  {s.reviewNote}
                </p>
              )}
              <p className="text-[10px] font-bold text-slate-400 mt-1.5">
                {s.reviewedByName ? `${s.reviewedByName} từ chối` : 'Đã bị từ chối'}
                {s.reviewedAt ? ` · ${formatDateTime(s.reviewedAt).split(' ')[0]}` : ''}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </WidgetShell>
  )
}

// ── Nhiệm vụ tiêu điểm ────────────────────────────────────────────────────────
export function StaffTasksWidget() {
  const { tasks, isProgressLoading } = useStaffDashboard()
  const now = useNow()
  const [page, setPage] = useState(0)

  /**
   * Bỏ những việc đã nằm trong widget "Sắp đến hạn" (quá hạn hoặc hạn trong 7 ngày).
   * Hai widget cạnh nhau mà lặp lại cùng một dòng thì người dùng phải tự lọc bằng mắt.
   */
  const remaining = useMemo(() => {
    const limit = now + DEADLINE_WINDOW_DAYS * 86_400_000
    return tasks.filter(t => {
      if (t.status === 'OVERDUE') return false
      if (!t.deadline) return true
      return new Date(t.deadline).getTime() > limit
    })
  }, [tasks, now])

  const pageSize = 6
  const totalPages = Math.ceil(remaining.length / pageSize)
  const visible = remaining.slice(page * pageSize, page * pageSize + pageSize)

  return (
    <WidgetShell
      title="Nhiệm vụ còn lại"
      icon={<Zap size={17} />}
      isLoading={isProgressLoading}
      isEmpty={remaining.length === 0}
      emptyMessage="Không còn nhiệm vụ nào ngoài các việc sắp đến hạn."
      actions={
        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-[10px] font-black text-indigo-700 dark:text-indigo-300 tabular-nums">
          {remaining.length} MỤC
        </span>
      }
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
        {visible.map((task: KpiTask) => (
          <li key={task.id} className="py-3 flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
              task.status === 'OVERDUE' ? 'bg-red-50 text-red-500 dark:bg-red-900/25'
                : task.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/25'
                : task.status === 'EDIT' ? 'bg-amber-50 text-amber-500 dark:bg-amber-900/25'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            )} aria-hidden="true">
              {task.status === 'OVERDUE' ? <Clock size={19} />
                : task.status === 'APPROVED' ? <CheckCircle size={19} />
                : task.status === 'EDIT' ? <Pencil size={19} />
                : <Target size={19} />}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{task.name}</p>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{task.periodName}</span>
                {task.deadline && (
                  <span className={cn('text-[10px] font-black flex items-center gap-1 shrink-0', task.status === 'OVERDUE' ? 'text-red-500' : 'text-slate-400')}>
                    <Calendar size={11} aria-hidden="true" /> {formatDateTime(task.deadline).split(' ')[0]}
                  </span>
                )}
              </div>
            </div>

            <div className="hidden sm:block shrink-0">
              {task.kpiType === 'QUALITATIVE' ? (
                <span className="inline-flex px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                  {task.qualitativeLevelName ?? 'Chưa chấm'}
                </span>
              ) : (
                <ProgressCircle percentage={task.managerScore ?? 0} size={38} strokeWidth={4} />
              )}
            </div>

            <div className="shrink-0"><StatusBadge status={task.status} /></div>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="pt-3 mt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-black text-slate-400 uppercase tabular-nums">Trang {page + 1} / {totalPages}</span>
          <div className="flex items-center gap-2">
            <PagerButton label="Trang trước" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}><ChevronLeft size={16} aria-hidden="true" /></PagerButton>
            <PagerButton label="Trang sau" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}><ChevronRight size={16} aria-hidden="true" /></PagerButton>
          </div>
        </div>
      )}
    </WidgetShell>
  )
}

function PagerButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
    >
      {children}
    </button>
  )
}

// ── Lịch sử cập nhật ──────────────────────────────────────────────────────────
export function StaffHistoryWidget() {
  const { submissions, isSubmissionsLoading } = useStaffDashboard()
  // Bài bị từ chối đã có widget "Cần sửa & nộp lại" lo; ở đây chỉ là nhật ký hoạt động
  const items = useMemo(() => submissions.filter(s => s.status !== 'REJECTED'), [submissions])

  return (
    <WidgetShell
      title="Lịch sử cập nhật"
      icon={<FileText size={17} />}
      isLoading={isSubmissionsLoading}
      isEmpty={items.length === 0}
      emptyMessage="Bạn chưa gửi báo cáo nào."
      actions={
        <Link
          to="/me?section=my-submissions"
          aria-label="Xem tất cả báo cáo"
          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      }
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
        {items.map(s => {
          const percentage = s.targetValue
            ? Math.min(Math.round((s.actualValue / s.targetValue) * 100), 100)
            : (s.actualValue <= 100 ? s.actualValue : 0)
          return (
            <li key={s.id}>
              <Link
                to={`/submissions/${s.id}`}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-900 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {s.kpiCriteriaName}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">{formatDateTime(s.createdAt).split(' ')[0]}</p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  {s.kpiType === 'QUALITATIVE' ? (
                    <span className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                      {s.qualitativeLevelName ?? 'Định tính'}
                    </span>
                  ) : (
                    <ProgressCircle percentage={percentage} size={38} strokeWidth={4} />
                  )}
                  <StatusBadge status={s.status} />
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </WidgetShell>
  )
}
