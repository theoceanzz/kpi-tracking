import { useMemo, useState } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import SubmissionStatusChart from '@/components/charts/SubmissionStatusChart'
import Pagination from '@/components/common/Pagination'
import { useOverviewStats } from '../hooks/useOverviewStats'
import { useEmployeeStats } from '../hooks/useEmployeeStats'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useAuthStore } from '@/store/authStore'
import { getInitials, cn } from '@/lib/utils'
import { Link } from 'react-router-dom'
import {
  ClipboardCheck, BarChart3, AlertCircle, Pin, PinOff, FileText, Star, Target, TrendingUp,
  Users, Clock, CheckCircle, ChevronRight
} from 'lucide-react'
import { exportDetailedPerformanceToExcel } from '@/utils/performanceExport'
import { statsApi } from '../api/statsApi'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import type { EmployeeKpiStats } from '@/types/stats'
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
import { headDashboardSteps } from '@/components/common/tourSteps'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function HeadDashboard() {
  const [page, setPage] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const size = 5
  const { user } = useAuthStore()
  // const queryClient = useQueryClient()
  
  const primaryMembership = useMemo(() => {
    const ms = user?.memberships || [];
    if (ms.length <= 1) return ms[0];
    return ms.find(m => (m.levelOrder ?? 0) > 0) || ms[0];
  }, [user?.memberships]);

  const roleLabel = primaryMembership?.roleName || 'Quản lý'

  const orgUnitId = primaryMembership?.orgUnitId

  const { data: stats, isLoading: statsLoading } = useOverviewStats(orgUnitId)
  const { data: employeesPage, isLoading: employeesLoading } = useEmployeeStats(page, size, orgUnitId)

  const { data: pinnedWidgets, isLoading: pinnedLoading, refetch: refetchPinned } = useQuery({
    queryKey: ['reports', 'widgets', 'pinned'],
    queryFn: () => reportApi.getPinnedWidgets(),
  })

  const unitName = primaryMembership?.orgUnitName || 'Đơn vị'

  const isLoading = statsLoading || employeesLoading || pinnedLoading

  const pendingSub = stats?.pendingSubmissions ?? 0
  const approvedSub = stats?.approvedSubmissions ?? 0
  const rejectedSub = stats?.rejectedSubmissions ?? 0
  const totalSubCount = pendingSub + approvedSub + rejectedSub
  const approvalRate = totalSubCount > 0 ? Math.round((approvedSub / totalSubCount) * 100) : 0

  const employees = employeesPage?.content ?? []
  const lateEmployeesCount = stats?.totalUsers ? (employees?.filter(e => e.lateSubmissions > 0).length ?? 0) : 0
  
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: organization } = useOrganization(orgId)
  const { data: periodsData } = useKpiPeriods({ organizationId: orgId })

  const activePeriod = useMemo(() => {
    if (!periodsData?.content) return null
    const now = new Date()
    return periodsData.content.find(p => {
       if (!p.startDate || !p.endDate) return false
       return now >= new Date(p.startDate) && now <= new Date(p.endDate)
    })
  }, [periodsData])

  const handleExport = async () => {
    if (!activePeriod) {
      toast.error('Không xác định được chu kỳ hiện tại')
      return
    }

    setIsExporting(true)
    try {
      const detailedData = await statsApi.getDetailedExportStats(orgUnitId, activePeriod.id)

      if (!detailedData || detailedData.length === 0) {
        toast.error('Không có dữ liệu chi tiết để xuất')
        return
      }

      // Department Head level is usually 3
      const userLevel = primaryMembership?.levelOrder ?? 3
      await exportDetailedPerformanceToExcel(
        detailedData, 
        userLevel, 
        `BÁO CÁO CHI TIẾT KPI - ${unitName.toUpperCase()} - ${activePeriod.name.toUpperCase()}`,
        organization?.enableOkr
      )
      
      toast.success('Đã xuất báo cáo chi tiết thành công')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Có lỗi xảy ra khi xuất báo cáo chi tiết')
    } finally {
      setIsExporting(false)
    }
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] p-6 space-y-6">
        <div className="h-48 rounded-[32px] bg-white dark:bg-slate-900 animate-pulse border border-slate-200 dark:border-slate-800" />
        <div id="tour-dashboard-stats" className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 rounded-2xl bg-white dark:bg-slate-900 animate-pulse border border-slate-200 dark:border-slate-800" />)}
        </div>
        <LoadingSkeleton type="table" rows={8} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] p-4 md:p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-500">
        <PageTour pageKey="dashboard-head" steps={headDashboardSteps} />

        {/* ===== COMPACT HEADER ===== */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 rounded-[32px] blur opacity-50"></div>
          <div className="relative bg-white dark:bg-slate-900 rounded-[28px] p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-2xl font-black text-white shadow-lg">
                    {getInitials(user?.fullName ?? '')}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-md" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest border border-blue-100 dark:border-blue-800/50">
                      {roleLabel}
                    </span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{unitName}</span>
                  </div>
                  <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    Chào {user?.fullName?.split(' ').pop()}!
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
                     Quản lý <span className="text-blue-600 dark:text-blue-400 font-bold">{stats?.totalUsers ?? 0} nhân sự</span> thuộc phòng/team.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Link 
                  id="tour-dashboard-approve-btn" 
                  to={primaryMembership?.roleRank === 1 ? "/evaluations" : "/submissions/org-unit"} 
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-[11px] font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
                >
                  {primaryMembership?.roleRank === 1 ? (
                    <>
                      <Star size={16} className="text-amber-500" /> KẾT QUẢ ĐÁNH GIÁ
                    </>
                  ) : (
                    <>
                      <ClipboardCheck size={16} className="text-blue-600" /> DUYỆT BÁO CÁO
                    </>
                  )}
                </Link>
                {primaryMembership?.roleRank === 0 && (
                  <Link to="/kpi-criteria" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-black hover:scale-105 transition-all shadow-xl active:scale-95">
                    <Target size={16} className="text-blue-400 dark:text-blue-600" /> QUẢN LÝ KPI
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ===== TOP INDICATORS (Smaller) ===== */}
        <div id="tour-dashboard-stats" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Tổng nhân sự" value={stats?.totalUsers ?? 0} sub={unitName} icon={Users} color="blue" />
          <StatCard label="KPI Chờ duyệt" value={stats?.pendingKpi ?? 0} sub="Cần xử lý ngay" icon={Target} color="indigo" link={primaryMembership?.roleRank === 0 ? "/kpi-criteria" : undefined} alert={(stats?.pendingKpi ?? 0) > 0} />
          <StatCard label="Báo cáo mới" value={pendingSub} sub="Chờ đánh giá" icon={Clock} color="amber" link={primaryMembership?.roleRank === 1 ? "/evaluations" : "/submissions/org-unit"} alert={pendingSub > 0} />
          <StatCard label="Vi phạm Deadline" value={lateEmployeesCount} sub="Trễ hạn nộp" icon={AlertCircle} color="rose" alert={lateEmployeesCount > 0} />
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

        {/* ===== MAIN CONTENT ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* LEFT: Charts & Activity */}
          <div id="tour-dashboard-completion" className="lg:col-span-12 xl:col-span-4 space-y-6">
             {/* Submission Status Overview */}
             <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl p-8 relative overflow-hidden h-full flex flex-col">
                <div className="flex flex-col gap-1 mb-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 size={18} className="text-blue-600" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Báo cáo & Phân tích</span>
                    </div>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Trạng thái Báo cáo</h3>
                </div>

                <div className="flex-1 flex flex-col justify-between gap-8">
                  <div className="relative w-full aspect-square max-w-[160px] mx-auto">
                    <SubmissionStatusChart pending={pendingSub} approved={approvedSub} rejected={rejectedSub} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-4xl font-black text-slate-900 dark:text-white leading-none tracking-tighter">{totalSubCount}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Tổng nộp</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <MetricRow label="Đã phê duyệt" value={approvedSub} total={totalSubCount} color="emerald" icon={CheckCircle} />
                    <MetricRow label="Đang chờ duyệt" value={pendingSub} total={totalSubCount} color="amber" icon={Clock} />
                    <MetricRow label="Bị từ chối" value={rejectedSub} total={totalSubCount} color="rose" icon={AlertCircle} />
                  </div>

                  <div className="mt-2 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tỷ lệ duyệt</p>
                      <span className="text-2xl font-black text-emerald-500">{approvalRate}%</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cần xử lý</p>
                      <span className={cn("text-2xl font-black", pendingSub > 0 ? "text-amber-500" : "text-slate-300")}>{pendingSub}</span>
                    </div>
                  </div>
                </div>
             </div>
          </div>

          {/* Employee Table (Clean & Professional) */}
          <div className="lg:col-span-12 xl:col-span-8 flex flex-col">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col h-full">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/20 dark:bg-slate-800/20">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <Users size={18} className="text-blue-600" />
                    <h3 id="tour-dashboard-tabs" className="font-black text-sm uppercase tracking-widest text-slate-900 dark:text-white">Hiệu suất Đội ngũ</h3>
                  </div>
                  <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all disabled:opacity-50"
                  >
                    {isExporting ? (
                      <div className="w-3 h-3 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
                    ) : (
                      <FileText size={14} />
                    )}
                    {isExporting ? 'Đang xuất...' : 'Xuất Excel'}
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-x-auto lg:overflow-x-hidden scrollbar-hide custom-scrollbar">
                <table className="w-full min-w-[700px] lg:min-w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-800/40">
                      <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Thành viên</th>
                      <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Tiến độ</th>
                      <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Trạng thái</th>
                      <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Điểm TB</th>
                      <th className="px-8 py-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {employees.map((emp: EmployeeKpiStats) => (
                      <tr key={emp.userId} className="group hover:bg-slate-100/30 dark:hover:bg-slate-800/30 transition-all duration-300">
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-xs text-slate-500 border border-slate-200 dark:border-slate-700">
                              {getInitials(emp.fullName)}
                            </div>
                            <div>
                              <p className="text-[13px] font-black text-slate-900 dark:text-white">{emp.fullName}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{emp.orgUnitName}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-center gap-1.5">
                            <div className="w-full max-w-[100px] h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                              <div 
                                className={cn(
                                  "h-full rounded-full transition-all duration-1000",
                                  (emp.approvedSubmissions / (emp.assignedKpi || 1)) >= 0.8 ? "bg-emerald-500" : 
                                  (emp.approvedSubmissions / (emp.assignedKpi || 1)) >= 0.4 ? "bg-amber-500" : "bg-rose-500"
                                )}
                                style={{ width: `${emp.assignedKpi > 0 ? (emp.approvedSubmissions / emp.assignedKpi) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-black text-slate-500">{emp.approvedSubmissions}/{emp.assignedKpi}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {emp.lateSubmissions > 0 ? (
                            <span className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-600 text-[9px] font-black uppercase tracking-tighter">Trễ {emp.lateSubmissions} bài</span>
                          ) : (
                            <span className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-[9px] font-black uppercase tracking-tighter">Đúng hạn</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                           <span className={cn(
                             "px-2 py-1 rounded-lg text-[11px] font-black",
                             (emp.averageScore ?? 0) >= 80 ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-600"
                           )}>
                             {emp.averageScore ? emp.averageScore.toFixed(1) : '—'}
                           </span>
                        </td>
                        <td className="px-8 py-4 text-right">
                          <Link to={`/employees/${emp.userId}/performance`} className="p-1.5 text-slate-300 hover:text-blue-600 transition-colors">
                            <ChevronRight size={18} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-slate-800">
                 {employeesPage && (
                   <Pagination currentPage={page} totalPages={employeesPage.totalPages} totalElements={employeesPage.totalElements} size={size} onPageChange={setPage} />
                 )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, icon: Icon, color, link, alert }: {
  label: string; value: number; sub: string; icon: any; color: string; link?: string; alert?: boolean
}) {
  const colorSchemes: Record<string, string> = {
    blue: "from-blue-600 to-blue-700 shadow-blue-500/20",
    indigo: "from-indigo-600 to-indigo-700 shadow-indigo-500/20",
    amber: "from-amber-500 to-orange-600 shadow-amber-500/20",
    rose: "from-rose-500 to-red-600 shadow-rose-500/20",
  }

  const content = (
    <div className="relative group p-6 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 overflow-hidden h-full">
      <div className="relative z-10 flex flex-col justify-between h-full">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br", colorSchemes[color])}>
            <Icon size={20} strokeWidth={2.5} />
          </div>
          {alert && <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />}
        </div>
        <div>
          <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{value}</p>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{label}</p>
          <p className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter truncate">{sub}</p>
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
        emerald: "text-emerald-500",
        amber: "text-amber-500",
        rose: "text-rose-500"
    }
    const barColor = {
        emerald: "bg-emerald-500",
        amber: "bg-amber-500",
        rose: "bg-rose-500"
    }

    return (
        <div className="space-y-1">
            <div className="flex justify-between items-end">
                <div className="flex items-center gap-2">
                    <Icon size={14} className={colorMap[color]} />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                </div>
                <span className="text-xs font-black text-slate-900 dark:text-white">{value}</span>
            </div>
            <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-1000", barColor[color])} style={{ width: `${pct}%` }} />
            </div>
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
  const height = (pos.h || 10) * 32 + 60 // Base height + header

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
              <defs><linearGradient id="colorPerfH" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
              <RechartsTooltip />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '10px', fontSize: '10px', fontWeight: 700 }} />
              <Area type="monotone" dataKey="performance" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorPerfH)" name="Hiệu suất (%)" />
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
    case 'ROLE_DIST': {
      // 1. Extract all unique role names to create Bar components
      const allRoles = new Set<string>();
      stats?.roleDistribution?.forEach((item: any) => {
        item.roles?.forEach((r: any) => allRoles.add(r.roleName));
      });
      const uniqueRoleNames = Array.from(allRoles);

      // 2. Transform data for Recharts (each item needs roleName: count pairs)
      const chartData = stats?.roleDistribution?.map((item: any) => {
        const dataPoint: any = { unitName: item.unitName };
        item.roles?.forEach((r: any) => {
          dataPoint[r.roleName] = r.count;
        });
        return dataPoint;
      }) || [];

      return (
        <div className="h-full w-full min-h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} />
              <YAxis dataKey="unitName" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} width={70} />
              <RechartsTooltip />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 800, paddingTop: '5px' }} />
              {uniqueRoleNames.map((roleName, index) => (
                <Bar 
                  key={roleName} 
                  dataKey={roleName} 
                  stackId="a" 
                  fill={COLORS[index % COLORS.length]} 
                  name={roleName} 
                  barSize={12} 
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
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
