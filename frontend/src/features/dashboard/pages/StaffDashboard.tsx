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
  Calendar, Zap, Target, TrendingUp, Award,
  Plus, Clock, FileText, CheckCircle, Pencil, ChevronLeft, ChevronRight, ArrowUpRight
} from 'lucide-react'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useEvaluations } from '@/features/evaluations/hooks/useEvaluations'
import EvaluationFormModal from '@/features/evaluations/components/EvaluationFormModal'
import { useQuery } from '@tanstack/react-query'
import { reportApi } from '@/features/reports/api/reportApi'
import { PinnedWidgetsSection } from '../components/PinnedWidgetsSection'
import PageTour from '@/components/common/PageTour'
import { staffDashboardSteps } from '@/components/common/tourSteps'

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
          return kpi.frequency === 'UNLIMITED' || approvedSubs.length >= kpi.expectedSubmissions
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
      <div id="tour-staff-stats" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
        <StatCard label="Báo cáo đã gửi" value={totalSub} icon={FileText} color="amber" />
        <StatCard label="Điểm TB" value={`${overallAvgScore}%`} icon={Award} color="blue" />
      </div>

      {/* ===== PINNED WIDGETS ===== */}
      <PinnedWidgetsSection widgets={pinnedWidgets} onUnpin={refetchPinned} />

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
                        <div className="flex flex-col items-center">
                          {task.kpiType === 'QUALITATIVE' ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 text-[11px] font-black uppercase tracking-wider border border-teal-100 dark:border-teal-800/50 whitespace-nowrap">
                              ★ {task.qualitativeLevelName ?? 'Chưa chấm'}
                            </span>
                          ) : (
                            <ProgressCircle percentage={task.managerScore ?? 0} size={42} strokeWidth={4} color="text-indigo-500" />
                          )}
                          {task.managerName && (
                            <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tight">
                              {task.managerName.split(' ').pop()} chấm
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <StatusBadge status={task.status} />
                        {task.submissionCount < task.expectedSubmissions &&
                         task.status !== 'APPROVED' &&
                         task.status !== 'PENDING' &&
                         task.status !== 'REJECTED' &&
                         task.status !== 'EDIT' &&
                         task.status !== 'OVERDUE' &&
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
              <h3 className="font-black text-lg text-slate-900 dark:text-white">Lịch sử cập nhật</h3>
              <Link to="/submissions" className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600">
                <ArrowUpRight size={18} />
              </Link>
            </div>
            
            <div className="p-2 flex-1 overflow-y-auto custom-scrollbar">
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
                          {s.kpiType === 'QUALITATIVE' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 text-[10px] font-black uppercase tracking-wider border border-teal-100 dark:border-teal-800/50 whitespace-nowrap">
                              ★ {s.qualitativeLevelName ?? 'Định tính'}
                            </span>
                          ) : (
                            <ProgressCircle percentage={percentage} size={42} strokeWidth={4} />
                          )}
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

