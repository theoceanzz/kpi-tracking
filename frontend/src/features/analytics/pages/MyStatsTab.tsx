import { useState, useMemo, useRef, useEffect } from 'react'
import { personalKpiApi } from '@/features/dashboard/api/personalKpiApi'
import { useMyAnalytics } from '../hooks/useAnalytics'
import { useNotifications } from '@/features/notifications/hooks/useNotifications'
import { useQuery } from '@tanstack/react-query'
import {
  Target, TrendingUp, AlertTriangle, CheckCircle,
  ChevronDown, ChevronRight, ChevronUp, ChevronsUpDown,
  User, Users, X, Bell, Star, ArrowUpDown, Search, ChevronLeft,
  Activity, BarChart3 as BarChartIcon, PieChart as PieChartIcon, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts'

import AnalyticsComboChart from '../components/AnalyticsComboChart'
import MyKpiDrawer from '../components/MyKpiDrawer'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import Pagination from '@/components/common/Pagination'

import { subDays, subMonths, startOfYear, format } from 'date-fns'

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e']

type DateFilterType = 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_QUARTER' | '6_MONTHS' | 'THIS_YEAR' | 'CUSTOM'
type SortField = 'progress' | 'performance' | 'period'
type SortDir = 'asc' | 'desc'
type SharedFilter = 'ALL' | 'SHARED' | 'PERSONAL'

const PAGE_SIZE = 5

export default function MyStatsTab() {
  const [filterStuck, setFilterStuck] = useState(false)
  const filterSentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = filterSentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setFilterStuck(!entry.isIntersecting),
      { rootMargin: '-65px 0px 0px 0px', threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const [filterType, setFilterType] = useState<DateFilterType>('THIS_YEAR')
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>({ from: '', to: '' })
  const [onlyApproved, setOnlyApproved] = useState<boolean>(false)

  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null)

  const [filterShared, setFilterShared] = useState<SharedFilter>('ALL')
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)

  const { from, to } = useMemo(() => {
    const now = new Date()
    switch (filterType) {
      case 'THIS_WEEK':    return { from: subDays(now, 7).toISOString(),   to: now.toISOString() }
      case 'THIS_MONTH':   return { from: subDays(now, 30).toISOString(),  to: now.toISOString() }
      case 'THIS_QUARTER': return { from: subDays(now, 90).toISOString(),  to: now.toISOString() }
      case '6_MONTHS':     return { from: subMonths(now, 6).toISOString(), to: now.toISOString() }
      case 'THIS_YEAR':    return { from: startOfYear(now).toISOString(),  to: now.toISOString() }
      case 'CUSTOM':
        return {
          from: customRange.from ? new Date(customRange.from).toISOString() : undefined,
          to:   customRange.to   ? new Date(customRange.to).toISOString()   : undefined,
        }
      default: return { from: undefined, to: undefined }
    }
  }, [filterType, customRange])

  // ── New KPI analytics (standalone KPIs without KeyResult) ────────────────
  const { data: metrics, isLoading: isMetricsLoading } = useQuery({
    queryKey: ['personalKpi', 'metrics', from, to, onlyApproved],
    queryFn: () => personalKpiApi.getMetrics({ from, to, onlyApproved }),
  })
  const { data: chartData, isLoading: isChartLoading } = useQuery({
    queryKey: ['personalKpi', 'chart', from, to, onlyApproved],
    queryFn: () => personalKpiApi.getComboChart({ from, to, onlyApproved }),
  })
  const { data: kpiPage, isLoading: isKpisLoading } = useQuery({
    queryKey: ['personalKpi', 'details', from, to, onlyApproved, sortField, sortDir, filterShared, page],
    queryFn: () => personalKpiApi.getDetailedKpis({
      from, to, onlyApproved,
      sortBy: sortField ?? undefined,
      sortDir,
      sharedType: filterShared === 'ALL' ? undefined : filterShared,
      page,
      size: PAGE_SIZE,
    }),
  })

  // ── Old analytics data ───────────────────────────────────────────────────
  const { data: analyticsData } = useMyAnalytics(from, to)
  const { data: notificationsData } = useNotifications(0, 50)

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
    setPage(0)
  }

  if (isMetricsLoading || isChartLoading)
    return <div className="p-8"><LoadingSkeleton rows={10} /></div>

  // ── Old chart data preparation ───────────────────────────────────────────
  const submissionsPieData = [
    { name: 'Đã duyệt', value: analyticsData?.approvedSubmissions ?? 0 },
    { name: 'Chờ duyệt', value: analyticsData?.pendingSubmissions ?? 0 },
    { name: 'Từ chối',   value: analyticsData?.rejectedSubmissions ?? 0 },
  ].filter(v => v.value > 0)

  const kpiStatusDistData = (() => {
    const dist: Record<string, number> = {}
    for (const k of analyticsData?.kpiItems ?? []) {
      dist[k.status] = (dist[k.status] ?? 0) + 1
    }
    return Object.entries(dist).map(([name, value]) => ({ name, value }))
  })()

  const evalTrendData = [...(analyticsData?.evaluationHistory ?? [])]
    .reverse()
    .map(e => ({
      name: new Date(e.createdAt).toLocaleDateString('vi-VN'),
      value: e.score ?? 0,
    }))

  const notifReadCount   = notificationsData?.content.filter(n => n.isRead).length ?? 0
  const notifUnreadCount = (notificationsData?.totalElements ?? 0) - notifReadCount
  const notifStatData = [
    { name: 'Đã đọc',   value: notifReadCount },
    { name: 'Chưa đọc', value: notifUnreadCount },
  ].filter(v => v.value > 0)

  return (
    <div className="space-y-6">
      {/* ── Sentinel for sticky detection ─────────────────────────────────── */}
      <div ref={filterSentinelRef} className="h-px" aria-hidden />

      {/* ── Global Filter Toolbar ──────────────────────────────────────────── */}
      <div className={cn(
        'sticky top-16 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap items-center gap-4 justify-between transition-all duration-200',
        filterStuck ? 'p-3 shadow-lg shadow-slate-200/80 dark:shadow-slate-950/60' : 'p-4 shadow-sm'
      )}>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-violet-50 dark:bg-violet-900/30 rounded-lg text-violet-600 dark:text-violet-400">
            <Target size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Bộ lọc KPI của tôi</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Lọc dữ liệu đồng bộ cho tất cả biểu đồ</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4.5 h-4.5 text-violet-600 border-slate-300 rounded focus:ring-violet-500 bg-slate-50 dark:bg-slate-800"
              checked={onlyApproved}
              onChange={e => setOnlyApproved(e.target.checked)}
            />
            Chỉ tính bài nộp đã duyệt
          </label>

          <select
            className="h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-violet-500/50"
            value={filterType}
            onChange={e => setFilterType(e.target.value as DateFilterType)}
          >
            <option value="THIS_WEEK">Tuần này</option>
            <option value="THIS_MONTH">Tháng này</option>
            <option value="THIS_QUARTER">Quý này</option>
            <option value="6_MONTHS">6 tháng gần đây</option>
            <option value="THIS_YEAR">Năm nay</option>
            <option value="CUSTOM">Tùy chỉnh...</option>
          </select>

          {filterType === 'CUSTOM' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-violet-500/50"
                value={customRange.from}
                onChange={e => setCustomRange(prev => ({ ...prev, from: e.target.value }))}
              />
              <span className="text-slate-400">-</span>
              <input
                type="date"
                className="h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-violet-500/50"
                value={customRange.to}
                onChange={e => setCustomRange(prev => ({ ...prev, to: e.target.value }))}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── New Metric Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
            <Target size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Tổng KPI</p>
            <p className="text-2xl font-black">{(metrics?.runningKpis ?? 0) + (metrics?.completedKpis ?? 0)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Tiến độ TB</p>
            <p className="text-2xl font-black">{metrics?.averageProgress?.toFixed(1) ?? 0}%</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Target size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Hiệu suất TB</p>
            <p className="text-2xl font-black">{metrics?.averagePerformance?.toFixed(1) ?? 0}%</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Đang chạy / HT</p>
            <p className="text-base font-black">{metrics?.runningKpis ?? 0} / {metrics?.completedKpis ?? 0}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Rủi ro / Chậm</p>
            <p className="text-2xl font-black">{metrics?.riskKpis ?? 0}</p>
          </div>
        </div>
      </div>

      {/* ── New Combo Chart ─────────────────────────────────────────────────── */}
      <div className="pt-2">
        <AnalyticsComboChart
          data={chartData?.points || []}
          isLoading={isChartLoading}
          itemName="KPI đảm nhiệm"
        />
      </div>

      {/* ── New Detail Table ────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-black">Bảng chi tiết KPI đang đảm nhiệm</h3>
          <span className="text-xs font-bold text-slate-400">{kpiPage?.totalElements ?? 0} KPI</span>
        </div>

        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
          <div className="flex gap-0.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {([['ALL', 'Tất cả'], ['SHARED', 'Mục tiêu chung'], ['PERSONAL', 'Mục tiêu riêng']] as [SharedFilter, string][]).map(([v, label]) => (
              <button
                key={v}
                onClick={() => { setFilterShared(v); setPage(0) }}
                className={cn(
                  'px-3 py-1 rounded-md text-[11px] font-black transition-all',
                  filterShared === v
                    ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {filterShared !== 'ALL' && (
            <button
              onClick={() => { setFilterShared('ALL'); setPage(0) }}
              className="flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <X size={13} /> Xóa bộ lọc
            </button>
          )}
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-xs font-black uppercase text-slate-500">
                <th className="px-6 py-4 w-10"></th>
                <th className="px-6 py-4">Tên KPI</th>
                <th className="px-6 py-4 whitespace-nowrap">
                  <SortHeader field="period" active={sortField} dir={sortDir} onToggle={toggleSort}>
                    Chu kỳ thực hiện
                  </SortHeader>
                </th>
                <th className="px-6 py-4 min-w-[250px]">
                  <SortHeader field="progress" active={sortField} dir={sortDir} onToggle={toggleSort}>
                    Tiến độ KPI
                  </SortHeader>
                </th>
                <th className="px-6 py-4 text-center">
                  <SortHeader field="performance" active={sortField} dir={sortDir} onToggle={toggleSort}>
                    Hiệu suất
                  </SortHeader>
                </th>
                <th className="px-6 py-4">Phân loại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isKpisLoading
                ? <tr><td colSpan={6} className="p-6"><LoadingSkeleton rows={5} /></td></tr>
                : kpiPage?.content?.map(kpi => (
                    <ExpandableKpiRow key={kpi.kpiId} kpi={kpi} onOpenDrawer={() => setSelectedKpiId(kpi.kpiId)} />
                  ))}
              {!isKpisLoading && (kpiPage?.totalElements ?? 0) === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Không có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {(kpiPage?.totalElements ?? 0) > 0 && (
          <Pagination
            currentPage={page}
            totalPages={kpiPage?.totalPages ?? 1}
            onPageChange={setPage}
            totalElements={kpiPage?.totalElements ?? 0}
            size={PAGE_SIZE}
            itemLabel="KPI"
          />
        )}
      </div>

      {/* ── Old: Trạng thái bài nộp + Phân bổ trạng thái KPI ───────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <OldChartCard title="Trạng thái bài nộp" icon={<PieChartIcon size={16} className="text-indigo-500" />}>
          {submissionsPieData.length === 0
            ? <EmptyChart />
            : <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={submissionsPieData} innerRadius="50%" outerRadius="78%" paddingAngle={5} dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {submissionsPieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={32} />
                </PieChart>
              </ResponsiveContainer>
          }
        </OldChartCard>

        <OldChartCard title="Phân bổ trạng thái KPI" icon={<BarChartIcon size={16} className="text-violet-500" />}>
          {kpiStatusDistData.length === 0
            ? <EmptyChart />
            : <ResponsiveContainer width="100%" height={240}>
                <BarChart data={kpiStatusDistData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {kpiStatusDistData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
          }
        </OldChartCard>
      </div>

      {/* ── Old: Thông báo mới nhất + Thống kê thông báo ───────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <OldChartCard title="Thông báo mới nhất" icon={<Bell size={16} className="text-amber-500" />} noPadBody>
          <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-[320px] overflow-auto custom-scrollbar">
            {(notificationsData?.content ?? []).length === 0 && (
              <div className="p-6 text-center text-sm text-slate-400">Không có thông báo</div>
            )}
            {notificationsData?.content.slice(0, 10).map(n => (
              <div key={n.id} className={cn('px-5 py-3 flex items-start gap-3 transition-all', n.isRead ? 'opacity-60' : '')}>
                <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', n.isRead ? 'bg-slate-300' : 'bg-indigo-600')} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs leading-relaxed', n.isRead ? 'text-slate-500' : 'text-slate-900 dark:text-white font-bold')}>{n.message}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{new Date(n.createdAt).toLocaleString('vi-VN')}</p>
                </div>
              </div>
            ))}
          </div>
        </OldChartCard>

        <OldChartCard title="Thống kê thông báo" icon={<PieChartIcon size={16} className="text-emerald-500" />}>
          {notifStatData.length === 0
            ? <EmptyChart />
            : <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={notifStatData} innerRadius="50%" outerRadius="78%" paddingAngle={5} dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {notifStatData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={32} />
                </PieChart>
              </ResponsiveContainer>
          }
        </OldChartCard>
      </div>

      {/* ── Old: Lịch sử đánh giá + Xu hướng điểm số ───────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <EvaluationTableWidget data={analyticsData?.evaluationHistory ?? []} title="Lịch sử đánh giá" />

        <OldChartCard title="Xu hướng điểm số" icon={<Activity size={16} className="text-indigo-500" />}>
          {evalTrendData.length === 0
            ? <EmptyChart />
            : <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={evalTrendData}>
                  <defs>
                    <linearGradient id="evalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} domain={[0, 10]} />
                  <Tooltip />
                  <Area type="monotone" dataKey="value" name="Điểm" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#evalGrad)" dot={{ r: 4, fill: '#6366f1' }} />
                </AreaChart>
              </ResponsiveContainer>
          }
        </OldChartCard>
      </div>

      {selectedKpiId && (
        <MyKpiDrawer
          kpiId={selectedKpiId}
          onClose={() => setSelectedKpiId(null)}
          globalFrom={from}
          globalTo={to}
        />
      )}
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function SortHeader({
  field, active, dir, onToggle, children,
}: {
  field: SortField
  active: SortField | null
  dir: SortDir
  onToggle: (f: SortField) => void
  children: React.ReactNode
}) {
  const isActive = active === field
  return (
    <button onClick={() => onToggle(field)} className="flex items-center gap-1 group hover:text-violet-500 transition-colors">
      {children}
      <span className="ml-0.5">
        {isActive
          ? dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
          : <ChevronsUpDown size={12} className="opacity-30 group-hover:opacity-60" />}
      </span>
    </button>
  )
}

function KpiDateRange({ start, end }: { start: string | null; end: string | null }) {
  const fmt = (d: string | null) => d ? format(new Date(d), 'dd/MM/yyyy') : '—'
  return (
    <div className="inline-flex flex-col gap-1 text-[11px]">
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-[26px] shrink-0">Từ</span>
        <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">{fmt(start)}</span>
      </div>
      <div className="w-full h-px bg-slate-100 dark:bg-slate-800" />
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-violet-400 dark:text-violet-500 uppercase tracking-wider w-[26px] shrink-0">Đến</span>
        <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">{fmt(end)}</span>
      </div>
    </div>
  )
}

function ExpandableKpiRow({ kpi, onOpenDrawer }: { kpi: any; onOpenDrawer: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const pct  = Math.round(kpi.progress    || 0)
  const perf = Math.round(kpi.performance || 0)

  return (
    <>
      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
        <td className="px-6 py-4">
          <button onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">
            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
        </td>
        <td className="px-6 py-4 cursor-pointer" onClick={onOpenDrawer}>
          <div className="font-bold text-sm text-slate-900 hover:text-violet-500 dark:text-white dark:hover:text-violet-400 transition-colors truncate max-w-[240px]">{kpi.kpiName}</div>
        </td>
        <td className="px-6 py-4">
          <KpiDateRange start={kpi.periodStart} end={kpi.periodEnd} />
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-emerald-500' : 'bg-violet-500')}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className="text-xs font-black">{pct}%</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {kpi.actualValue?.toLocaleString('vi-VN')} / {kpi.targetValue?.toLocaleString('vi-VN')} {kpi.unit}
          </div>
        </td>
        <td className="px-6 py-4 text-center">
          <div className="inline-flex relative items-center justify-center w-12 h-12">
            <svg className="w-12 h-12 transform -rotate-90">
              <circle className="text-slate-100 dark:text-slate-800" strokeWidth="4" stroke="currentColor" fill="transparent" r="20" cx="24" cy="24" />
              <circle
                className={cn(perf >= 100 ? 'text-emerald-500' : perf >= 80 ? 'text-violet-500' : perf >= 50 ? 'text-amber-500' : 'text-red-500')}
                strokeWidth="4" strokeDasharray={125.6}
                strokeDashoffset={125.6 - (Math.min(perf, 100) / 100) * 125.6}
                strokeLinecap="round" stroke="currentColor" fill="transparent" r="20" cx="24" cy="24"
              />
            </svg>
            <span className="absolute text-[10px] font-black">{perf}%</span>
          </div>
        </td>
        <td className="px-6 py-4">
          {kpi.shared ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px] font-black uppercase">
              <Users size={12} /> Chung ({kpi.participantCount})
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase">
              <User size={12} /> Riêng
            </div>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="p-0 border-b border-slate-100 dark:border-slate-800">
            <div className="bg-slate-50/50 dark:bg-slate-900/50 p-6 flex flex-col gap-6 border-l-4 border-violet-500">
              <div className="w-full space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Lịch sử bài nộp của tôi</h4>
                {kpi.mySubmissions && kpi.mySubmissions.length > 0 ? (
                  <div className="space-y-3">
                    {kpi.mySubmissions.map((sub: any) => (
                      <div key={sub.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between gap-4">
                        <div className="w-[120px]">
                          <p className="text-sm font-bold">{sub.code}</p>
                        </div>
                        <div className="w-[150px]">
                          <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Thời gian nộp</p>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {new Date(sub.submitDate).toLocaleString('vi-VN', {
                              hour: '2-digit', minute: '2-digit',
                              day: '2-digit', month: '2-digit', year: 'numeric',
                            })}
                          </p>
                        </div>
                        <div className="flex-1 max-w-[200px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-slate-500">Đóng góp</span>
                            <span className="text-[10px] font-black">{sub.contributionProgress?.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full">
                            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min(sub.contributionProgress, 100)}%` }} />
                          </div>
                          <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 mt-1">+{sub.actualValue?.toLocaleString('vi-VN')} {kpi.unit}</p>
                        </div>
                        <div className="text-center w-[100px]">
                          <p className="text-[10px] text-slate-500">Hiệu suất</p>
                          <p className="text-sm font-black text-violet-500">{sub.performance?.toFixed(1)}%</p>
                        </div>
                        <div>
                          <span className={cn(
                            'px-2 py-1 rounded text-[10px] font-black uppercase',
                            sub.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                            sub.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          )}>
                            {sub.status === 'APPROVED' ? 'ĐÃ DUYỆT' : sub.status === 'REJECTED' ? 'TỪ CHỐI' : 'CHỜ DUYỆT'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">Chưa có bài nộp nào.</div>
                )}
              </div>

              {kpi.shared && kpi.teammates?.length > 0 && (
                <div className="w-full space-y-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Đồng đội cùng thực hiện</h4>
                  <div className="space-y-3">
                    {kpi.teammates.map((tm: any) => (
                      <div key={tm.userId} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 w-[250px]">
                          {tm.avatarUrl
                            ? <img src={tm.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                            : <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-bold">{tm.fullName.charAt(0)}</div>
                          }
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate">{tm.fullName}</p>
                            <p className="text-[10px] text-slate-500">{tm.employeeCode}</p>
                          </div>
                        </div>
                        <div className="flex-1 max-w-[250px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-slate-500">Tiến độ cá nhân</span>
                            <span className="text-[10px] font-black">{tm.progress?.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(tm.progress, 100)}%` }} />
                          </div>
                        </div>
                        <div className="text-center sm:text-right w-[100px]">
                          <p className="text-[10px] text-slate-500">Hiệu suất</p>
                          <p className="text-sm font-black text-violet-500">{tm.performance?.toFixed(1)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function OldChartCard({
  title, icon, children, noPadBody,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  noPadBody?: boolean
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
      <div className="p-5 border-b border-slate-100 dark:border-slate-800">
        <h3 className="font-black text-sm flex items-center gap-2">{icon}{title}</h3>
      </div>
      <div className={cn('flex-1', noPadBody ? '' : 'p-5')}>{children}</div>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-[240px] flex flex-col items-center justify-center text-slate-400 gap-2">
      <Info size={24} className="opacity-20" />
      <span className="text-[10px] font-bold uppercase tracking-wider">Chưa có dữ liệu</span>
    </div>
  )
}


function EvaluationTableWidget({ data, title }: { data: any[]; title: string }) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 5

  const filteredData = useMemo(() => {
    let result = [...data]
    if (filter) {
      result = result.filter(item =>
        item.kpiName.toLowerCase().includes(filter.toLowerCase()) ||
        item.evaluatorName.toLowerCase().includes(filter.toLowerCase())
      )
    }
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? ''
        const bVal = b[sortConfig.key] ?? ''
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }
    return result
  }, [data, filter, sortConfig])

  const totalPages = Math.ceil(filteredData.length / pageSize)
  const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize)

  const handleSort = (key: string) => {
    setSortConfig(prev =>
      prev?.key === key && prev.direction === 'asc'
        ? { key, direction: 'desc' }
        : { key, direction: 'asc' }
    )
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
        <h3 className="font-black text-sm flex items-center gap-2 shrink-0">
          <Star size={16} className="text-amber-500" /> {title}
        </h3>
        <div className="relative max-w-[200px] w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm..."
            value={filter}
            onChange={e => { setFilter(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/50 z-10">
            <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              <th className="px-5 py-3 cursor-pointer hover:text-slate-600 transition-colors" onClick={() => handleSort('score')}>
                <div className="flex items-center gap-1">Điểm <ArrowUpDown size={10} /></div>
              </th>
              <th className="px-3 py-3 cursor-pointer hover:text-slate-600 transition-colors" onClick={() => handleSort('kpiName')}>
                <div className="flex items-center gap-1">Chỉ tiêu <ArrowUpDown size={10} /></div>
              </th>
              <th className="px-3 py-3 cursor-pointer hover:text-slate-600 transition-colors" onClick={() => handleSort('evaluatorName')}>
                <div className="flex items-center gap-1">Người đánh giá <ArrowUpDown size={10} /></div>
              </th>
              <th className="px-3 py-3 text-right cursor-pointer hover:text-slate-600 transition-colors" onClick={() => handleSort('createdAt')}>
                <div className="flex items-center justify-end gap-1">Ngày đánh giá <ArrowUpDown size={10} /></div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {paginatedData.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-sm text-slate-400">Không có dữ liệu</td>
              </tr>
            )}
            {paginatedData.map(e => (
              <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-5 py-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shadow-sm',
                    (e.score ?? 0) >= 8 ? 'bg-emerald-100 text-emerald-700' :
                    (e.score ?? 0) >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  )}>{e.score?.toFixed(1) ?? '—'}</div>
                </td>
                <td className="px-3 py-3">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[180px]">{e.kpiName}</p>
                </td>
                <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-400 font-medium">{e.evaluatorName}</td>
                <td className="px-3 py-3 text-right text-[11px] text-slate-500 font-bold">
                  {new Date(e.createdAt).toLocaleDateString('vi-VN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Trang {page} / {totalPages}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 transition-colors shadow-sm border border-transparent hover:border-slate-200">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 transition-colors shadow-sm border border-transparent hover:border-slate-200">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
