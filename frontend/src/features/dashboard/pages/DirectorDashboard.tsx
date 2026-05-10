import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useOverviewStats } from '../hooks/useOverviewStats'
import { useOrgUnitStats } from '../hooks/useOrgUnitStats'
import { useEmployeeStats } from '../hooks/useEmployeeStats'
import { Link } from 'react-router-dom'
import { cn, getInitials } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { reportApi } from '@/features/reports/api/reportApi'
import { toast } from 'sonner'
import type { OrgUnitStats, EmployeeKpiStats } from '@/types/stats'
import { exportPerformanceToExcel } from '@/utils/performanceExport'
import type { ReportWidget } from '@/types/datasource'
import { useSummaryTrend, useSummaryComparison, useSummaryRisks, useSummaryStats } from '@/features/analytics/hooks/useAnalytics'
import {
  Users, Target, FileText,
  Clock, BarChart3, ShieldCheck, Building2,
  ChevronRight, Search, 
  ChevronLeft, ArrowUpRight, Pin, PinOff, TriangleAlert, Award
} from 'lucide-react'
import { 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, Legend, Tooltip
} from 'recharts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import StaffPerformanceDetailModal from '@/features/submissions/components/StaffPerformanceDetailModal'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

type TabView = 'overview' | 'orgUnits' | 'employees'

export default function DirectorDashboard() {
  const [empPage, setEmpPage] = useState(0)
  const [alertPage, setAlertPage] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [activeTab, setActiveTab] = useState<TabView>('overview')
  const [empSearch, setEmpSearch] = useState('')
  const [evaluatingUser, setEvaluatingUser] = useState<{ id: string, name: string } | null>(null)
  const [hoveredEmpId, setHoveredEmpId] = useState<string | null>(null)
  const [showRadialTooltip, setShowRadialTooltip] = useState(false)
  const { user } = useAuthStore()
  const [orgUnitFilter, setOrgUnitFilter] = useState<string>(user?.memberships?.[0]?.orgUnitId || 'ALL')
  const empSize = 10

  const { data: stats, isLoading: loadingStats } = useOverviewStats()
  const { data: orgUnitStats, isLoading: loadingOrgUnits } = useOrgUnitStats()
  const { data: empStats, isLoading: loadingEmps } = useEmployeeStats(empPage, empSize, orgUnitFilter !== 'ALL' ? orgUnitFilter : undefined)
  const { data: allEmpStats } = useEmployeeStats(0, 500, orgUnitFilter !== 'ALL' ? orgUnitFilter : undefined)

  const { data: pinnedWidgets, isLoading: loadingPinned, refetch: refetchPinned } = useQuery({
    queryKey: ['reports', 'widgets', 'pinned'],
    queryFn: () => reportApi.getPinnedWidgets(),
  })

  useEffect(() => {
    if (orgUnitStats && orgUnitStats.length > 0 && orgUnitFilter === 'ALL') {
      const root = orgUnitStats.find(u => u.parentOrgUnitId === null)
      if (root) setOrgUnitFilter(root.orgUnitId)
    }
  }, [orgUnitStats, orgUnitFilter])

  const orgId = user?.memberships?.[0]?.organizationId
  const { data: periodsData } = useKpiPeriods({ organizationId: orgId })

  const activePeriod = useMemo(() => {
    if (!periodsData?.content) return null
    const now = new Date()
    return periodsData.content.find(p => {
       if (!p.startDate || !p.endDate) return false
       return now >= new Date(p.startDate) && now <= new Date(p.endDate)
    })
  }, [periodsData])

  const daysRemaining = useMemo(() => {
    if (!activePeriod?.endDate) return null
    const diff = new Date(activePeriod.endDate).getTime() - new Date().getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }, [activePeriod])

  const isLoading = loadingStats || loadingOrgUnits || loadingEmps || loadingPinned

  const { companyWeightedAvg, groupRates: groups } = useMemo(() => {
    const emps = allEmpStats?.content || empStats?.content || []
    if (emps.length === 0) return { companyWeightedAvg: 0, groupRates: {} }

    const groups: Record<string, { userId: string, empName: string, rate: number }[]> = {}
    emps.forEach(e => {
      if (e.assignedKpi > 0) {
        const unitName = (e.orgUnitName || 'Chưa gán').trim()
        const rate = e.approvedSubmissions / (e.assignedKpi || 1)
        if (!groups[unitName]) groups[unitName] = []
        groups[unitName].push({ userId: e.userId, empName: e.fullName, rate })
      }
    })

    const deptScores = Object.values(groups).map(members => 
      members.reduce((a, b) => a + b.rate, 0) / members.length
    )

    const avg = deptScores.length === 0 ? 0 : Math.round((deptScores.reduce((a, b) => a + b, 0) / deptScores.length) * 100)
    return { companyWeightedAvg: avg, groupRates: groups }
  }, [allEmpStats, empStats])

  const filteredEmployees = useMemo(() => {
    const list = empStats?.content ?? []
    return list.filter(e =>
      ((e.fullName || '').toLowerCase().includes(empSearch.toLowerCase()) || 
       (e.email || '').toLowerCase().includes(empSearch.toLowerCase()))
    )
  }, [empStats, empSearch, orgUnitFilter])

  const filteredOrgUnits = useMemo(() => {
    if (!orgUnitStats) return []
    // Filter units that have assignments and are NOT the currently selected root unit
    return orgUnitStats.filter(ou => 
      ou.totalAssignments > 0 && 
      (orgUnitFilter === 'ALL' || ou.orgUnitId !== orgUnitFilter)
    )
  }, [orgUnitStats, orgUnitFilter])

  const unitAverageScores = useMemo(() => {
    const unitTotals: Record<string, number> = {}
    const emps = allEmpStats?.content || []
    
    emps.forEach(emp => {
      const name = (emp.orgUnitName || 'Chưa gán').trim()
      const rate = emp.assignedKpi > 0 ? (emp.approvedSubmissions / emp.assignedKpi) * 100 : 0
      unitTotals[name] = (unitTotals[name] || 0) + rate
    })

    const result: Record<string, number> = {}
    orgUnitStats?.forEach(unit => {
      const name = (unit.orgUnitName || 'Chưa gán').trim()
      const totalRate = unitTotals[name] || 0
      const count = unit.memberCount || 1
      result[name] = totalRate / count
    })
    return result
  }, [allEmpStats, orgUnitStats])

  const submissionChartData = [
    { name: 'Đã duyệt', value: stats?.approvedSubmissions ?? 0, color: '#10b981' },
    { name: 'Chờ duyệt', value: stats?.pendingSubmissions ?? 0, color: '#f59e0b' },
    { name: 'Từ chối', value: stats?.rejectedSubmissions ?? 0, color: '#ef4444' },
  ]

  const handleExport = async () => {
    if (!allEmpStats?.content || allEmpStats.content.length === 0) {
      toast.error('Không có dữ liệu để xuất')
      return
    }
    setIsExporting(true)
    try {
      await exportPerformanceToExcel(allEmpStats.content)
      toast.success('Đã xuất báo cáo thành công')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Có lỗi xảy ra khi xuất báo cáo')
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading) return (
    <div className="max-w-[1600px] mx-auto p-8 space-y-8">
      <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-[40px] animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1,2,3,4].map(i => <div key={i} className="h-40 bg-slate-100 dark:bg-slate-800 rounded-[32px] animate-pulse" />)}
      </div>
      <LoadingSkeleton rows={10} />
    </div>
  )

  const tabs: { key: TabView; label: string; icon: any }[] = [
    { key: 'overview', label: 'Tổng quan', icon: BarChart3 },
    { key: 'orgUnits', label: 'Cơ cấu đơn vị', icon: Building2 },
    { key: 'employees', label: 'Bảng nhân sự', icon: Users },
  ]

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-10 animate-in fade-in duration-700">
      
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[32px] blur opacity-10 group-hover:opacity-20 transition duration-1000 group-hover:duration-200"></div>
        <div id="tour-dashboard-header" className="relative flex flex-col lg:flex-row justify-between items-center gap-6 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl"></div>
          
          <div className="flex-1 space-y-3 text-center lg:text-left">
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-slate-900 dark:text-white">
              Hệ thống <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Quản trị Hiệu suất</span>
            </h1>
            <p className="text-slate-500 font-medium text-base max-w-2xl leading-relaxed">
              Dữ liệu tổng quát về KPIs, bài nộp và đánh giá nhân sự. 
              Cập nhật lúc: {new Date().toLocaleTimeString('vi-VN')}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-[24px] border border-slate-100 dark:border-slate-700/50">
            <div className="flex flex-col items-end px-3">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Hôm nay</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {new Date().toLocaleDateString('vi-VN', { day: 'numeric', month: 'long' })}
              </span>
            </div>
            <Link 
              id="tour-dashboard-approve-btn"
              to="/kpi-criteria/pending" 
              className="flex items-center gap-2 px-6 py-3.5 rounded-[20px] bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 transition-all active:scale-95 group"
            >
              <div className="relative">
                <Clock size={18} />
              </div>
              <span className="font-black text-xs uppercase tracking-widest">Duyệt ({stats?.pendingKpi ?? 0})</span>
              <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      <div id="tour-dashboard-stats" className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <PremiumStatCard icon={<Building2 size={20} />} label="Phòng ban" value={stats?.totalOrgUnits ?? 0} color="emerald" trend="Active" />
        <PremiumStatCard icon={<Users size={20} />} label="Nhân sự" value={empStats?.totalElements ?? 0} color="indigo" />
        <PremiumStatCard icon={<Target size={20} />} label="Chỉ tiêu KPI" value={stats?.totalKpiCriteria ?? 0} sub={`${stats?.approvedKpi ?? 0} đã duyệt`} color="blue" />
        <PremiumStatCard icon={<Award size={20} />} label="Đánh giá" value={stats?.totalEvaluations ?? 0} color="purple" />
      </div>

      {activeTab === 'overview' && (
        <>
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {/* Row 1: Key Performance Indicators & Alerts */}
            <div id="tour-dashboard-completion" className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200/60 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative group transition-all hover:shadow-[0_20px_50px_rgba(99,102,241,0.1)] flex flex-col justify-between min-h-[520px] hover:z-50">
              <div className="absolute top-0 left-0 w-1.5 h-1/2 mt-[25%] bg-gradient-to-b from-indigo-500 to-purple-600 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
              <div className="flex items-center justify-between mb-6">
                <div className="space-y-1">
                  <p className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Tỷ lệ Hoàn thành</p>
                </div>
              </div>

              <div className="flex flex-col items-center flex-1 justify-center py-4">
                <div 
                  onMouseEnter={() => !evaluatingUser && setShowRadialTooltip(true)}
                  onMouseLeave={() => setShowRadialTooltip(false)}
                  className="relative w-64 h-64 flex items-center justify-center group/radial cursor-pointer"
                >
                  <div className={cn(
                    "absolute inset-0 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl scale-75 transition-opacity duration-700",
                    showRadialTooltip ? "opacity-100" : "opacity-0"
                  )}></div>
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90 relative z-10">
                    <defs>
                      <linearGradient id="radialGradientD" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="42" stroke="#f1f5f9" strokeWidth="6" fill="transparent" className="dark:stroke-slate-800/50" />
                    <circle 
                      cx="50" cy="50" r="42" 
                      stroke="url(#radialGradientD)" 
                      strokeWidth="6" 
                      fill="transparent" 
                      strokeDasharray={263.8}
                      strokeDashoffset={263.8 - (263.8 * companyWeightedAvg) / 100}
                      strokeLinecap="round"
                      className="transition-all duration-[2000ms] ease-in-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-20 transition-all duration-500 group-hover/radial:scale-110">
                    <div className="relative">
                      <span className="text-7xl font-black tracking-tighter text-slate-900 dark:text-white leading-none drop-shadow-sm">{companyWeightedAvg}%</span>
                      <div className="absolute -top-2 -right-4 w-3 h-3 rounded-full bg-emerald-500 animate-ping"></div>
                    </div>
                  </div>

                  <div className={cn(
                    "absolute top-[80%] left-1/2 -translate-x-1/2 mt-4 w-72 backdrop-blur-xl bg-white/95 dark:bg-slate-900/95 p-5 rounded-[28px] shadow-[0_30px_60px_rgba(0,0,0,0.2)] border border-slate-100 dark:border-slate-800 transition-all duration-300 z-[100]",
                    showRadialTooltip && !evaluatingUser ? "opacity-100 visible translate-y-0" : "opacity-0 invisible translate-y-2"
                  )}>
                      <div className="flex items-center gap-2 mb-4 px-2">
                        <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                        <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Nhân viên đóng góp</span>
                      </div>
                      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                        {Object.values(groups).flat().filter(m => m.rate > 0).length > 0 ? (
                          Object.values(groups).flat().filter(m => m.rate > 0).map((m, i) => (
                            <div 
                              key={`${m.empName}-${i}`} 
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowRadialTooltip(false);
                                setEvaluatingUser({ id: m.userId, name: m.empName });
                              }}
                              className="flex justify-between items-center p-3 rounded-2xl hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 transition-all group/emp border border-transparent hover:border-indigo-100/50 dark:hover:border-indigo-500/20 cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 group-hover/emp:text-slate-900 dark:group-hover/emp:text-white transition-colors">{m.empName}</span>
                              </div>
                              <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-lg">{Math.round(m.rate * 100)}%</span>
                            </div>
                          ))
                        ) : (
                          <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chưa có đóng góp</p>
                          </div>
                        )}
                      </div>
                  </div>
                </div>
              </div>

              <div className="w-full grid grid-cols-2 gap-0 border-t border-slate-100 dark:border-slate-800 pt-6">
                <div className="flex flex-col items-center justify-center space-y-1 border-r border-slate-100 dark:border-slate-800 px-4">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <Building2 size={12} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Cơ cấu Đơn vị</span>
                  </div>
                  <p className="text-base font-black text-slate-900 dark:text-white">{stats?.totalOrgUnits ?? 0} Phòng ban</p>
                </div>
                <div className="flex flex-col items-center justify-center space-y-1 px-4">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <Users size={12} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Đối tượng KPI</span>
                  </div>
                  <p className="text-base font-black text-slate-900 dark:text-white">{(allEmpStats?.content || []).filter(e => e.assignedKpi > 0).length} Nhân sự</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200/60 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative group transition-all hover:shadow-[0_20px_50px_rgba(16,185,129,0.1)] flex flex-col min-h-[520px] hover:z-50">
              <div className="absolute top-0 left-0 w-1.5 h-1/2 mt-[25%] bg-gradient-to-b from-emerald-500 to-teal-600 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
              <div className="flex items-center justify-between mb-8">
                <div className="space-y-1">
                  <p className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Phân tích Bài nộp</p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-500/20">
                  <FileText size={20} />
                </div>
              </div>

              <div className="h-[280px] w-full relative mb-8 flex-1">
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                  <div className="bg-slate-50 dark:bg-slate-800/50 w-28 h-28 rounded-full flex flex-col items-center justify-center border border-slate-100 dark:border-slate-700 shadow-inner">
                    <span className="text-4xl font-black text-slate-900 dark:text-white leading-none tracking-tighter">
                      {(stats?.approvedSubmissions ?? 0) + (stats?.pendingSubmissions ?? 0) + (stats?.rejectedSubmissions ?? 0)}
                    </span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Tổng nộp</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height="100%" className="relative z-10">
                  <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                    <Pie
                      data={submissionChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius="60%"
                      outerRadius="90%"
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                      animationBegin={200}
                      animationDuration={1500}
                    >
                      {submissionChartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color} 
                          className="hover:opacity-80 transition-all duration-300 cursor-pointer"
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }}
                      wrapperStyle={{ zIndex: 1000 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 gap-2 pt-6 border-t border-slate-100 dark:border-slate-800">
                {submissionChartData.map(item => (
                  <div key={item.name} className="flex items-center justify-between p-2.5 rounded-[18px] bg-slate-50 dark:bg-slate-800/40 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all group/item">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]" style={{ backgroundColor: item.color }} />
                      <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-slate-900 dark:text-white">{item.value}</span>
                      <div className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 text-[10px] font-black text-slate-400 border border-slate-100 dark:border-slate-800">
                        {stats?.totalSubmissions ? Math.round((item.value / stats.totalSubmissions) * 100) : 0}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div id="tour-dashboard-alerts" className="bg-gradient-to-br from-indigo-700 via-indigo-800 to-violet-900 p-8 rounded-[40px] shadow-2xl relative transition-all hover:shadow-[0_20px_50px_rgba(99,102,241,0.2)] text-white flex flex-col min-h-[520px] hover:z-50">
              <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 -ml-12 -mb-12 w-48 h-48 bg-white/5 rounded-full blur-3xl"></div>
              
              <div className="relative flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-red-300">
                    <TriangleAlert size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-white">Tiêu điểm Tiêu cực</h3>
                    <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest mt-1">Cần Giám đốc can thiệp</p>
                  </div>
                </div>
                <Link 
                  to="/submissions/org-unit" 
                  className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all active:scale-95 group"
                  title="Quản lý phê duyệt"
                >
                  <ArrowUpRight size={20} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Link>
              </div>

              <div className="relative space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {(() => {
                  const alerts: React.ReactNode[] = []
                  
                  if (stats?.pendingKpi && stats.pendingKpi > 0) {
                    alerts.push(
                      <AlertItem 
                        key="pending-kpi"
                        icon={<Clock size={18} />}
                        title={`${stats.pendingKpi} yêu cầu KPI chờ duyệt`}
                        sub="Ảnh hưởng đến tiến độ toàn công ty"
                        color="red"
                        link="/kpi-criteria/pending"
                      />
                    )
                  }

                  const lowProgressUnits = orgUnitStats?.filter(u => (u.totalAssignments > 0 && (u.totalSubmissions / u.totalAssignments) < 0.3)) || []
                  lowProgressUnits.forEach(unit => {
                    alerts.push(
                      <AlertItem 
                        key={unit.orgUnitId}
                        icon={<Building2 size={18} />}
                        title={`${unit.orgUnitName} tiến độ quá thấp`}
                        sub={`Chỉ mới đạt ${Math.round((unit.totalSubmissions / (unit.totalAssignments || 1)) * 100)}% chỉ tiêu`}
                        color="amber"
                        link={`/org-units/${unit.orgUnitId}`}
                      />
                    )
                  })

                  const incompleteEmps = empStats?.content?.filter(e => e.assignedKpi > 0 && e.approvedSubmissions < e.assignedKpi) || []
                  incompleteEmps.forEach(emp => {
                    alerts.push(
                      <AlertItem 
                        key={emp.userId}
                        icon={<Users size={18} />}
                        title={`${emp.fullName} chưa hoàn thành`}
                        sub={`Giao ${emp.assignedKpi}, còn ${emp.assignedKpi - emp.approvedSubmissions} KPI • ${daysRemaining !== null ? `Còn ${daysRemaining} ngày` : 'N/A'}`}
                        color="blue"
                        link={`/employees/${emp.userId}/performance`}
                      />
                    )
                  })

                  if (alerts.length === 0) {
                    return (
                      <div className="py-12 text-center h-full flex flex-col items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4 text-emerald-400 border border-emerald-500/20">
                          <ShieldCheck size={32} />
                        </div>
                        <p className="text-sm font-bold text-slate-300">Hệ thống đang vận hành ổn định</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-2">Không có cảnh báo mới</p>
                      </div>
                    )
                  }

                  const totalAlertPages = Math.ceil(alerts.length / 5)
                  const pagedAlerts = alerts.slice(alertPage * 5, (alertPage + 1) * 5)

                  return (
                    <div className="space-y-4 flex flex-col h-full">
                      <div className="flex-1 space-y-4">
                        {pagedAlerts}
                      </div>
                      
                      {totalAlertPages > 1 && (
                        <div className="flex items-center justify-between pt-6 border-t border-white/10 mt-auto px-2">
                          <button 
                            onClick={() => setAlertPage(p => Math.max(0, p - 1))}
                            disabled={alertPage === 0}
                            className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-20 transition-all active:scale-90 shadow-lg"
                          >
                            <ChevronLeft size={20} className="text-white" />
                          </button>
                          
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] font-black text-white uppercase tracking-[0.3em] opacity-80">
                              Trang
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-white">{alertPage + 1}</span>
                              <span className="text-[10px] font-black text-white/30">/</span>
                              <span className="text-[10px] font-black text-white/40">{totalAlertPages}</span>
                            </div>
                          </div>

                          <button 
                            onClick={() => setAlertPage(p => Math.min(totalAlertPages - 1, p + 1))}
                            disabled={alertPage >= totalAlertPages - 1}
                            className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-20 transition-all active:scale-90 shadow-lg"
                          >
                            <ChevronRight size={20} className="text-white" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
              

            </div>
          </div>
        </>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div id="tour-dashboard-tabs" className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-[22px]">
            {tabs.map(t => {
              const Icon = t.icon
              const active = activeTab === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={cn(
                    "flex items-center gap-2 px-6 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-[14px] transition-all",
                    active 
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm scale-105" 
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                >
                  <Icon size={16} /> {t.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="animate-in slide-in-from-bottom-4 duration-500">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 gap-8">
                <PremiumRankingTable 
                  employees={allEmpStats?.content || empStats?.content || []} 
                  onSelectUser={(id, name) => setEvaluatingUser({ id, name })}
                  hoveredUserId={hoveredEmpId}
                  onHoverUser={setHoveredEmpId}
                />
            </div>
          )}
          {activeTab === 'orgUnits' && <OrgUnitsGrid units={filteredOrgUnits} averageScores={unitAverageScores} />}
          {activeTab === 'employees' && (
            <EmployeesExecutiveTable 
                employees={filteredEmployees}
                loading={loadingEmps}
                search={empSearch}
                onSearchChange={setEmpSearch}
                page={empPage}
                totalPages={empStats?.totalPages ?? 1}
                onPageChange={setEmpPage}
                onExport={handleExport}
                isExporting={isExporting}
                orgUnitFilter={orgUnitFilter}
                onOrgUnitFilterChange={setOrgUnitFilter}
                orgUnits={orgUnitStats || []}
            />
          )}
        </div>
      </div>

      {evaluatingUser && activePeriod && (
        <StaffPerformanceDetailModal
          open={!!evaluatingUser}
          onClose={() => setEvaluatingUser(null)}
          userId={evaluatingUser.id}
          userName={evaluatingUser.name}
          periodId={activePeriod.id}
          periodName={activePeriod.name}
        />
      )}
    </div>
  )
}

function PremiumStatCard({ icon, label, value, sub, color, trend, progress }: any) {
  const colors: Record<string, string> = {
    indigo: "from-indigo-500/20 to-indigo-600/20 text-indigo-600 dark:text-indigo-400",
    emerald: "from-emerald-500/20 to-emerald-600/20 text-emerald-600 dark:text-emerald-400",
    blue: "from-blue-500/20 to-blue-600/20 text-blue-600 dark:text-blue-400",
    amber: "from-amber-500/20 to-amber-600/20 text-amber-600 dark:text-amber-400",
    purple: "from-purple-500/20 to-purple-600/20 text-purple-600 dark:text-purple-400",
  }

  const iconColors: Record<string, string> = {
    indigo: "bg-indigo-500 shadow-indigo-500/40",
    emerald: "bg-emerald-500 shadow-emerald-500/40",
    blue: "bg-blue-500 shadow-blue-500/40",
    amber: "bg-amber-500 shadow-amber-500/40",
    purple: "bg-purple-500 shadow-purple-500/40",
  }

  return (
    <div className="group relative h-full">
       <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200/60 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 overflow-hidden h-full flex flex-col justify-between">
          <div className={cn("absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br opacity-10 rounded-full transition-all duration-700 group-hover:scale-150 group-hover:opacity-20", colors[color])}></div>
          
          <div>
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-6 text-white bg-gradient-to-br shadow-lg transition-transform duration-500 group-hover:rotate-6", iconColors[color])}>
              {icon}
            </div>
            <div className="space-y-1.5 relative z-10">
               <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">{label}</p>
               <div className="flex items-baseline gap-3">
                  <h4 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white transition-all duration-500 group-hover:tracking-normal">{value}</h4>
                  {trend && (
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-500/20">
                      {trend}
                    </span>
                  )}
               </div>
               {sub && <p className="text-xs font-bold text-slate-500 mt-1">{sub}</p>}
            </div>
          </div>

          {progress != null && (
            <div className="mt-8 pt-5 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>Tiến độ</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-black">{progress}%</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-[1500ms] ease-out shadow-[0_0_8px_rgba(99,102,241,0.4)]" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
       </div>
    </div>
  )
}

function AlertItem({ icon, title, sub, color, link }: { icon: any, title: string, sub: string, color: 'red' | 'amber' | 'blue', link?: string }) {
  const colors = {
    red: 'bg-red-500/10 text-red-500',
    amber: 'bg-amber-500/10 text-amber-500',
    blue: 'bg-blue-500/10 text-blue-500',
  }
  const Content = (
    <div className="flex items-start gap-3 p-3.5 rounded-[20px] bg-white/5 hover:bg-white/10 transition-all border border-white/5 group cursor-pointer">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform", colors[color])}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-white truncate">{title}</p>
        <p className="text-[10px] text-white/50 truncate font-medium">{sub}</p>
      </div>
      <ChevronRight size={14} className="text-slate-600 group-hover:text-white transition-colors" />
    </div>
  )

  if (link) {
    return <Link to={link}>{Content}</Link>
  }
  return Content
}

function PremiumRankingTable({ 
  employees, onSelectUser, hoveredUserId, onHoverUser 
}: { 
  employees: EmployeeKpiStats[], 
  onSelectUser: (id: string, name: string) => void,
  hoveredUserId: string | null,
  onHoverUser: (id: string | null) => void
}) {
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(orgId)
  
  const maxScore = org?.evaluationMaxScore || 100
  const thresholds = {
    excellent: org?.excellentThreshold || 90,
    good: org?.goodThreshold || 80,
    fair: org?.fairThreshold || 70,
    average: org?.averageThreshold || 50,
  }

  const getPerformanceInfo = (score: number) => {
    if (score >= thresholds.excellent) return { color: 'text-amber-500', label: 'Xuất sắc' }
    if (score >= thresholds.good) return { color: 'text-emerald-500', label: 'Tốt' }
    if (score >= thresholds.fair) return { color: 'text-blue-500', label: 'Khá' }
    if (score >= thresholds.average) return { color: 'text-indigo-500', label: 'Trung bình' }
    return { color: 'text-red-500', label: 'Yếu' }
  }

  const sorted = [...employees].sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0)).slice(0, 5)
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200/60 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden transition-all hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)]">
      <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/30">
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-3">
           <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
             <Award size={16} />
           </div>
           TOP HIỆU SUẤT
        </h3>
        <div className="flex -space-x-2">
          {sorted.slice(0, 3).map((emp, i) => (
            <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black">
              {getInitials(emp.fullName)}
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-50 dark:border-slate-800/50">
              <th className="px-10 py-6">Nhân viên</th>
              <th className="px-6 py-6 text-center">Hoàn thành</th>
              <th className="px-6 py-6 text-center">KPI Duyệt</th>
              <th className="px-10 py-6 text-right">Điểm TB</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {sorted.map((emp, index) => (
              <tr 
                key={emp.userId} 
                onMouseEnter={() => onHoverUser(emp.userId)}
                onMouseLeave={() => onHoverUser(null)}
                onClick={() => onSelectUser(emp.userId, emp.fullName)}
                className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all group cursor-pointer relative"
              >
                <td className="px-10 py-6">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center font-black text-sm text-indigo-600 group-hover:scale-110 transition-transform">
                        {getInitials(emp.fullName)}
                      </div>
                      {index < 3 && (
                        <div className={cn(
                          "absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] border-2 border-white dark:border-slate-900 shadow-sm",
                          index === 0 ? "bg-amber-400 text-white" : index === 1 ? "bg-slate-300 text-slate-700" : "bg-orange-400 text-white"
                        )}>
                          {index + 1}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">{emp.fullName}</p>
                      <p className="text-[11px] text-slate-500 font-bold flex items-center gap-1.5 mt-0.5">
                        <Building2 size={10} /> {emp.orgUnitName}
                      </p>
                    </div>
                  </div>

                  {/* Hover Detail Tooltip for Ranking Table */}
                  <div className={cn(
                    "absolute left-full top-0 ml-4 w-72 backdrop-blur-xl bg-white/95 dark:bg-slate-900/95 p-5 rounded-[28px] shadow-[0_30px_60px_rgba(0,0,0,0.2)] border border-slate-100 dark:border-slate-800 transition-all duration-300 z-[100]",
                    hoveredUserId === emp.userId ? "opacity-100 visible translate-x-0" : "opacity-0 invisible -translate-x-2"
                  )}>
                      <div className="flex items-center gap-2 mb-4 px-2">
                        <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                        <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Đóng góp chi tiết</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100/30">
                           <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">KPI Hoàn thành</span>
                           <span className="text-[11px] font-black text-indigo-600">{emp.approvedSubmissions}/{emp.assignedKpi}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-500/10 border border-emerald-100/30">
                           <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Điểm trung bình</span>
                           <span className="text-[11px] font-black text-emerald-600">{(emp.averageScore ?? 0).toFixed(1)}</span>
                        </div>
                        <div className="p-3 text-center">
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">* Nhấn để xem chi tiết bài nộp</p>
                        </div>
                      </div>
                  </div>
                </td>
                <td className="px-6 py-6 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                       <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-1000 shadow-[0_0_8px_rgba(16,185,129,0.3)]" style={{ width: `${Math.round((emp.approvedSubmissions / (emp.assignedKpi || 1)) * 100)}%` }} />
                    </div>
                    <span className="text-[11px] font-black text-slate-600 dark:text-slate-400">
                      {Math.round((emp.approvedSubmissions / (emp.assignedKpi || 1)) * 100)}%
                    </span>
                  </div>
                </td>
                <td className="px-6 py-6 text-center">
                  <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-100/50 dark:border-indigo-500/20">
                    {emp.approvedSubmissions}/{emp.assignedKpi}
                  </span>
                </td>
                <td className="px-10 py-6 text-right">
                   <div className="flex flex-col items-end">
                     <span className={cn("text-2xl font-black tracking-tighter", getPerformanceInfo(emp.averageScore ?? 0).color)}>
                       {(emp.averageScore ?? 0).toFixed(1)}
                     </span>
                     <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-1">
                        {getPerformanceInfo(emp.averageScore ?? 0).label} • Hệ số {maxScore}
                     </span>
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function OrgUnitsGrid({ units, averageScores }: { units: OrgUnitStats[], averageScores: Record<string, number> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
       {units.map((unit) => {
         const unitName = (unit.orgUnitName || 'Chưa gán').trim()
         const avgScore = averageScores[unitName]
         const kRate = (avgScore !== undefined && avgScore !== null && avgScore > 0) 
           ? Math.round(avgScore) 
           : (unit.totalAssignments > 0 ? Math.round((unit.totalSubmissions / unit.totalAssignments) * 100) : 0)
         
         return (
           <div key={unit.orgUnitId} className="group relative bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 p-8 hover:shadow-[0_30px_60px_-15px_rgba(99,102,241,0.15)] transition-all duration-500 flex flex-col justify-between overflow-hidden hover:-translate-y-2">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000"></div>
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-500/20 group-hover:rotate-6 transition-all">
                      {getInitials(unit.orgUnitName)}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 dark:text-white text-lg leading-tight group-hover:text-indigo-600 transition-colors">{unit.orgUnitName}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Users size={14} className="text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{unit.memberCount} Nhân viên</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{kRate}%</span>
                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em]">Hiệu suất</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-8">
                  {[
                    { label: 'KPIs', val: unit.totalKpi, color: 'indigo' },
                    { label: 'Đã nộp', val: unit.totalSubmissions, color: 'blue' },
                    { label: 'Đã duyệt', val: unit.approvedSubmissions, color: 'emerald' }
                  ].map((stat, i) => (
                    <div key={i} className="bg-slate-50/50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/30 text-center group/stat hover:bg-white dark:hover:bg-slate-800 transition-all">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover/stat:text-indigo-500 transition-colors">{stat.label}</p>
                      <p className="text-base font-black text-slate-900 dark:text-white">{stat.val}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 mb-8">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiến độ hoàn thành</span>
                    <span className="text-xs font-black text-indigo-600">{kRate}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-indigo-700 rounded-full transition-all duration-[1500ms] shadow-[0_0_8px_rgba(79,70,229,0.4)]" 
                      style={{ width: `${kRate}%` }} 
                    />
                  </div>
                </div>
              </div>

              <Link to={`/org-units/${unit.orgUnitId}`} className="relative z-10 w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-indigo-600 dark:hover:bg-indigo-600 hover:text-white transition-all shadow-xl hover:shadow-indigo-500/20 active:scale-95">
                Quản lý Đơn vị <ArrowUpRight size={16} />
              </Link>
           </div>
         )
       })}
    </div>
  )
}

function EmployeesExecutiveTable({ 
  employees, loading, search, onSearchChange, 
  page, totalPages, onPageChange, onExport, 
  isExporting, orgUnitFilter, onOrgUnitFilterChange, orgUnits 
}: any) {
  if (loading) return (
    <div className="space-y-6">
       {[1,2,3,4,5].map(i => (
         <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-[24px] animate-pulse" />
       ))}
    </div>
  )
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200/60 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden">
       <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row items-center justify-between gap-6 bg-slate-50/30 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
               <Users size={20} />
             </div>
             <div>
               <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Quản lý Nhân sự</h3>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">Thống kê hiệu suất cá nhân</p>
             </div>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4 w-full lg:w-auto">
            <div className="relative w-full lg:w-[350px] group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <input 
                id="tour-dashboard-search"
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full pl-14 pr-8 py-3.5 rounded-[22px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none text-sm transition-all shadow-sm"
              />
            </div>
            <div className="w-full md:w-[220px]">
              <Select value={orgUnitFilter} onValueChange={onOrgUnitFilterChange}>
                <SelectTrigger className="w-full h-[54px] rounded-[22px] bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-bold text-xs uppercase tracking-widest px-6">
                   <SelectValue placeholder="Chọn đơn vị..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl shadow-2xl border-slate-100 dark:border-slate-800">
                  {orgUnits.map((u: any) => (
                    <SelectItem key={u.orgUnitId} value={u.orgUnitId} className="text-xs font-bold uppercase tracking-widest py-3">
                      {u.orgUnitName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <button
              id="tour-dashboard-export-btn"
              onClick={onExport}
              disabled={isExporting}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-[22px] bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 active:scale-95 shrink-0"
            >
              {isExporting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <FileText size={16} />
              )}
              {isExporting ? 'Đang xuất...' : 'Xuất báo cáo'}
            </button>
          </div>
       </div>
       <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
               <tr className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 border-b border-slate-50 dark:border-slate-800/50">
                  <th className="px-10 py-6">Nhân viên</th>
                  <th className="px-6 py-6 text-center">Đơn vị</th>
                  <th className="px-6 py-6 text-center">Tiến độ Hoàn thành</th>
                  <th className="px-10 py-6 text-right">Thao tác</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
               {employees.map((emp: any) => (
                 <tr key={emp.userId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all group">
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-[18px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-sm text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                          {getInitials(emp.fullName)}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">{emp.fullName}</p>
                          <p className="text-[11px] text-slate-500 font-bold mt-0.5">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                       <span className="text-[11px] font-black text-slate-500 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50 uppercase tracking-widest">
                         {emp.orgUnitName}
                       </span>
                    </td>
                    <td className="px-6 py-6">
                       <div className="flex flex-col items-center gap-2">
                          <div className="w-40 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                             <div 
                               className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-[2000ms] shadow-[0_0_8px_rgba(99,102,241,0.3)]" 
                               style={{ width: `${Math.round((emp.approvedSubmissions / (emp.assignedKpi || 1)) * 100)}%` }} 
                             />
                          </div>
                          <span className="text-[11px] font-black text-slate-600 dark:text-slate-400">
                            {Math.round((emp.approvedSubmissions / (emp.assignedKpi || 1)) * 100)}% • {emp.approvedSubmissions}/{emp.assignedKpi} KPIs
                          </span>
                       </div>
                    </td>
                    <td className="px-10 py-6 text-right">
                       <div className="flex items-center justify-end">
                          <Link 
                            to={`/employees/${emp.userId}/performance`} 
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-[10px] font-black uppercase tracking-widest text-white dark:text-slate-900 hover:bg-indigo-600 dark:hover:bg-indigo-600 hover:text-white transition-all shadow-md group/btn"
                          >
                            Chi tiết <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                          </Link>
                       </div>
                    </td>
                 </tr>
               ))}
            </tbody>
          </table>
       </div>
       
       <div className="p-8 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Trang {page + 1}/{totalPages}</p>
          <div className="flex items-center gap-3">
             <button 
               onClick={() => onPageChange(Math.max(0, page - 1))}
               disabled={page === 0}
               className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 disabled:opacity-40 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all shadow-sm"
             >
               <ChevronLeft size={20} />
             </button>
             <button 
               onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
               disabled={page >= totalPages - 1}
               className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 disabled:opacity-40 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all shadow-sm"
             >
               <ChevronRight size={20} />
             </button>
          </div>
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
        <PinnedWidgetContent type={widget.widgetType} />
      </div>
    </div>
  )
}

function PinnedWidgetContent({ type }: { type: string }) {
  const { data: trendData } = useSummaryTrend()
  const { data: comparisonData } = useSummaryComparison()
  const { data: riskData } = useSummaryRisks()
  const { data: stats } = useSummaryStats()

  switch (type) {
    case 'TREND_CHART':
      return (
        <div className="h-full w-full min-h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData || []}>
              <defs><linearGradient id="colorPerfD" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
              <RechartsTooltip />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '10px', fontSize: '10px', fontWeight: 700 }} />
              <Area type="monotone" dataKey="performance" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorPerfD)" name="Hiệu suất (%)" />
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
    default:
      return <div className="h-full flex items-center justify-center text-xs font-bold text-slate-300 italic">Chi tiết biểu đồ xem tại trang Thống kê</div>
  }
}
