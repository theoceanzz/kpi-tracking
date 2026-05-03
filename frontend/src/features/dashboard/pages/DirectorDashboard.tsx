import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { useOverviewStats } from '../hooks/useOverviewStats'
import { useOrgUnitStats } from '../hooks/useOrgUnitStats'
import { useEmployeeStats } from '../hooks/useEmployeeStats'
import { useQuery } from '@tanstack/react-query'
import { kpiApi } from '@/features/kpi/api/kpiApi'
import { submissionApi } from '@/features/submissions/api/submissionApi'
import { Link } from 'react-router-dom'
import { cn, getInitials, formatDateTime, formatNumber, formatAssigneeNames } from '@/lib/utils'
import type { OrgUnitStats, EmployeeKpiStats } from '@/types/stats'
import type { KpiCriteria } from '@/types/kpi'
import type { Submission } from '@/types/submission'
import {
  Users, Target, FileText, ChevronDown,
  Clock, BarChart3, ShieldCheck, Building2,
  ChevronRight, Search, CheckCircle2, XCircle,
  Star, UserCircle2, Filter, ArrowUpRight,
  Activity, AlertTriangle, Zap, Pin, PinOff
} from 'lucide-react'
import { reportApi } from '@/features/reports/api/reportApi'
import { toast } from 'sonner'
import { 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts'
import type { ReportWidget } from '@/types/datasource'
import { useSummaryStats, useSummaryTrend, useSummaryComparison, useSummaryRisks } from '@/features/analytics/hooks/useAnalytics'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

type TabView = 'overview' | 'orgUnits' | 'employees'

export default function DirectorDashboard() {
  const { data: stats, isLoading: loadingStats } = useOverviewStats()
  const { data: orgUnitStats, isLoading: loadingOrgUnits } = useOrgUnitStats()
  const { data: empStats, isLoading: loadingEmps } = useEmployeeStats()
  const queryClient = useQueryClient()

  // Load real KPI and submission data
  const { data: recentKpiData, isLoading: loadingRecentKpis } = useQuery({
    queryKey: ['kpi-criteria', 'director-dash', 'APPROVED'],
    queryFn: () => kpiApi.getAll({ page: 0, size: 10, status: 'APPROVED' as any }),
  })
  const { data: recentSubData, isLoading: loadingRecentSubs } = useQuery({
    queryKey: ['submissions', 'director-dash'],
    queryFn: () => submissionApi.getAll({ page: 0, size: 10 }),
  })

  const { data: pinnedWidgets, isLoading: loadingPinned, refetch: refetchPinned } = useQuery({
    queryKey: ['reports', 'widgets', 'pinned'],
    queryFn: () => reportApi.getPinnedWidgets(),
  })

  const [activeTab, setActiveTab] = useState<TabView>('overview')
  const [empSearch, setEmpSearch] = useState('')
  const [orgUnitFilter, setOrgUnitFilter] = useState<string>('ALL')

  const isLoading = loadingStats || loadingOrgUnits || loadingEmps || loadingRecentKpis || loadingRecentSubs || loadingPinned

  const kpiCompletionRate = stats ? (stats.totalKpiCriteria > 0 ? Math.round((stats.approvedKpi / stats.totalKpiCriteria) * 100) : 0) : 0
  const submissionApprovalRate = stats ? (stats.totalSubmissions > 0 ? Math.round((stats.approvedSubmissions / stats.totalSubmissions) * 100) : 0) : 0

  const filteredEmployees = useMemo(() => {
    if (!empStats) return []
    return empStats.filter(e =>
      (orgUnitFilter === 'ALL' || e.orgUnitName === orgUnitFilter) &&
      ((e.fullName || '').toLowerCase().includes(empSearch.toLowerCase()) || 
       (e.email || '').toLowerCase().includes(empSearch.toLowerCase()))
    )
  }, [empStats, empSearch, orgUnitFilter])

  const orgUnitNames = useMemo(() => {
    if (!empStats) return []
    return [...new Set(empStats.map(e => e.orgUnitName).filter(Boolean))]
  }, [empStats])

  // Top performers (from employee stats)
  const topPerformers = useMemo(() => {
    if (!empStats) return []
    return empStats
      .filter(e => e.totalSubmissions > 0)
      .sort((a, b) => {
        const rateA = a.totalSubmissions > 0 ? a.approvedSubmissions / a.totalSubmissions : 0
        const rateB = b.totalSubmissions > 0 ? b.approvedSubmissions / b.totalSubmissions : 0
        return rateB - rateA
      })
      .slice(0, 5)
  }, [empStats])

  // At-risk employees (rejected > 0 or no submissions)
  const atRiskEmployees = useMemo(() => {
    if (!empStats) return []
    return empStats.filter(e => e.rejectedSubmissions > 0 || (e.assignedKpi > 0 && e.totalSubmissions === 0))
  }, [empStats])

  if (isLoading) return <div className="p-8"><LoadingSkeleton rows={10} /></div>

  const tabs: { key: TabView; label: string; icon: any; badge?: number }[] = [
    { key: 'overview', label: 'Tổng quan', icon: BarChart3 },
    { key: 'orgUnits', label: 'Đơn vị', icon: Building2, badge: orgUnitStats?.length },
    { key: 'employees', label: 'Nhân viên', icon: Users, badge: empStats?.length },
  ]

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest mb-3">
            <ShieldCheck size={14} /> Bảng điều hành Giám đốc
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            Hiệu suất Toàn công ty
          </h1>
          <p className="text-slate-500 font-medium mt-1 max-w-lg">
            Theo dõi chi tiết các đơn vị, nhân viên và chỉ tiêu KPI trên toàn hệ thống.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link to="/kpi-criteria" className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-all">
            <Target size={16} /> Quản lý KPI
          </Link>
          <Link to="/kpi-criteria/pending" className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition-all">
            <Clock size={16} /> Duyệt KPI ({stats?.pendingKpi ?? 0})
          </Link>
        </div>
      </div>

      {/* BIG STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={<Users />} label="Nhân sự" value={stats?.totalUsers ?? 0} color="indigo" />
        <StatCard icon={<Building2 />} label="Đơn vị" value={stats?.totalOrgUnits ?? 0} color="emerald" />
        <StatCard icon={<Target />} label="Chỉ tiêu KPI" value={stats?.totalKpiCriteria ?? 0} sub={`${stats?.approvedKpi ?? 0} duyệt • ${stats?.pendingKpi ?? 0} chờ`} color="blue" />
        <StatCard icon={<FileText />} label="Bài nộp" value={stats?.totalSubmissions ?? 0} sub={`${stats?.approvedSubmissions ?? 0} duyệt • ${stats?.pendingSubmissions ?? 0} chờ`} color="amber" />
        <StatCard icon={<Star />} label="Đánh giá" value={stats?.totalEvaluations ?? 0} color="purple" />
      </div>

      {/* TABS */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-all -mb-px",
                activeTab === t.key
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              <Icon size={18} /> {t.label}
              {t.badge != null && (
                <span className="ml-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-black">{t.badge}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'overview' && (
        <OverviewTab
          stats={stats}
          kpiRate={kpiCompletionRate}
          subRate={submissionApprovalRate}
          orgUnitStats={orgUnitStats ?? []}
          topPerformers={topPerformers}
          atRiskCount={atRiskEmployees.length}
          recentKpis={recentKpiData?.content ?? []}
          recentSubmissions={recentSubData?.content ?? []}
          pinnedWidgets={pinnedWidgets ?? []}
          onRefreshPinned={refetchPinned}
        />
      )}
      {activeTab === 'orgUnits' && <OrgUnitsTab orgUnitStats={orgUnitStats ?? []} loading={loadingOrgUnits} />}
      {activeTab === 'employees' && (
        <EmployeesTab
          employees={filteredEmployees}
          loading={loadingEmps}
          search={empSearch}
          onSearchChange={setEmpSearch}
          orgUnitFilter={orgUnitFilter}
          onOrgUnitFilterChange={setOrgUnitFilter}
          orgUnitNames={orgUnitNames}
        />
      )}
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
                  {(stats?.memberDistribution || []).map((entry: any, index: number) => (
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

/* =================== STAT CARD =================== */
function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: number; sub?: string; color: string }) {
  const colors: Record<string, string> = {
    indigo: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20",
    emerald: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
    blue: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
    amber: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
    purple: "text-purple-600 bg-purple-50 dark:bg-purple-900/20",
  }
  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-900 transition-all">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", colors[color])}>
        {icon}
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
      <h4 className="text-2xl font-black text-slate-900 dark:text-white">{value}</h4>
      {sub && <p className="text-[11px] font-medium text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

/* =================== OVERVIEW TAB =================== */
function OverviewTab({ stats, kpiRate, subRate, orgUnitStats, topPerformers, atRiskCount, recentKpis, recentSubmissions, pinnedWidgets, onRefreshPinned }: {
  stats: any; kpiRate: number; subRate: number; orgUnitStats: OrgUnitStats[];
  topPerformers: EmployeeKpiStats[]; atRiskCount: number;
  recentKpis: KpiCriteria[]; recentSubmissions: Submission[];
  pinnedWidgets: ReportWidget[]; onRefreshPinned: () => void;
}) {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">

      {/* Row 0: Pinned Widgets */}
      {pinnedWidgets.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Pin size={18} className="text-indigo-600 rotate-45" /> Thống kê đã ghim
            </h3>
          </div>
          <div className="grid grid-cols-12 gap-6">
            {pinnedWidgets.map((widget) => (
              <PinnedWidgetCard key={widget.id} widget={widget} onUnpin={onRefreshPinned} />
            ))}
          </div>
        </section>
      )}

      {/* Row 1: Rate Cards + Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <RateCard label="Tỷ lệ duyệt KPI" rate={kpiRate} num={stats?.approvedKpi ?? 0} denom={stats?.totalKpiCriteria ?? 0} color="emerald" />
        <RateCard label="Tỷ lệ duyệt Bài nộp" rate={subRate} num={stats?.approvedSubmissions ?? 0} denom={stats?.totalSubmissions ?? 0} color="blue" />

        {/* Alert: Pending */}
        <div className="p-5 bg-amber-50 dark:bg-amber-900/10 rounded-[24px] border border-amber-200 dark:border-amber-900/30 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-amber-600 font-bold text-sm mb-2">
            <Clock size={18} /> Chờ xử lý
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-amber-700 dark:text-amber-400">{(stats?.pendingKpi ?? 0) + (stats?.pendingSubmissions ?? 0)}</span>
            <span className="text-xs font-bold text-amber-600 mb-1">mục</span>
          </div>
          <p className="text-[11px] text-amber-600/70 font-medium mt-1">{stats?.pendingKpi ?? 0} KPI + {stats?.pendingSubmissions ?? 0} bài nộp</p>
        </div>

        {/* Alert: At Risk */}
        <div className="p-5 bg-red-50 dark:bg-red-900/10 rounded-[24px] border border-red-200 dark:border-red-900/30 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-red-600 font-bold text-sm mb-2">
            <AlertTriangle size={18} /> Cần theo dõi
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-red-700 dark:text-red-400">{atRiskCount}</span>
            <span className="text-xs font-bold text-red-600 mb-1">nhân viên</span>
          </div>
          <p className="text-[11px] text-red-600/70 font-medium mt-1">Bài nộp bị từ chối hoặc chưa nộp</p>
        </div>
      </div>

      {/* Row 2: Department Overview + Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Department Details Table */}
        <div className="lg:col-span-8">
          <section className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-black text-base flex items-center gap-2">
                <Building2 size={20} className="text-indigo-600" /> Tổng quan Đơn vị ({orgUnitStats.length})
              </h3>
              <Link to="/org-units" className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                Xem chi tiết <ChevronRight size={14} />
              </Link>
            </div>

            {orgUnitStats.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-400 font-medium">Chưa có đơn vị nào.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-3">Đơn vị</th>
                      <th className="px-3 py-3 text-center">Thành viên</th>
                      <th className="px-3 py-3 text-center">KPI</th>
                      <th className="px-3 py-3 text-center">Bài nộp</th>
                      <th className="px-3 py-3">Tiến độ KPI duyệt</th>
                      <th className="px-3 py-3 text-center">Duyệt / Chờ / Từ chối</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {orgUnitStats.map((orgUnit, i) => {
                      const kRate = orgUnit.totalKpi > 0 ? Math.round((orgUnit.approvedKpi / orgUnit.totalKpi) * 100) : 0
                      return (
                        <tr key={orgUnit.orgUnitId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors animate-in fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                                {getInitials(orgUnit.orgUnitName)}
                              </div>
                              <Link to={`/org-units/${orgUnit.orgUnitId}`} className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 transition-colors text-sm">
                                {orgUnit.orgUnitName}
                              </Link>
                            </div>
                          </td>
                          <td className="px-3 py-4 text-center">
                            <span className="text-sm font-black text-slate-700 dark:text-slate-300">{orgUnit.memberCount}</span>
                          </td>
                          <td className="px-3 py-4 text-center">
                            <span className="text-sm font-black text-slate-900 dark:text-white">{orgUnit.totalKpi}</span>
                            <span className="text-[10px] text-slate-400 ml-1">({orgUnit.approvedKpi} duyệt)</span>
                          </td>
                          <td className="px-3 py-4 text-center">
                            <span className="text-sm font-black text-slate-900 dark:text-white">{orgUnit.totalSubmissions}</span>
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-2 min-w-[120px]">
                              <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className={cn("h-full rounded-full transition-all duration-700", kRate >= 70 ? "bg-emerald-500" : kRate >= 40 ? "bg-amber-500" : "bg-red-500")}
                                  style={{ width: `${kRate}%` }}
                                />
                              </div>
                              <span className={cn("text-xs font-black w-10 text-right", kRate >= 70 ? "text-emerald-600" : kRate >= 40 ? "text-amber-600" : "text-red-600")}>{kRate}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex items-center justify-center gap-3 text-xs font-bold">
                              <span className="text-emerald-600 flex items-center gap-0.5"><CheckCircle2 size={12} />{orgUnit.approvedSubmissions}</span>
                              <span className="text-amber-600 flex items-center gap-0.5"><Clock size={12} />{orgUnit.pendingSubmissions}</span>
                              <span className="text-red-600 flex items-center gap-0.5"><XCircle size={12} />{orgUnit.rejectedSubmissions}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Right: Top Performers + Quick Actions */}
        <div className="lg:col-span-4 space-y-6">

          {/* Top Performers */}
          <section className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Zap size={18} className="text-amber-500" />
              <h3 className="font-black text-sm">Top Nhân viên Xuất sắc</h3>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {topPerformers.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-400">Chưa có dữ liệu</p>
              ) : (
                topPerformers.map((emp, i) => {
                  const rate = emp.totalSubmissions > 0 ? Math.round((emp.approvedSubmissions / emp.totalSubmissions) * 100) : 0
                  return (
                    <div key={emp.userId} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0" style={{
                        background: i === 0 ? 'linear-gradient(135deg, #f59e0b, #f97316)' : i === 1 ? 'linear-gradient(135deg, #94a3b8, #64748b)' : i === 2 ? 'linear-gradient(135deg, #d97706, #b45309)' : '#e2e8f0',
                        color: i < 3 ? 'white' : '#64748b'
                      }}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{emp.fullName}</p>
                        <p className="text-[10px] text-slate-500 truncate">{emp.orgUnitName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={cn("text-xs font-black px-2 py-0.5 rounded-md", rate >= 80 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700")}>
                          {rate}%
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>

          {/* Pending Approvals */}
          <section className="bg-slate-900 dark:bg-slate-950 rounded-[28px] p-6 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full -mr-20 -mt-20 blur-3xl" />
            <div className="relative z-10 space-y-4">
              <div className="flex justify-between items-start">
                <h3 className="text-sm font-black">Phê duyệt tồn đọng</h3>
                <div className="p-2 bg-white/10 rounded-xl text-amber-400"><Clock size={16} /></div>
              </div>
              <div className="space-y-2.5">
                <ApprovalRow label="Chỉ tiêu KPI" count={stats?.pendingKpi ?? 0} to="/kpi-criteria/pending" />
                <ApprovalRow label="Bài nộp nhân viên" count={stats?.pendingSubmissions ?? 0} to="/submissions/org-unit" />
              </div>
              <Link to="/kpi-criteria/pending" className="block w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black text-sm text-center transition-all shadow-lg shadow-indigo-600/30">
                Xử lý ngay ({(stats?.pendingKpi ?? 0) + (stats?.pendingSubmissions ?? 0)})
              </Link>
            </div>
          </section>
        </div>
      </div>

      {/* Row 3: Recent KPIs + Recent Submissions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent KPIs */}
        <section className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-black text-sm flex items-center gap-2"><Target size={18} className="text-indigo-600" /> Chỉ tiêu KPI Gần đây</h3>
            <Link to="/kpi-criteria" className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">Xem tất cả <ArrowUpRight size={12} /></Link>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {recentKpis.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">Chưa có chỉ tiêu nào</p>
            ) : (
              recentKpis.slice(0, 5).map(kpi => (
                <div key={kpi.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{kpi.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                      <span>{kpi.orgUnitName ?? 'Chưa gán Đơn vị'}</span>
                      <span>•</span>
                      <span>{formatAssigneeNames(kpi.assigneeNames)}</span>
                      {kpi.targetValue != null && <><span>•</span><span>Mục tiêu: {formatNumber(kpi.targetValue)} {kpi.unit ?? ''}</span></>}
                    </div>
                  </div>
                  <KpiStatusBadge status={kpi.status} />
                </div>
              ))
            )}
          </div>
        </section>

        {/* Recent Submissions */}
        <section className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-black text-sm flex items-center gap-2"><Activity size={18} className="text-emerald-600" /> Bài nộp Gần đây</h3>
            <Link to="/submissions/org-unit" className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">Xem tất cả <ArrowUpRight size={12} /></Link>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {recentSubmissions.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">Chưa có bài nộp nào</p>
            ) : (
              recentSubmissions.slice(0, 5).map(sub => (
                <Link to={`/submissions/${sub.id}`} key={sub.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors block">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0">
                    {getInitials(sub.submittedByName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{sub.kpiCriteriaName}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                      <span>{sub.submittedByName}</span>
                      <span>•</span>
                      <span>Thực tế: {formatNumber(sub.actualValue)}</span>
                      <span>•</span>
                      <span>{formatDateTime(sub.createdAt).split(' ')[0]}</span>
                    </div>
                  </div>
                  <SubmissionStatusBadge status={sub.status} />
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

/* =================== ORG UNITS TAB =================== */
function OrgUnitsTab({ orgUnitStats, loading }: { orgUnitStats: OrgUnitStats[]; loading: boolean }) {
  if (loading) return <LoadingSkeleton rows={6} />
  if (orgUnitStats.length === 0) return <EmptyMessage text="Chưa có dữ liệu đơn vị nào." />

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-300">
      {orgUnitStats.map((orgUnit, i) => {
        const kRate = orgUnit.totalKpi > 0 ? Math.round((orgUnit.approvedKpi / orgUnit.totalKpi) * 100) : 0
        const sRate = orgUnit.totalSubmissions > 0 ? Math.round((orgUnit.approvedSubmissions / orgUnit.totalSubmissions) * 100) : 0
        return (
          <div key={orgUnit.orgUnitId}
            className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-indigo-200 dark:hover:border-indigo-800 transition-all animate-in fade-in slide-in-from-bottom-4 flex flex-col"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg">{getInitials(orgUnit.orgUnitName)}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-slate-900 dark:text-white truncate">{orgUnit.orgUnitName}</h3>
                  <p className="text-xs font-medium text-slate-500">{orgUnit.memberCount} thành viên</p>
                </div>
              </div>
            </div>
            <div className="p-6 flex-1 space-y-5">
              <div>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-slate-500">KPI đã duyệt</span>
                  <span className={kRate >= 70 ? "text-emerald-600" : kRate >= 40 ? "text-amber-600" : "text-red-600"}>{kRate}%</span>
                </div>
                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-700", kRate >= 70 ? "bg-emerald-500" : kRate >= 40 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${kRate}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <MiniStatBox label="KPI" value={orgUnit.totalKpi} />
                <MiniStatBox label="Bài nộp" value={orgUnit.totalSubmissions} />
                <MiniStatBox label="Chờ duyệt" value={orgUnit.pendingKpi + orgUnit.pendingSubmissions} highlight />
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bài nộp chi tiết</p>
                <div className="flex items-center gap-3 text-xs font-bold">
                  <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={12} /> {orgUnit.approvedSubmissions}</span>
                  <span className="flex items-center gap-1 text-amber-600"><Clock size={12} /> {orgUnit.pendingSubmissions}</span>
                  <span className="flex items-center gap-1 text-red-600"><XCircle size={12} /> {orgUnit.rejectedSubmissions}</span>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-800 rounded-b-[28px] flex justify-between items-center text-xs">
              <span className="font-bold text-slate-500">Duyệt bài: <span className={sRate >= 70 ? "text-emerald-600" : "text-amber-600"}>{sRate}%</span></span>
              <Link to={`/org-units/${orgUnit.orgUnitId}`} className="flex items-center gap-1 font-bold text-indigo-600 hover:underline">Chi tiết <ArrowUpRight size={12} /></Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* =================== EMPLOYEES TAB =================== */
function EmployeesTab({ employees, loading, search, onSearchChange, orgUnitFilter, onOrgUnitFilterChange, orgUnitNames }: {
  employees: EmployeeKpiStats[]; loading: boolean; search: string; onSearchChange: (s: string) => void;
  orgUnitFilter: string; onOrgUnitFilterChange: (s: string) => void; orgUnitNames: string[]
}) {
  if (loading) return <LoadingSkeleton rows={8} />

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center gap-2.5 w-full">
        <div className="relative flex-1 min-w-0">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            size={16}
          />
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Tìm nhân viên theo tên hoặc email..."
            className="w-full pl-9 pr-3.5 h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all"
          />
        </div>

        {/* OrgUnit filter */}
        <div className="relative flex-none w-[200px]">
          <Filter
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            size={14}
          />
          <select
            value={orgUnitFilter}
            onChange={e => onOrgUnitFilterChange(e.target.value)}
            className="w-full pl-8 pr-8 h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500/30 outline-none appearance-none cursor-pointer"
          >
            <option value="ALL">Tất cả đơn vị</option>
            {orgUnitNames.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            size={12}
          />
        </div>
      </div>

      {employees.length === 0 ? (
        <EmptyMessage text="Không tìm thấy nhân viên phù hợp." />
      ) : (
        <>
          <p className="text-xs font-bold text-slate-400">{employees.length} nhân viên</p>
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <th className="px-6 py-4">Nhân viên</th>
                    <th className="px-4 py-4 text-center">Đơn vị</th>
                    <th className="px-4 py-4 text-center">KPI giao</th>
                    <th className="px-4 py-4 text-center">Bài nộp</th>
                    <th className="px-4 py-4 text-center">Đã duyệt</th>
                    <th className="px-4 py-4 text-center">Chờ duyệt</th>
                    <th className="px-4 py-4 text-center">Từ chối</th>
                    <th className="px-4 py-4 text-center">Điểm TB</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {employees.map((emp, idx) => (
                    <tr key={emp.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors animate-in fade-in" style={{ animationDelay: `${idx * 30}ms` }}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-black text-indigo-600 shrink-0">{getInitials(emp.fullName)}</div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white truncate text-sm">{emp.fullName}</p>
                            <p className="text-[11px] text-slate-500 truncate">{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center text-xs font-bold text-slate-600 dark:text-slate-400">{emp.orgUnitName || '—'}</td>
                      <td className="px-4 py-4 text-center text-sm font-black text-slate-900 dark:text-white">{emp.assignedKpi}</td>
                      <td className="px-4 py-4 text-center text-sm font-black text-slate-900 dark:text-white">{emp.totalSubmissions}</td>
                      <td className="px-4 py-4 text-center"><span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600"><CheckCircle2 size={14} />{emp.approvedSubmissions}</span></td>
                      <td className="px-4 py-4 text-center"><span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600"><Clock size={14} />{emp.pendingSubmissions}</span></td>
                      <td className="px-4 py-4 text-center"><span className="inline-flex items-center gap-1 text-xs font-bold text-red-600"><XCircle size={14} />{emp.rejectedSubmissions}</span></td>
                      <td className="px-4 py-4 text-center">
                        {emp.averageScore != null ? (
                          <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black",
                            emp.averageScore >= 8 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                            emp.averageScore >= 5 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                            "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          )}>
                            <Star size={12} /> {emp.averageScore.toFixed(1)}
                          </span>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* =================== SUB COMPONENTS =================== */

function RateCard({ label, rate, num, denom, color }: { label: string; rate: number; num: number; denom: number; color: string }) {
  const colorCfg: Record<string, { text: string; bg: string; bar: string }> = {
    emerald: { text: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30', bar: 'bg-emerald-500' },
    blue: { text: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30', bar: 'bg-blue-500' },
  }
  const c = colorCfg[color] ?? colorCfg['emerald']!
  return (
    <div className={cn("p-5 rounded-[24px] border shadow-sm", c.bg)}>
      <p className="text-xs font-bold text-slate-500 mb-2">{label}</p>
      <div className="flex items-end gap-2 mb-3">
        <span className={cn("text-4xl font-black", c.text)}>{rate}</span>
        <span className={cn("text-xl font-black mb-0.5", c.text)}>%</span>
      </div>
      <div className="h-2 bg-white/60 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
        <div className={cn("h-full rounded-full transition-all duration-1000", c.bar)} style={{ width: `${rate}%` }} />
      </div>
      <p className="text-[11px] text-slate-500 font-medium">{num} / {denom}</p>
    </div>
  )
}

function ApprovalRow({ label, count, to }: { label: string; count: number; to: string }) {
  return (
    <Link to={to} className="flex justify-between items-center group hover:bg-white/5 rounded-xl px-2 py-1.5 -mx-2 transition-colors">
      <span className="text-sm font-medium text-slate-400 group-hover:text-white transition-colors">{label}</span>
      <span className="px-3 py-1 bg-white/10 rounded-lg text-xs font-bold">{count}</span>
    </Link>
  )
}

function MiniStatBox({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn("p-3 rounded-2xl text-center", highlight ? "bg-amber-50 dark:bg-amber-900/10" : "bg-slate-50 dark:bg-slate-800/50")}>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
      <p className={cn("text-lg font-black", highlight ? "text-amber-600" : "text-slate-900 dark:text-white")}>{value}</p>
    </div>
  )
}

function KpiStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: 'Nháp', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    PENDING_APPROVAL: { label: 'Chờ duyệt', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    APPROVED: { label: 'Đã duyệt', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    REJECTED: { label: 'Từ chối', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  }
  const c = cfg[status] ?? cfg['DRAFT']!
  return <span className={cn("text-[10px] font-black px-2.5 py-1 rounded-lg uppercase shrink-0", c.cls)}>{c.label}</span>
}

function SubmissionStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: 'Nháp', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    PENDING: { label: 'Chờ duyệt', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    APPROVED: { label: 'Đã duyệt', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    REJECTED: { label: 'Từ chối', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  }
  const c = cfg[status] ?? cfg['DRAFT']!
  return <span className={cn("text-[10px] font-black px-2.5 py-1 rounded-lg uppercase shrink-0", c.cls)}>{c.label}</span>
}

function EmptyMessage({ text }: { text: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-dashed border-slate-300 dark:border-slate-700 p-16 text-center">
      <UserCircle2 size={48} className="text-slate-300 mx-auto mb-4" />
      <p className="font-bold text-slate-500">{text}</p>
    </div>
  )
}
