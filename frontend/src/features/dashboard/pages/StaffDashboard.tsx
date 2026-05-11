import { useState, useMemo, useEffect, type ReactNode } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import StatusBadge from '@/components/common/StatusBadge'
import { useMyKpiProgress } from '../hooks/useMyKpiProgress'
import { useMySubmissions } from '@/features/submissions/hooks/useMySubmissions'
import { useAuthStore } from '@/store/authStore'
import { Link } from 'react-router-dom'
import { getInitials, formatDateTime, cn } from '@/lib/utils'
import type { KpiTask } from '@/types/stats'
import { useMyKpi } from '@/features/kpi/hooks/useMyKpi'
import {
  Calendar, Zap, Pin, PinOff, Star, Target, TrendingUp, Award,
  Plus, Clock, FileText, CheckCircle, Pencil, ChevronLeft, ChevronRight, ArrowUpRight
} from 'lucide-react'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useEvaluations } from '@/features/evaluations/hooks/useEvaluations'
import EvaluationFormModal from '@/features/evaluations/components/EvaluationFormModal'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { reportApi } from '@/features/reports/api/reportApi'
import { toast } from 'sonner'
import { 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts'
import type { ReportWidget } from '@/types/datasource'
import { useSummaryTrend, useSummaryComparison, useSummaryRisks, useSummaryStats, useMyAnalytics } from '@/features/analytics/hooks/useAnalytics'
import { useNotifications } from '@/features/notifications/hooks/useNotifications'
import PageTour from '@/components/common/PageTour'
import { staffDashboardSteps } from '@/components/common/tourSteps'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function StaffDashboard() {
  const [taskPage, setTaskPage] = useState(0)
  const taskSize = 10
  const { user } = useAuthStore()
  // const queryClient = useQueryClient()

  const { data: progress, isLoading: progressLoading } = useMyKpiProgress(taskPage, taskSize)
  const { data: submissions, isLoading: subLoading } = useMySubmissions({ page: 0, size: 10 })
  const { data: allSubmissions } = useMySubmissions({ size: 100 })
  const { data: myKpis } = useMyKpi({ size: 100 })
  const { data: periodsData } = useKpiPeriods({ organizationId: user?.memberships?.[0]?.organizationId })
  const { data: evaluations } = useEvaluations({ userId: user?.id, size: 50 })

  const { data: pinnedWidgets, isLoading: pinnedLoading, refetch: refetchPinned } = useQuery({
    queryKey: ['reports', 'widgets', 'pinned'],
    queryFn: () => reportApi.getPinnedWidgets(),
  })

  // Auto-popup states
  const [showAutoEval, setShowAutoEval] = useState(false)
  const [hasShownAutoEval, setHasShownAutoEval] = useState(false)

  // Find active period
  const activePeriod = useMemo(() => {
    if (!periodsData?.content) return null
    const now = new Date()
    return periodsData.content.find(p => {
       if (!p.startDate || !p.endDate) return false
       const start = new Date(p.startDate)
       const end = new Date(p.endDate)
       return now >= start && now <= end
    })
  }, [periodsData])

  // 1. Period for auto-popup: Only if 100% completed and not evaluated
  const completedPeriodToEval = useMemo(() => {
    if (!periodsData?.content || !myKpis?.content || !allSubmissions?.content || !evaluations?.content) return null
    
    const sortedPeriods = [...periodsData.content].sort((a, b) => {
      const dateA = new Date(a.endDate || 0).getTime()
      const dateB = new Date(b.endDate || 0).getTime()
      return dateB - dateA
    })

    for (const period of sortedPeriods) {
       if (evaluations.content.some(e => e.kpiPeriodId === period.id)) continue

       const periodKpis = myKpis.content.filter(k => k.kpiPeriodId === period.id)
       if (periodKpis.length === 0) continue

       const isCompleted = periodKpis.every(kpi => {
          const approvedSubs = allSubmissions.content.filter(s => s.kpiCriteriaId === kpi.id && s.status === 'APPROVED')
          return approvedSubs.length >= kpi.expectedSubmissions
       })

       if (isCompleted) return period
    }
    return null
  }, [periodsData, myKpis, allSubmissions, evaluations])

  // 2. Default period for the form (can include active period even if not completed)
  const defaultPeriodForForm = completedPeriodToEval || activePeriod

  // Trigger auto-popup ONLY for completed periods
  useEffect(() => {
    if (completedPeriodToEval && !hasShownAutoEval) {
      setShowAutoEval(true)
      setHasShownAutoEval(true)
    }
  }, [completedPeriodToEval, hasShownAutoEval])

  // Calculate overall average percentage across all KPIs
  const overallAvgScore = useMemo(() => {
    if (!myKpis || !allSubmissions) return '0'
    const kpis = myKpis.content
    const subs = allSubmissions.content
    
    if (kpis.length === 0) return '0'

    const totalPercentage = kpis.reduce((acc, kpi) => {
      const latestSub = subs.find(s => s.kpiCriteriaId === kpi.id)
      if (!latestSub) return acc
      
      const percentage = latestSub.targetValue 
        ? Math.min((latestSub.actualValue / latestSub.targetValue) * 100, 100)
        : (latestSub.actualValue <= 100 ? latestSub.actualValue : 0)
        
      return acc + percentage
    }, 0)

    return (totalPercentage / kpis.length).toFixed(1)
  }, [myKpis, allSubmissions])

  const isLoading = progressLoading || subLoading || pinnedLoading

  if (isLoading) return (
    <div className="max-w-[1440px] mx-auto p-6 space-y-8 animate-pulse">
      <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded-3xl" />
      <div id="tour-staff-stats" className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[1,2,3,4,5].map(i => <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl" />)}
      </div>
      <div id="tour-staff-tasks" className="h-96 bg-slate-100 dark:bg-slate-800 rounded-3xl" />
    </div>
  )

  const totalAssigned = progress?.totalAssignedKpi ?? 0
  const totalSub = progress?.totalSubmissions ?? 0
  const approvedSub = progress?.approvedSubmissions ?? 0
  const lateSub = progress?.lateSubmissions ?? 0
  const tasksData = progress?.tasks
  const tasks = tasksData?.content ?? []
  const totalPages = tasksData?.totalPages ?? 0

  const approvalRate = totalSub > 0 ? Math.round((approvedSub / totalSub) * 100) : 0

  const completedCount = (progress?.pendingSubmissions ?? 0) + (progress?.approvedSubmissions ?? 0) + (progress?.rejectedSubmissions ?? 0)
  const inProgressCount = Math.max(0, totalAssigned - completedCount)

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6 space-y-6 animate-in fade-in duration-500 transition-all">
      <PageTour pageKey="dashboard-staff" steps={staffDashboardSteps} />
      
      {/* Header & Quick Action */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-xl font-black text-white shadow-lg group-hover:rotate-6 transition-transform">
              {getInitials(user?.fullName ?? '')}
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-4 border-white dark:border-slate-900" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Xin chào, <span className="text-indigo-600 dark:text-indigo-400">{user?.fullName?.split(' ').pop()}!</span>
            </h1>
            <p className="text-sm font-medium text-slate-500 flex items-center gap-2 mt-1">
              <Calendar size={14} /> Hôm nay là {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
           <Link 
            id="tour-staff-submit"
            to="/submissions/new" 
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-sm font-black hover:bg-indigo-600 dark:hover:bg-indigo-50 transition-all shadow-md active:scale-95"
          >
            <Plus size={18} /> NỘP KPI MỚI
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      <div id="tour-staff-stats" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard 
          label={inProgressCount > 0 ? `${inProgressCount} Đang thực hiện` : "Mục tiêu KPI"} 
          value={
            <div className="flex items-baseline gap-1.5 overflow-hidden">
              <span className="text-2xl font-black">{completedCount}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase truncate">Hoàn thành</span>
            </div>
          } 
          icon={Target} 
          color="indigo" 
        />
        <StatCard label="Quá hạn" value={lateSub} icon={Clock} color="red" highlight={lateSub > 0} />
        <StatCard label="Tỷ lệ Duyệt" value={`${approvalRate}%`} icon={TrendingUp} color="emerald" />
        <StatCard label="Bài đã nộp" value={totalSub} icon={FileText} color="amber" />
        <StatCard label="Điểm TB" value={`${overallAvgScore}%`} icon={Award} color="blue" />
      </div>

      {/* ===== PINNED WIDGETS ===== */}
      {pinnedWidgets && pinnedWidgets.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Pin size={18} className="text-indigo-600 rotate-45" /> Thống kê đã ghim
            </h3>
          </div>
          <div className="grid grid-cols-12 gap-6">
            {pinnedWidgets.map((widget: ReportWidget) => (
              <PinnedWidgetCard key={widget.id} widget={widget} onUnpin={refetchPinned} />
            ))}
          </div>
        </section>
      )}

      {/* ===== OVERVIEW GRID ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main Section: Tasks */}
        <div id="tour-staff-tasks" className="lg:col-span-8 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Zap size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-900 dark:text-white">Nhiệm vụ tiêu điểm</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cần hoàn thành sớm</p>
                </div>
              </div>
              <div className="px-3 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-[10px] font-black text-indigo-700 dark:text-indigo-300">
                {tasksData?.totalElements ?? 0} MỤC
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {tasks.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} className="text-emerald-500" />
                  </div>
                  <p className="text-lg font-black text-slate-900 dark:text-white">Tuyệt vời!</p>
                  <p className="text-sm text-slate-500 font-medium">Bạn đã hoàn tất mọi nhiệm vụ.</p>
                </div>
              ) : (
                tasks.map((task: KpiTask) => (
                  <div key={task.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all cursor-pointer group">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all group-hover:scale-105",
                        task.status === 'OVERDUE' ? "bg-red-50 text-red-500" :
                        task.status === 'APPROVED' ? "bg-emerald-50 text-emerald-500" :
                        task.status === 'EDIT' ? "bg-amber-50 text-amber-500" :
                        "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      )}>
                        {task.status === 'OVERDUE' ? <Clock size={22} /> :
                         task.status === 'APPROVED' ? <CheckCircle size={22} /> :
                         task.status === 'EDIT' ? <Pencil size={22} /> :
                         <Target size={22} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 transition-colors">
                          {task.name}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{task.periodName}</span>
                          {task.deadline && (
                            <span className={cn(
                              "text-[10px] font-black flex items-center gap-1",
                              task.status === 'OVERDUE' ? "text-red-500" : "text-slate-400"
                            )}>
                              <Calendar size={12} /> {formatDateTime(task.deadline).split(' ')[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Scores Section */}
                      <div className="hidden md:flex items-center gap-4">
                        <ProgressCircle percentage={task.managerScore ?? 0} size={42} strokeWidth={4} color="text-indigo-500" />
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <StatusBadge status={task.status} />
                        {task.submissionCount < task.expectedSubmissions && 
                         task.status !== 'APPROVED' && 
                         task.status !== 'PENDING' && 
                         task.status !== 'REJECTED' && 
                         task.status !== 'EDIT' && 
                         (!task.startDate || new Date(task.startDate) <= new Date()) && (
                          <Link 
                            to={`/submissions/new?kpiId=${task.id}`}
                            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-[10px] font-black hover:bg-indigo-700 transition-all uppercase tracking-widest"
                          >
                            Nộp ngay
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase">Trang {taskPage + 1} / {totalPages}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setTaskPage(p => Math.max(0, p - 1))} disabled={taskPage === 0} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30">
                    <ChevronLeft size={16} />
                  </button>
                  <button onClick={() => setTaskPage(p => Math.min(totalPages - 1, p + 1))} disabled={taskPage >= totalPages - 1} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Activity */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/20">
              <h3 className="font-black text-lg text-slate-900 dark:text-white">Lịch sử bài nộp</h3>
              <Link to="/submissions" className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600">
                <ArrowUpRight size={18} />
              </Link>
            </div>
            
            <div className="p-2 flex-1 max-h-[500px] overflow-y-auto custom-scrollbar">
              {subLoading ? (
                <div className="p-4"><LoadingSkeleton type="table" rows={4} /></div>
              ) : !submissions || submissions.content.length === 0 ? (
                <div className="py-20 text-center opacity-40">
                  <FileText size={48} className="mx-auto mb-4" />
                  <p className="text-sm font-black text-slate-400">Trống</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {submissions.content.map((s) => {
                    const percentage = s.targetValue ? Math.min(Math.round((s.actualValue / s.targetValue) * 100), 100) : (s.actualValue <= 100 ? s.actualValue : 0)
                    return (
                      <Link 
                        key={s.id} 
                        to={`/submissions/${s.id}`} 
                        className="flex items-center gap-3 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-slate-900 dark:text-slate-200 truncate group-hover:text-indigo-600 transition-colors">
                            {s.kpiCriteriaName}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                            {formatDateTime(s.createdAt).split(' ')[0]}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-3 shrink-0">
                          <ProgressCircle percentage={percentage} size={32} strokeWidth={3} />
                          {s.status === 'DRAFT' ? (
                            <Link 
                              to={`/submissions/edit/${s.id}`}
                              className="p-1.5 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 transition-all"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Pencil size={14} />
                            </Link>
                          ) : (
                            <StatusBadge status={s.status} />
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 dark:border-slate-800">
              <Link to="/submissions" className="block w-full py-3 text-center text-[10px] font-black text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all uppercase tracking-widest border border-dashed border-slate-200 dark:border-slate-800">
                Xem tất cả báo cáo
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Completion Auto-Popup */}
      {showAutoEval && defaultPeriodForForm && (
        <EvaluationFormModal 
          open={showAutoEval} 
          onClose={() => setShowAutoEval(false)} 
          initialPeriodId={defaultPeriodForForm.id}
          readOnly={false} // Allow evaluation if not done yet
        />
      )}
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color, highlight }: {
  label: string; value: ReactNode; icon: any; color: string; highlight?: boolean
}) {
  const colorMap: Record<string, { bg: string; icon: string; text: string }> = {
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/30', icon: 'text-indigo-600', text: 'text-indigo-700 dark:text-indigo-300' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/30', icon: 'text-blue-600', text: 'text-blue-700 dark:text-blue-300' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', icon: 'text-emerald-600', text: 'text-emerald-700 dark:text-emerald-300' },
    red: { bg: 'bg-red-50 dark:bg-red-900/30', icon: 'text-red-600', text: 'text-red-700 dark:text-red-300' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-900/30', icon: 'text-amber-600', text: 'text-amber-700 dark:text-amber-300' },
  }
  const c = colorMap[color] ?? colorMap['indigo']!

  return (
    <div className={cn(
      "bg-white dark:bg-slate-900 rounded-2xl border p-5 transition-all hover:shadow-lg relative overflow-hidden group",
      highlight ? "border-red-200 bg-red-50/30 dark:border-red-900/50" : "border-slate-200 dark:border-slate-800"
    )}>
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4 shadow-sm transition-transform group-hover:scale-110", c.bg)}>
        <Icon size={18} className={c.icon} />
      </div>
      <div className={cn(
        "flex items-baseline gap-1.5 truncate",
        highlight ? "text-red-600" : "text-slate-900 dark:text-white"
      )}>
        {typeof value === 'string' || typeof value === 'number' ? (
          <p className="text-2xl font-black tracking-tight">{value}</p>
        ) : (
          value
        )}
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 truncate">{label}</p>
    </div>
  )
}

function ProgressCircle({ percentage, size = 32, strokeWidth = 3, color }: { 
  percentage: number; 
  size?: number; 
  strokeWidth?: number;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference
  
  const defaultColor = () => {
    if (percentage >= 100) return 'text-emerald-500'
    if (percentage >= 70) return 'text-indigo-500'
    if (percentage >= 40) return 'text-blue-500'
    if (percentage > 0) return 'text-amber-500'
    return 'text-slate-200 dark:text-slate-700'
  }

  return (
    <div className="relative inline-flex items-center justify-center shrink-0 transition-transform hover:scale-110 duration-500" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="text-slate-100 dark:text-slate-800"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={cn(color || defaultColor(), "transition-all duration-1000 ease-out")}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <span className="absolute text-[8px] md:text-[10px] font-black text-slate-700 dark:text-slate-300">
        {Math.round(percentage)}%
      </span>
    </div>
  )
}

function PinnedWidgetCard({ widget, onUnpin }: { widget: ReportWidget; onUnpin: () => void }) {
  const queryClient = useQueryClient()
  const handleUnpin = async () => {
    try {
      await reportApi.togglePinWidget(widget.id)
      toast.success("Đã bỏ ghim")
      queryClient.invalidateQueries({ queryKey: ['reports', 'widgets', 'pinned'] })
      onUnpin()
    } catch (err) {
      toast.error("Không thể bỏ ghim")
    }
  }

  const pos = useMemo(() => {
    try {
      return JSON.parse(widget.position)
    } catch {
      return { w: 4, h: 10 }
    }
  }, [widget.position])

  const config = useMemo(() => {
    try {
      return JSON.parse(widget.chartConfig)
    } catch {
      return {}
    }
  }, [widget.chartConfig])

  const colSpan = pos.w || 4
  const height = (pos.h || 10) * 32 + 60 

  return (
    <div 
      className={cn(
        "bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col group transition-all hover:shadow-xl",
        colSpan >= 12 ? "col-span-12" : 
        colSpan >= 8 ? "col-span-12 lg:col-span-8" :
        colSpan >= 6 ? "col-span-12 lg:col-span-6" :
        "col-span-12 md:col-span-6 lg:col-span-4"
      )}
      style={{ height: `${height}px` }}
    >
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
        <h4 className="font-black text-sm text-slate-800 dark:text-white truncate">{widget.title}</h4>
        <button onClick={handleUnpin} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100">
          <PinOff size={14} />
        </button>
      </div>
      <div className="flex-1 p-5 overflow-hidden">
        <PinnedWidgetContent type={widget.widgetType} config={config} />
      </div>
    </div>
  )
}

function PinnedWidgetContent({ type, config }: { type: string, config?: any }) {
  const { data: trendData } = useSummaryTrend()
  const { data: comparisonData } = useSummaryComparison()
  const { data: riskData } = useSummaryRisks()
  const { data: stats } = useSummaryStats()

  const { data: myStats } = useMyAnalytics()
  const { data: notificationsData } = useNotifications(0, 10)

  switch (type) {
    case 'TREND_CHART':
      return (
        <div className="h-full w-full min-h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData || []}>
              <defs><linearGradient id="colorPerfS" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
              <RechartsTooltip />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '10px', fontSize: '10px', fontWeight: 700 }} />
              <Area type="monotone" dataKey="performance" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorPerfS)" name="Hiệu suất (%)" />
              <Area type="monotone" dataKey="kpiCompletion" stroke="#10b981" strokeWidth={3} fillOpacity={0} name="Hoàn thành KPI (%)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )
    case 'TOP_UNITS':
      return (
        <div className="space-y-4 overflow-auto max-h-full pr-2">
          {(comparisonData?.topPerformingUnits || []).map((unit: any, i: number) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-transparent">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs bg-amber-100 text-amber-600">#{i + 1}</div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-xs text-slate-800 dark:text-white truncate">{unit.unitName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${unit.performance}%` }} />
                  </div>
                  <span className="text-[10px] font-black text-indigo-600">{unit.performance.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )
    case 'UNIT_PERFORMANCE':
      return (
        <div className="h-full w-full min-h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={comparisonData?.topPerformingUnits || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="unitName" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
              <RechartsTooltip />
              <Area type="monotone" dataKey="performance" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={3} name="Hiệu suất:" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )
    case 'UNIT_KPI':
      return (
        <div className="h-full w-full min-h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData?.unitKpiData || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="unitName" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
              <RechartsTooltip />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 800, paddingTop: '10px' }} />
              <Bar dataKey="totalKpi" fill="#6366f1" radius={[4, 4, 0, 0]} name="Tổng KPI" barSize={15} />
              <Bar dataKey="approvedKpi" fill="#10b981" radius={[4, 4, 0, 0]} name="Đã duyệt" barSize={15} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )
    case 'MEMBER_DIST':
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center h-full overflow-hidden">
          <div className="h-full min-h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={stats?.memberDistribution || []} 
                  innerRadius="50%" 
                  outerRadius="80%" 
                  paddingAngle={5} 
                  dataKey="value"
                >
                  {(stats?.memberDistribution || []).map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 overflow-auto max-h-full pr-1">
            {(stats?.memberDistribution || []).map((entry: any, index: number) => (
              <div key={entry.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-[10px] font-bold text-slate-500 truncate">{entry.name}</span>
                </div>
                <span className="text-[10px] font-black text-slate-900 dark:text-white shrink-0">{entry.value} người</span>
              </div>
            ))}
          </div>
        </div>
      )
    case 'ROLE_DIST':
      return (
        <div className="h-full w-full min-h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats?.roleDistribution || []} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} />
              <YAxis dataKey="unitName" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} width={70} />
              <RechartsTooltip />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 800, paddingTop: '5px' }} />
              <Bar dataKey="directorCount" stackId="a" fill="#6366f1" name="Giám đốc" barSize={12} />
              <Bar dataKey="headCount" stackId="a" fill="#f59e0b" name="Trưởng phòng" />
              <Bar dataKey="staffCount" stackId="a" fill="#94a3b8" name="Nhân viên" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )
    case 'UNIT_RISK':
      return (
        <div className="h-full flex flex-col">
          <div className="h-[150px] mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskData?.unitRisks || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#fef2f2" />
                <XAxis type="number" hide domain={[0, 100]} />
                <YAxis dataKey="name" type="category" width={60} axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#ef4444' }} />
                <RechartsTooltip />
                <Bar dataKey="performance" fill="#ef4444" radius={[0, 4, 4, 0]} name="Hiệu suất (%)" barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 overflow-auto max-h-full pr-1">
            {(riskData?.unitRisks || []).map((risk: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                <span className="text-[10px] font-black text-slate-800 dark:text-white">{risk.name}</span>
                <span className="text-[10px] font-black text-red-600">{risk.performance.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )
    case 'TOP_STATS_GRID': {
      if (!myStats) return null;
      return (
        <div className="grid grid-cols-2 gap-3 h-full">
          {[
            { label: 'KPI Hoàn thành', val: `${myStats.approvedSubmissions}/${myStats.totalAssignedKpi}`, icon: <Target className="text-indigo-600" size={14} /> },
            { label: 'Điểm TB', val: (myStats.averageScore ?? 0).toFixed(1), icon: <Star className="text-amber-500" size={14} /> },
            { label: 'Tiến độ', val: `${Math.round((myStats.approvedSubmissions / (myStats.totalAssignedKpi || 1)) * 100)}%`, icon: <TrendingUp className="text-emerald-500" size={14} /> },
            { label: 'Bài nộp', val: myStats.totalSubmissions, icon: <FileText className="text-purple-500" size={14} /> }
          ].map((item, i) => (
            <div key={i} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-1 opacity-60">{item.icon} <span className="text-[9px] font-black uppercase">{item.label}</span></div>
              <p className="text-sm font-black text-slate-900 dark:text-white">{item.val}</p>
            </div>
          ))}
        </div>
      )
    }
    case 'PIE': {
      let chartData: any[] = []
      if (config?.metric === 'SUBMISSIONS_STATUS' && myStats) {
        chartData = [
          { name: 'Đã duyệt', value: myStats.approvedSubmissions, color: '#10b981' },
          { name: 'Chờ duyệt', value: myStats.pendingSubmissions, color: '#f59e0b' },
          { name: 'Từ chối', value: myStats.rejectedSubmissions, color: '#ef4444' }
        ]
      } else if (config?.metric === 'NOTIFICATION_STATS' && notificationsData) {
         const unreadCount = notificationsData.content.filter(n => !n.isRead).length
         chartData = [
           { name: 'Đã đọc', value: notificationsData.totalElements - unreadCount, color: '#94a3b8' },
           { name: 'Chưa đọc', value: unreadCount, color: '#6366f1' }
         ]
      }
      return (
        <div className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} innerRadius="40%" outerRadius="70%" paddingAngle={5} dataKey="value">
                {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
              </Pie>
              <RechartsTooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )
    }
    case 'BAR': {
       if (config?.metric === 'KPI_STATUS_DIST' && myStats) {
         const data = [
           { name: 'Đã duyệt', val: myStats.approvedSubmissions },
           { name: 'Chờ duyệt', val: myStats.pendingSubmissions }
         ]
         return (
           <div className="h-full w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={data}>
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} />
                 <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} />
                 <RechartsTooltip />
                 <Bar dataKey="val" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={30} />
               </BarChart>
             </ResponsiveContainer>
           </div>
         )
       }
       return null
    }
    case 'AREA': {
       if (config?.metric === 'EVALUATION_HISTORY' && myStats) {
         const chartData = myStats.evaluationHistory.map(e => ({
            periodName: new Date(e.createdAt).toLocaleDateString('vi-VN'),
            score: e.score
         })).reverse()
         return (
           <div className="h-full w-full">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={chartData}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                 <XAxis dataKey="periodName" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} />
                 <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} />
                 <RechartsTooltip />
                 <Area type="monotone" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} strokeWidth={2} name="Điểm" />
               </AreaChart>
             </ResponsiveContainer>
           </div>
         )
       }
       return null
    }
    case 'TABLE': {
       if (config?.metric === 'KPI_PERFORMANCE' && myStats) {
         return (
           <div className="h-full overflow-auto text-[10px]">
             <table className="w-full">
               <thead><tr className="text-left border-b border-slate-100 dark:border-slate-800 opacity-50"><th className="pb-2">KPI</th><th className="pb-2 text-center">Tiến độ</th></tr></thead>
               <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                 {myStats.kpiItems.slice(0, 5).map((k: any, i: number) => (
                   <tr key={i}><td className="py-2 pr-2 font-bold truncate max-w-[120px]">{k.kpiName}</td><td className="py-2 text-center font-black text-indigo-600">{Math.round(k.completionRate)}%</td></tr>
                 ))}
               </tbody>
             </table>
           </div>
         )
       }
       return null
    }
    default:
      return <div className="h-full flex items-center justify-center text-xs font-bold text-slate-300 italic">Chi tiết biểu đồ xem tại trang Thống kê</div>
  }
}
