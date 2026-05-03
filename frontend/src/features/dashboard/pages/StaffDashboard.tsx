import { useMemo } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import StatusBadge from '@/components/common/StatusBadge'
import { useMyKpiProgress } from '../hooks/useMyKpiProgress'
import { useMySubmissions } from '@/features/submissions/hooks/useMySubmissions'
import { useAuthStore } from '@/store/authStore'
import { Link } from 'react-router-dom'
import { getInitials, formatDateTime, formatNumber, cn } from '@/lib/utils'
import {
  Target, FileText, CheckCircle, XCircle, Clock, Plus,
  TrendingUp, Award, ArrowUpRight, Flame, BarChart3, ListChecks, Pin, PinOff
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
import { useOverviewStats } from '../hooks/useOverviewStats'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function StaffDashboard() {
  const { data: progress, isLoading: progressLoading } = useMyKpiProgress()
  const { data: submissions, isLoading: subLoading } = useMySubmissions(0, 5)
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: pinnedWidgets, isLoading: pinnedLoading, refetch: refetchPinned } = useQuery({
    queryKey: ['reports', 'widgets', 'pinned'],
    queryFn: () => reportApi.getPinnedWidgets(),
  })

  const isLoading = progressLoading || subLoading || pinnedLoading

  const totalAssigned = progress?.totalAssignedKpi ?? 0
  const totalSub = progress?.totalSubmissions ?? 0
  const approvedSub = progress?.approvedSubmissions ?? 0
  const pendingSub = progress?.pendingSubmissions ?? 0
  const rejectedSub = progress?.rejectedSubmissions ?? 0
  const avgScore = progress?.averageScore != null ? Number(progress.averageScore).toFixed(1) : '—'

  // Calculate approval rate
  const approvalRate = totalSub > 0 ? Math.round((approvedSub / totalSub) * 100) : 0

  if (isLoading) return <div className="p-8"><LoadingSkeleton rows={10} /></div>

  return (
    <div className="max-w-[1200px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">

      {/* ===== HERO BANNER ===== */}
      <div className="relative rounded-[32px] overflow-hidden shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djJoLTJ2LTJoMnptMC00aDJ2MmgtMnYtMnptLTQgMHYyaC0ydi0yaDJ6bTQgMGgydjJoLTJ2LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30 mix-blend-overlay" />
        
        <div className="relative z-10 px-8 py-10 md:p-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl font-black text-white border border-white/30 shadow-inner">
                {getInitials(user?.fullName ?? '')}
              </div>
              <div className="text-white">
                <p className="text-white/80 text-sm font-semibold uppercase tracking-wider">Không gian làm việc</p>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight mt-1">Xin chào, {user?.fullName?.split(' ').pop()}!</h1>
                <p className="text-white/70 text-sm font-medium mt-1.5 flex items-center gap-2">
                  <Flame size={16} className="text-amber-400" /> Tiếp tục duy trì phong độ làm việc xuất sắc nhé!
                </p>
              </div>
            </div>
            
            <Link 
              to="/submissions/new" 
              className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-indigo-700 text-sm font-black hover:bg-white/90 hover:scale-[1.02] transition-all shadow-xl hover:shadow-2xl hover:shadow-white/20 shrink-0"
            >
              <Plus size={18} /> Nộp Báo cáo KPI
            </Link>
          </div>
        </div>
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

      {/* ===== OVERVIEW GRID ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column - Stats */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Main Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard 
              label="KPI Được giao" 
              value={totalAssigned} 
              icon={Target} 
              color="indigo" 
            />
            <StatCard 
              label="Tổng Bài nộp" 
              value={totalSub} 
              icon={FileText} 
              color="blue" 
            />
            <StatCard 
              label="Tỷ lệ Duyệt" 
              value={`${approvalRate}%`} 
              icon={TrendingUp} 
              color="emerald" 
            />
            <StatCard 
              label="Bị Từ chối" 
              value={rejectedSub} 
              icon={XCircle} 
              color="red" 
            />
          </div>

          {/* Progress Details */}
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 space-y-6 w-full">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 size={20} className="text-indigo-500" /> Trạng thái Bài nộp
                  </h3>
                  <p className="text-xs font-medium text-slate-500 mt-1">Phân bổ kết quả các báo cáo bạn đã nộp</p>
                </div>
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600"><CheckCircle size={14} /></div>
                  <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600"><Clock size={14} /></div>
                  <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600"><XCircle size={14} /></div>
                </div>
              </div>
              
              <div className="space-y-4">
                <ProgressBar label="Đã phê duyệt" value={approvedSub} total={totalSub} color="bg-emerald-500" textColor="text-emerald-700 dark:text-emerald-400" />
                <ProgressBar label="Đang chờ duyệt" value={pendingSub} total={totalSub} color="bg-amber-500" textColor="text-amber-700 dark:text-amber-400" />
              </div>
            </div>

            {/* Score Highlight */}
            <div className="w-full md:w-48 bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 text-center border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center shrink-0">
              <Award size={28} className="text-amber-500 mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Điểm Đánh giá TB</p>
              <div className="flex items-baseline justify-center gap-1 mt-1">
                <span className="text-4xl font-black text-slate-900 dark:text-white">{avgScore}</span>
                <span className="text-sm font-bold text-slate-500">/100</span>
              </div>
              <Link to="/evaluations" className="text-[10px] font-bold text-indigo-600 hover:underline mt-3">Xem chi tiết &rarr;</Link>
            </div>
          </div>
        </div>

        {/* Right Column - Recent Activity */}
        <div className="lg:col-span-4">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-full flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/10">
              <div className="flex items-center gap-2">
                <ListChecks size={18} className="text-blue-500" />
                <h3 className="font-black text-sm text-slate-900 dark:text-white">Giao dịch gần đây</h3>
              </div>
              <Link to="/submissions" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center">
                Lịch sử <ArrowUpRight size={14} />
              </Link>
            </div>
            
            <div className="p-2 flex-1">
              {subLoading ? (
                <div className="p-4"><LoadingSkeleton type="table" rows={4} /></div>
              ) : !submissions || submissions.content.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-60">
                  <FileText size={48} className="text-slate-300 mb-4" />
                  <p className="text-sm font-bold text-slate-500">Chưa có bài nộp nào</p>
                  <p className="text-xs text-slate-400 mt-1">Các bài nộp KPI của bạn sẽ hiển thị tại đây.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {submissions.content.map((s) => (
                    <Link 
                      key={s.id} 
                      to={`/submissions/${s.id}`} 
                      className="flex items-center gap-3 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 flex items-center justify-center shrink-0">
                        <FileText size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-200 truncate group-hover:text-indigo-600 transition-colors">
                          {s.kpiCriteriaName}
                        </p>
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mt-0.5">
                          <span>{formatDateTime(s.createdAt).split(' ')[0]}</span>
                          <span>•</span>
                          <span className="truncate">Thực tế: {formatNumber(s.actualValue)}</span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <StatusBadge status={s.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            
            {!subLoading && submissions && submissions.content.length > 0 && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                <Link to="/submissions" className="block w-full py-2.5 text-center text-xs font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors">
                  Xem toàn bộ danh sách
                </Link>
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  )
}

/* ========== Sub Components ========== */

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number | string; icon: any; color: string
}) {
  const colorMap: Record<string, { bg: string; icon: string }> = {
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', icon: 'text-indigo-600 dark:text-indigo-400' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', icon: 'text-blue-600 dark:text-blue-400' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'text-emerald-600 dark:text-emerald-400' },
    red: { bg: 'bg-red-50 dark:bg-red-900/20', icon: 'text-red-600 dark:text-red-400' },
  }
  const c = colorMap[color] ?? colorMap['indigo']!

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 p-5 transition-all hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-800 group">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", c.bg)}>
        <Icon size={18} className={c.icon} />
      </div>
      <p className="text-2xl font-black text-slate-900 dark:text-white mb-1">{value}</p>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{label}</p>
    </div>
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
        <span className={textColor}>{value} <span className="text-slate-400 dark:text-slate-500 opacity-70">({pct}%)</span></span>
      </div>
      <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-1000", color)} style={{ width: `${pct}%` }} />
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
