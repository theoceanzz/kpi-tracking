import { useMemo, useState } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import SubmissionStatusChart from '@/components/charts/SubmissionStatusChart'
import Pagination from '@/components/common/Pagination'
import UserAvatar from '@/components/common/UserAvatar'
import { useOverviewStats } from '../hooks/useOverviewStats'
import { useEmployeeStats } from '../hooks/useEmployeeStats'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import { Link } from 'react-router-dom'
import {
  ClipboardCheck, BarChart3, AlertCircle, FileText, Star, Target,
  Users, Clock, CheckCircle, ChevronRight
} from 'lucide-react'
import { exportDetailedPerformanceToExcel } from '@/utils/performanceExport'
import { statsApi } from '../api/statsApi'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import type { EmployeeKpiStats } from '@/types/stats'
import { useQuery } from '@tanstack/react-query'
import { reportApi } from '@/features/reports/api/reportApi'
import { toast } from 'sonner'
import { PinnedWidgetsSection } from '../components/PinnedWidgetsSection'
import PageTour from '@/components/common/PageTour'
import { headDashboardSteps } from '@/components/common/tourSteps'

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
      <div className="max-w-[1400px] mx-auto space-y-6">
        <PageTour pageKey="dashboard-head" steps={headDashboardSteps} />

        {/* ===== COMPACT HEADER ===== */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 rounded-[32px] blur opacity-50"></div>
          <div className="relative bg-white dark:bg-slate-900 rounded-[28px] p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <UserAvatar
                    fullName={user?.fullName}
                    avatarUrl={user?.avatarUrl}
                    className="w-16 h-16 rounded-2xl shadow-lg"
                    fallbackClassName="bg-gradient-to-br from-blue-600 to-indigo-700 text-2xl font-black text-white"
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-md" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest border border-blue-100 dark:border-blue-800/50">
                      {roleLabel}
                    </span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{unitName}</span>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                    Chào {user?.fullName?.split(' ').pop()}!
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-medium whitespace-nowrap">
                     Quản lý <span className="text-blue-600 dark:text-blue-400 font-bold">{stats?.totalUsers ?? 0} nhân sự</span> thuộc phòng/team.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 md:gap-3 w-full lg:w-auto">
                <Link
                  id="tour-dashboard-approve-btn"
                  to={primaryMembership?.roleRank === 1 ? "/evaluations" : "/submissions/org-unit"}
                  className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 md:px-6 py-2.5 md:py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-[10px] md:text-[11px] font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 shadow-sm whitespace-nowrap"
                >
                  {primaryMembership?.roleRank === 1 ? (
                    <>
                      <Star size={14} className="text-amber-500 md:w-4 md:h-4" /> <span className="truncate">KẾT QUẢ ĐÁNH GIÁ</span>
                    </>
                  ) : (
                    <>
                      <ClipboardCheck size={14} className="text-blue-600 md:w-4 md:h-4" /> <span className="truncate">DUYỆT BÁO CÁO</span>
                    </>
                  )}
                </Link>
                {primaryMembership?.roleRank === 0 && (
                  <Link to="/kpi-criteria" className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 md:px-6 py-2.5 md:py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] md:text-[11px] font-black hover:scale-105 transition-all shadow-xl active:scale-95 whitespace-nowrap">
                    <Target size={14} className="text-blue-400 dark:text-blue-600 md:w-4 md:h-4" /> <span className="truncate">QUẢN LÝ KPI</span>
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
        <PinnedWidgetsSection widgets={pinnedWidgets} onUnpin={refetchPinned} />

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
              <div className="p-5 md:p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/20 dark:bg-slate-800/20">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  <Users size={18} className="text-blue-600 shrink-0" />
                  <h3 id="tour-dashboard-tabs" className="font-black text-[11px] md:text-sm uppercase tracking-widest text-slate-900 dark:text-white whitespace-nowrap truncate">Hiệu suất Đội ngũ</h3>
                </div>
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all disabled:opacity-50 shrink-0"
                >
                  {isExporting ? (
                    <div className="w-3 h-3 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
                  ) : (
                    <FileText size={14} />
                  )}
                  <span className="hidden xs:inline">{isExporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
                  {!isExporting && <span className="xs:hidden">XUẤT EXCEL</span>}
                </button>
              </div>
              
              <div className="hidden md:block flex-1 overflow-x-auto lg:overflow-x-hidden scrollbar-hide custom-scrollbar">
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
                            <UserAvatar
                              fullName={emp.fullName}
                              avatarUrl={emp.avatarUrl}
                              className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700"
                              fallbackClassName="bg-slate-100 dark:bg-slate-800 font-black text-xs text-slate-500"
                            />
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

              <div className="md:hidden flex-1 divide-y divide-slate-50 dark:divide-slate-800/50">
                {employees.map((emp: EmployeeKpiStats) => (
                  <div key={emp.userId} className="p-5 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar
                          fullName={emp.fullName}
                          avatarUrl={emp.avatarUrl}
                          className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700"
                          fallbackClassName="bg-slate-100 dark:bg-slate-800 font-black text-xs text-slate-500"
                        />
                        <div className="min-w-0">
                          <p className="text-[13px] font-black text-slate-900 dark:text-white truncate">{emp.fullName}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight truncate">{emp.orgUnitName}</p>
                        </div>
                      </div>
                      <Link to={`/employees/${emp.userId}/performance`} className="p-1.5 text-slate-300 hover:text-blue-600 transition-colors shrink-0">
                        <ChevronRight size={18} />
                      </Link>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            (emp.approvedSubmissions / (emp.assignedKpi || 1)) >= 0.8 ? "bg-emerald-500" :
                            (emp.approvedSubmissions / (emp.assignedKpi || 1)) >= 0.4 ? "bg-amber-500" : "bg-rose-500"
                          )}
                          style={{ width: `${emp.assignedKpi > 0 ? (emp.approvedSubmissions / emp.assignedKpi) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-black text-slate-500 shrink-0">{emp.approvedSubmissions}/{emp.assignedKpi}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                      {emp.lateSubmissions > 0 ? (
                        <span className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-600 text-[9px] font-black uppercase tracking-tighter">Trễ {emp.lateSubmissions} bài</span>
                      ) : (
                        <span className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-[9px] font-black uppercase tracking-tighter">Đúng hạn</span>
                      )}
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[11px] font-black",
                        (emp.averageScore ?? 0) >= 80 ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-600"
                      )}>
                        {emp.averageScore ? emp.averageScore.toFixed(1) : '—'}
                      </span>
                    </div>
                  </div>
                ))}
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


