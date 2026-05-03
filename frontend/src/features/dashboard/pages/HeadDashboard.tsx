import { useMemo } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import SubmissionStatusChart from '@/components/charts/SubmissionStatusChart'
import { useOverviewStats } from '../hooks/useOverviewStats'
import { useAuthStore } from '@/store/authStore'
import { Link } from 'react-router-dom'
import { cn, getInitials } from '@/lib/utils'
import {
  Target, FileText, CheckCircle, Clock, XCircle,
  Users, Star, ChevronRight, TrendingUp,
  ClipboardCheck, BarChart3, Award, ArrowUpRight, Pin, PinOff
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { reportApi } from '@/features/reports/api/reportApi'
import { toast } from 'sonner'
import { 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts'
import type { ReportWidget } from '@/types/datasource'
import { useSummaryStats, useSummaryTrend, useSummaryComparison, useSummaryRisks } from '@/features/analytics/hooks/useAnalytics'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function HeadDashboard() {
  const { data: stats, isLoading: statsLoading } = useOverviewStats()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: pinnedWidgets, isLoading: pinnedLoading, refetch: refetchPinned } = useQuery({
    queryKey: ['reports', 'widgets', 'pinned'],
    queryFn: () => reportApi.getPinnedWidgets(),
  })

  const isLoading = statsLoading || pinnedLoading

  if (isLoading) return <div className="p-8"><LoadingSkeleton rows={10} /></div>

  const totalSub = stats?.totalSubmissions ?? 0
  const pendingSub = stats?.pendingSubmissions ?? 0
  const approvedSub = stats?.approvedSubmissions ?? 0
  const rejectedSub = stats?.rejectedSubmissions ?? 0
  const approvalRate = totalSub > 0 ? Math.round((approvedSub / totalSub) * 100) : 0

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">

      {/* ===== HEADER ===== */}
      <div className="relative rounded-[28px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djJoLTJ2LTJoMnptMC00aDJ2MmgtMnYtMnptLTQgMHYyaC0ydi0yaDJ6bTQgMGgydjJoLTJ2LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
        
        <div className="relative z-10 px-8 py-10 md:px-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-black text-white border border-white/20">
                {getInitials(user?.fullName ?? '')}
              </div>
              <div className="text-white">
                <p className="text-white/70 text-sm font-medium">Xin chào,</p>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight">{user?.fullName}</h1>
                <p className="text-white/60 text-sm font-medium mt-1">Quản lý hiệu suất phòng ban hôm nay</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link to="/submissions/org-unit" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/15 backdrop-blur-sm text-white text-sm font-bold hover:bg-white/25 transition-all border border-white/10">
                <ClipboardCheck size={16} /> Duyệt bài nộp
              </Link>
              <Link to="/kpi-criteria" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-indigo-700 text-sm font-bold hover:bg-white/90 transition-all shadow-lg">
                <Target size={16} /> Quản lý KPI
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ===== STAT CARDS ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard
          label="Chỉ tiêu KPI"
          value={stats?.totalKpiCriteria ?? 0}
          sub={`${stats?.approvedKpi ?? 0} đã duyệt`}
          icon={Target}
          color="purple"
          link="/kpi-criteria"
        />
        <StatCard
          label="Chờ duyệt"
          value={pendingSub}
          sub="bài nộp"
          icon={Clock}
          color="amber"
          link="/submissions/org-unit"
          pulse={pendingSub > 0}
        />
        <StatCard
          label="Đã duyệt"
          value={approvedSub}
          sub={`${approvalRate}% tỷ lệ`}
          icon={CheckCircle}
          color="emerald"
          link="/submissions/org-unit"
        />
        <StatCard
          label="Tổng đánh giá"
          value={stats?.totalEvaluations ?? 0}
          sub="lượt đánh giá"
          icon={Star}
          color="blue"
          link="/evaluations"
        />
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
            {pinnedWidgets.map((widget) => (
              <PinnedWidgetCard key={widget.id} widget={widget} onUnpin={refetchPinned} />
            ))}
          </div>
        </section>
      )}

      {/* ===== MAIN CONTENT ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT: Charts & Activity */}
        <div className="lg:col-span-8 space-y-6">

          {/* Submission Status Overview */}
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 dark:border-slate-800 px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-900 dark:text-white">Tổng quan Bài nộp</h3>
                  <p className="text-xs font-medium text-slate-500">Phân bổ trạng thái bài nộp trong phòng ban</p>
                </div>
              </div>
              <Link to="/submissions/org-unit" className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                Xem tất cả <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                {/* Chart */}
                <div>
                  <SubmissionStatusChart pending={pendingSub} approved={approvedSub} rejected={rejectedSub} />
                </div>
                {/* Progress Bars */}
                <div className="space-y-5">
                  <ProgressBar label="Đã phê duyệt" value={approvedSub} total={totalSub} color="bg-emerald-500" textColor="text-emerald-600" />
                  <ProgressBar label="Đang chờ duyệt" value={pendingSub} total={totalSub} color="bg-amber-500" textColor="text-amber-600" />
                  <ProgressBar label="Bị từ chối" value={rejectedSub} total={totalSub} color="bg-red-500" textColor="text-red-600" />
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-slate-500">Tổng cộng</span>
                      <span className="text-slate-900 dark:text-white text-lg">{totalSub}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* KPI Status Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiStatusCard
              label="KPI Đã duyệt"
              value={stats?.approvedKpi ?? 0}
              total={stats?.totalKpiCriteria ?? 0}
              icon={CheckCircle}
              color="emerald"
            />
            <KpiStatusCard
              label="KPI Chờ duyệt"
              value={stats?.pendingKpi ?? 0}
              total={stats?.totalKpiCriteria ?? 0}
              icon={Clock}
              color="amber"
            />
            <KpiStatusCard
              label="Bị từ chối"
              value={stats?.rejectedKpi ?? 0}
              total={stats?.totalKpiCriteria ?? 0}
              icon={XCircle}
              color="red"
            />
          </div>
        </div>

        {/* RIGHT: Actions & Info */}
        <div className="lg:col-span-4 space-y-6">

          {/* Pending Alert */}
          {pendingSub > 0 && (
            <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 rounded-[28px] p-7 text-white shadow-xl shadow-amber-500/20">
              <div className="relative z-10 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="text-white/80 text-sm font-medium">Cần xử lý ngay</p>
                  <p className="text-4xl font-black">{pendingSub}</p>
                  <p className="text-white/80 text-sm font-medium">bài nộp đang chờ duyệt</p>
                </div>
                <Link
                  to="/submissions/org-unit"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-white text-amber-700 rounded-2xl font-black text-sm hover:bg-white/90 transition-all shadow-lg"
                >
                  Duyệt ngay <ChevronRight size={16} />
                </Link>
              </div>
              <FileText size={140} className="absolute -bottom-10 -right-10 opacity-[0.08]" />
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Thao tác nhanh</h3>

            <QuickAction
              to="/kpi-criteria"
              icon={Target}
              iconColor="text-purple-500"
              iconBg="bg-purple-50 dark:bg-purple-900/20"
              title="Quản lý Chỉ tiêu KPI"
              description="Tạo, sửa, gửi duyệt chỉ tiêu"
            />
            <QuickAction
              to="/kpi-criteria/pending"
              icon={ClipboardCheck}
              iconColor="text-indigo-500"
              iconBg="bg-indigo-50 dark:bg-indigo-900/20"
              title="Duyệt Chỉ tiêu"
              description="Xét duyệt KPI chờ phê duyệt"
            />
            <QuickAction
              to="/submissions/org-unit"
              icon={FileText}
              iconColor="text-amber-500"
              iconBg="bg-amber-50 dark:bg-amber-900/20"
              title="Duyệt Bài nộp"
              description="Xem và xử lý bài nộp nhân viên"
            />
            <QuickAction
              to="/evaluations"
              icon={Award}
              iconColor="text-blue-500"
              iconBg="bg-blue-50 dark:bg-blue-900/20"
              title="Đánh giá Nhân viên"
              description="Xem và phản hồi đánh giá hiệu suất"
            />
          </div>

          {/* Team Overview */}
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Tổng quan nhân sự</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200/50 dark:border-indigo-900/30 text-center">
                <Users size={20} className="text-indigo-500 mx-auto mb-2" />
                <p className="text-2xl font-black text-indigo-700 dark:text-indigo-400">{stats?.totalUsers ?? 0}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500/60">Nhân sự</p>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-900/30 text-center">
                <TrendingUp size={20} className="text-emerald-500 mx-auto mb-2" />
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{approvalRate}%</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/60">Tỷ lệ duyệt</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ========== Sub Components ========== */

function StatCard({ label, value, sub, icon: Icon, color, link, pulse }: {
  label: string; value: number; sub: string; icon: any; color: string; link: string; pulse?: boolean
}) {
  const colorMap: Record<string, { bg: string; icon: string; border: string }> = {
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', icon: 'text-purple-600 dark:text-purple-400', border: 'hover:border-purple-300 dark:hover:border-purple-800' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', icon: 'text-amber-600 dark:text-amber-400', border: 'hover:border-amber-300 dark:hover:border-amber-800' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'text-emerald-600 dark:text-emerald-400', border: 'hover:border-emerald-300 dark:hover:border-emerald-800' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', icon: 'text-blue-600 dark:text-blue-400', border: 'hover:border-blue-300 dark:hover:border-blue-800' },
  }
  const c = colorMap[color] ?? colorMap['purple']!

  return (
    <Link
      to={link}
      className={cn("bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 p-6 transition-all hover:shadow-lg group", c.border)}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", c.bg)}>
          <Icon size={22} className={c.icon} />
        </div>
        {pulse && <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse shadow-lg shadow-amber-500/50" />}
      </div>
      <p className="text-3xl font-black text-slate-900 dark:text-white mb-1">{value}</p>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{sub}</p>
      <p className="text-[10px] font-bold text-slate-400 mt-2">{label}</p>
    </Link>
  )
}

function ProgressBar({ label, value, total, color, textColor }: {
  label: string; value: number; total: number; color: string; textColor: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-bold">
        <span className="text-slate-500">{label}</span>
        <span className={textColor}>{value} <span className="text-slate-300">({pct}%)</span></span>
      </div>
      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-1000", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function KpiStatusCard({ label, value, total, icon: Icon, color }: {
  label: string; value: number; total: number; icon: any; color: string
}) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40',
    amber: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40',
    red: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40',
  }

  return (
    <div className={cn("p-5 rounded-2xl border", colorMap[color])}>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-1">{label}</p>
    </div>
  )
}

function QuickAction({ to, icon: Icon, iconColor, iconBg, title, description }: {
  to: string; icon: any; iconColor: string; iconBg: string; title: string; description: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group"
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform", iconBg)}>
        <Icon size={20} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{title}</p>
        <p className="text-xs text-slate-400 truncate">{description}</p>
      </div>
      <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
    </Link>
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
