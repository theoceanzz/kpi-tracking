import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import SubmissionStatusChart from '@/components/charts/SubmissionStatusChart'
import Pagination from '@/components/common/Pagination'
import { useOverviewStats } from '../hooks/useOverviewStats'
import { useEmployeeStats } from '../hooks/useEmployeeStats'
import { useAuthStore } from '@/store/authStore'
import { getInitials, cn } from '@/lib/utils'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import {
  Target, CheckCircle, Clock, 
  Users, Star, ChevronRight,
  ClipboardCheck, BarChart3, AlertCircle
} from 'lucide-react'
import type { EmployeeKpiStats } from '@/types/stats'

export default function HeadDashboard() {
  const [page, setPage] = useState(0)
  const size = 5

  const { data: stats, isLoading: statsLoading } = useOverviewStats()
  const { data: employeesPage, isLoading: employeesLoading } = useEmployeeStats(page, size)
  const { user } = useAuthStore()

  if (statsLoading || employeesLoading) return <div className="p-8"><LoadingSkeleton rows={10} /></div>

  const totalSub = stats?.totalSubmissions ?? 0
  const pendingSub = stats?.pendingSubmissions ?? 0
  const approvedSub = stats?.approvedSubmissions ?? 0
  const rejectedSub = stats?.rejectedSubmissions ?? 0
  const approvalRate = totalSub > 0 ? Math.round((approvedSub / totalSub) * 100) : 0

  const employees = employeesPage?.content ?? []
  const lateEmployeesCount = employees?.filter(e => e.lateSubmissions > 0).length ?? 0
  
  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-10 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ===== PREMIUM HEADER ===== */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-blue-600 rounded-[40px] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
        <div className="relative bg-white dark:bg-slate-900 rounded-[38px] p-8 md:p-12 border border-white/20 dark:border-slate-800/50 shadow-2xl overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-[24px] bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-3xl font-black text-white shadow-2xl transform hover:rotate-6 transition-transform duration-300">
                  {getInitials(user?.fullName ?? '')}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-4 border-white dark:border-slate-900 shadow-sm" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border border-indigo-100 dark:border-indigo-900/30">
                    Department Head
                  </span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white mt-2">
                  Chào buổi sáng, {user?.fullName?.split(' ').pop()}!
                </h1>
                <p className="text-slate-500 dark:text-slate-400 font-medium mt-2 flex items-center gap-2">
                   <Users size={18} className="text-blue-500" /> Giám sát hiệu suất và quản trị đội ngũ
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link to="/submissions/org-unit" className="group flex items-center gap-3 px-8 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-black hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700">
                <ClipboardCheck size={20} className="text-indigo-500" /> 
                DUYỆT BÁO CÁO
              </Link>
              <Link to="/kpi-criteria" className="group flex items-center gap-3 px-8 py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black hover:scale-[1.02] transition-all shadow-2xl active:scale-95">
                <Target size={20} className="text-indigo-400 dark:text-indigo-600" /> 
                QUẢN LÝ KPI
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ===== TOP INDICATORS ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Tổng nhân sự"
          value={stats?.totalUsers ?? 0}
          sub="thành viên đội ngũ"
          icon={Users}
          color="blue"
        />
        <StatCard
          label="KPI Chờ duyệt"
          value={stats?.pendingKpi ?? 0}
          sub="yêu cầu phê duyệt"
          icon={Target}
          color="indigo"
          link="/kpi-criteria"
          alert={(stats?.pendingKpi ?? 0) > 0}
        />
        <StatCard
          label="Báo cáo mới"
          value={pendingSub}
          sub="cần xem xét ngay"
          icon={Clock}
          color="amber"
          link="/submissions/org-unit"
          alert={pendingSub > 0}
        />
        <StatCard
          label="Vi phạm Deadline"
          value={lateEmployeesCount}
          sub="nhân sự trễ hạn"
          icon={AlertCircle}
          color="rose"
          alert={lateEmployeesCount > 0}
        />
      </div>

      {/* ===== MAIN DASHBOARD CONTENT ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Left Col: Submission Insights & Alerts */}
        <div className="xl:col-span-1 space-y-8 flex flex-col">
          
          {/* Submission Status Chart Card */}
          <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-2xl p-10 flex flex-col flex-1 relative overflow-hidden group/card">
            {/* Glossy decorative backgrounds */}
            <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl" />
            
            <div className="flex flex-col gap-1 mb-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 size={18} className="text-indigo-500" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Phân tích Báo cáo</span>
                </div>
                {pendingSub > 0 && (
                  <Link to="/submissions/org-unit" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest border border-amber-500/20 hover:bg-amber-500/20 transition-all">
                    <Clock size={12} /> {pendingSub} Cần Duyệt
                  </Link>
                )}
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">Trạng thái Tổng quan</h3>
            </div>

            <div className="flex-1 flex flex-col justify-between gap-10">
              <div className="relative w-full aspect-square max-w-[180px] mx-auto">
                {/* Visual enhancement for chart */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-emerald-500/5 rounded-full blur-xl" />
                
                <SubmissionStatusChart pending={pendingSub} approved={approvedSub} rejected={rejectedSub} />
                
                {/* Elegant Center Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{totalSub}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">Bản nộp</p>
                  </div>
                </div>
              </div>

              {/* Rich Detailed Metrics */}
              <div className="space-y-4">
                <MetricRow 
                  label="Đã phê duyệt" 
                  value={approvedSub} 
                  total={totalSub} 
                  color="emerald" 
                  icon={CheckCircle} 
                />
                <MetricRow 
                  label="Đang chờ duyệt" 
                  value={pendingSub} 
                  total={totalSub} 
                  color="amber" 
                  icon={Clock} 
                />
                <MetricRow 
                  label="Bị từ chối" 
                  value={rejectedSub} 
                  total={totalSub} 
                  color="rose" 
                  icon={AlertCircle} 
                />
              </div>

              {/* Bottom Quick Summary */}
              <div className="mt-4 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tỷ lệ duyệt</p>
                  <p className="text-xl font-black text-emerald-500">{approvalRate}%</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Cần xử lý</p>
                  <p className={cn("text-xl font-black", pendingSub > 0 ? "text-amber-500" : "text-slate-300")}>{pendingSub}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Actionable Alerts Box */}
          {(pendingSub > 0 || lateEmployeesCount > 0) && (
            <div className="p-8 rounded-[40px] bg-slate-900 dark:bg-indigo-950 text-white shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
               <div className="relative z-10">
                 <div className="flex items-center gap-3 mb-6">
                    <AlertCircle size={22} className="text-rose-400" />
                    <h4 className="text-xs font-black uppercase tracking-[0.2em]">Cần xử lý khẩn cấp</h4>
                 </div>
                 <div className="space-y-3">
                   {pendingSub > 0 && (
                     <Link to="/submissions/org-unit" className="flex items-center justify-between p-4 rounded-2xl bg-white/10 hover:bg-white/20 transition-all group backdrop-blur-sm border border-white/5">
                        <div className="flex items-center gap-4">
                           <Clock size={18} className="text-amber-400" />
                           <span className="text-sm font-bold">{pendingSub} báo cáo cần bạn phê duyệt</span>
                        </div>
                        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                     </Link>
                   )}
                   {lateEmployeesCount > 0 && (
                     <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                        <Users size={18} className="text-rose-400" />
                        <span className="text-sm font-bold">{lateEmployeesCount} nhân sự đang trễ hạn nộp bài</span>
                     </div>
                   )}
                 </div>
               </div>
            </div>
          )}
        </div>

        {/* Right Col: Detailed Employee Tracking */}
        <div className="xl:col-span-2 flex flex-col">
          <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col h-full">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/30 dark:bg-slate-800/20">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/30">
                  <Users size={20} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-widest text-slate-900 dark:text-white">Theo dõi Hiệu suất Nhân sự</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">Dữ liệu thời gian thực của đội ngũ</p>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Thành viên</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 text-center">Tiến độ nộp bài</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 text-center">Trạng thái hạn</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 text-center">Điểm hiệu suất</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {employees?.map((emp: EmployeeKpiStats) => (
                    <tr key={emp.userId} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-all duration-300">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center font-black text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            {getInitials(emp.fullName)}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors duration-300">{emp.fullName}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{emp.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex flex-col items-center">
                          <div className="flex justify-between w-full max-w-[120px] mb-2 px-1">
                             <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">{emp.approvedSubmissions}/{emp.assignedKpi}</span>
                             <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400">{emp.assignedKpi > 0 ? Math.round((emp.approvedSubmissions / emp.assignedKpi) * 100) : 0}%</span>
                          </div>
                          <div className="w-full max-w-[120px] h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 p-[1px]">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-1000 ease-out",
                                (emp.approvedSubmissions / (emp.assignedKpi || 1)) >= 0.8 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : 
                                (emp.approvedSubmissions / (emp.assignedKpi || 1)) >= 0.4 ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" : 
                                "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]"
                              )}
                              style={{ width: `${emp.assignedKpi > 0 ? (emp.approvedSubmissions / emp.assignedKpi) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-6 text-center">
                        {emp.lateSubmissions > 0 ? (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30">
                            <AlertCircle size={14} className="animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Trễ {emp.lateSubmissions} bài</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                            <CheckCircle size={14} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Đúng hạn</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-6 text-center">
                        <div className="flex flex-col items-center">
                           <div className="flex items-center gap-2">
                             <div className={cn(
                               "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm",
                               (emp.averageScore ?? 0) >= 80 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" : 
                               (emp.averageScore ?? 0) >= 50 ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400" : 
                               "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                             )}>
                               {emp.averageScore ? emp.averageScore.toFixed(1) : '—'}
                             </div>
                             <div className="flex flex-col items-start">
                               <Star size={12} className={cn((emp.averageScore ?? 0) > 0 ? "text-amber-400 fill-amber-400" : "text-slate-200")} />
                               <span className="text-[9px] font-bold text-slate-400 uppercase">Điểm TB</span>
                             </div>
                           </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <Link to={`/employees/${emp.userId}/performance`} className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white transition-all duration-300 inline-flex items-center justify-center border border-slate-200 dark:border-slate-700 hover:border-indigo-600 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-90">
                          <ChevronRight size={18} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800">
               {employeesPage && (
                 <Pagination 
                   currentPage={page}
                   totalPages={employeesPage.totalPages}
                   totalElements={employeesPage.totalElements}
                   size={size}
                   onPageChange={setPage}
                 />
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ========== MODULAR SUB-COMPONENTS ========== */

function StatCard({ label, value, sub, icon: Icon, color, link, alert }: {
  label: string; value: number; sub: string; icon: any; color: string; link?: string; alert?: boolean
}) {
  const colorSchemes: Record<string, string> = {
    blue: "from-blue-600 to-indigo-600 shadow-blue-500/20",
    indigo: "from-indigo-600 to-purple-600 shadow-indigo-500/20",
    amber: "from-amber-500 to-orange-600 shadow-amber-500/20",
    rose: "from-rose-500 to-red-600 shadow-rose-500/20",
  }

  const content = (
    <div className="relative group p-7 rounded-[32px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 overflow-hidden h-full">
      {/* Background Glow */}
      <div className={cn("absolute -bottom-4 -right-4 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-700 bg-gradient-to-br", colorSchemes[color])} />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl bg-gradient-to-br", colorSchemes[color])}>
            <Icon size={24} strokeWidth={2.5} />
          </div>
          {alert && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-widest border border-rose-100 dark:border-rose-900/30 animate-pulse">
              Cảnh báo
            </div>
          )}
        </div>
        
        <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter mb-1">{value}</p>
        <div>
          <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">{label}</p>
          <p className="text-[10px] font-bold text-slate-400 mt-0.5">{sub}</p>
        </div>
      </div>
    </div>
  )

  if (link) return <Link to={link} className="block h-full">{content}</Link>
  return <div className="h-full">{content}</div>
}

function MetricRow({ label, value, total, color, icon: Icon }: {
    label: string; value: number; total: number; color: 'emerald' | 'amber' | 'rose'; icon: any
}) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0
    const colorMap = {
        emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
        amber: "bg-amber-500/10 text-amber-600 border-amber-500/20",
        rose: "bg-rose-500/10 text-rose-600 border-rose-500/20"
    }
    const barColor = {
        emerald: "bg-emerald-500",
        amber: "bg-amber-500",
        rose: "bg-rose-500"
    }

    return (
        <div className="flex items-center gap-4 group/row">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 transition-transform group-hover/row:scale-110", colorMap[color])}>
                <Icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-end mb-1.5">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">{label}</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">{value} <span className="text-[10px] text-slate-400 font-bold ml-1">({pct}%)</span></span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-[1px]">
                    <div 
                        className={cn("h-full rounded-full transition-all duration-1000", barColor[color])} 
                        style={{ width: `${pct}%` }} 
                    />
                </div>
            </div>
        </div>
    )
}
