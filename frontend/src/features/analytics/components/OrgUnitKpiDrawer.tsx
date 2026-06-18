import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Activity, Trophy, TrendingDown, ClipboardList } from 'lucide-react'
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  BarChart,
  Bar,
  Cell,
  Label,
} from 'recharts'
import { subDays, subMonths, startOfYear } from 'date-fns'
import { cn } from '@/lib/utils'
import { orgUnitKpiApi } from '@/features/dashboard/api/orgUnitKpiApi'
import type { OrgUnitAssigneeStat, OrgUnitSubmissionStat } from '@/features/dashboard/api/orgUnitKpiApi'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import ObjectiveDrawer from './ObjectiveDrawer'

type DateFilterType = 'GLOBAL' | 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_QUARTER' | '6_MONTHS' | 'THIS_YEAR' | 'CUSTOM'
type RankFilter = 'BEST' | 'WORST'
type TrendMode = 'PROGRESS' | 'BOTH' | 'PERFORMANCE'

const ASSIGNEE_COLORS = ['#f59e0b', '#8b5cf6', '#ec4899', '#0ea5e9', '#14b8a6', '#f97316', '#a855f7']
const COMPLETION_COLORS = { normal: '#10b981', dim: '#10b98140' }
const PERFORMANCE_COLORS = { normal: '#3b82f6', dim: '#3b82f640' }

// ── Trend chart tooltip ───────────────────────────────────────────────────────
function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-lg">
      <p className="font-bold text-slate-900 dark:text-white mb-3">{label}</p>
      <div className="space-y-2">
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-slate-500 font-medium min-w-[120px]">{p.name}:</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {p.name.includes('%') ? `${Math.round(p.value)}%` : p.value?.toLocaleString('vi-VN')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Generic bar tooltip ───────────────────────────────────────────────────────
function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const displayName = payload[0]?.payload?.tooltipName || label
  return (
    <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs shadow-xl border border-white/10 max-w-[220px]">
      <p className="font-bold mb-1 break-words">{displayName}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-bold">{Math.round(p.value)}%</span>
        </p>
      ))}
    </div>
  )
}

// ── Bar label on top (vertical bars) ─────────────────────────────────────────
function BarTopLabel({ x, y, width, value }: any) {
  if (!value) return null
  return (
    <text x={x + width / 2} y={y - 6} textAnchor="middle" fill="#64748b" fontSize={11} fontWeight={600}>
      {Math.round(value)}%
    </text>
  )
}

// ── BEST/WORST toggle header ──────────────────────────────────────────────────
function RankToggle({ filter, onChange }: { filter: RankFilter; onChange: (f: RankFilter) => void }) {
  return (
    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 gap-0.5">
      <button
        onClick={() => onChange('BEST')}
        className={cn(
          'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
          filter === 'BEST'
            ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
        )}
      >
        <Trophy size={11} /> Tốt nhất
      </button>
      <button
        onClick={() => onChange('WORST')}
        className={cn(
          'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
          filter === 'WORST'
            ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
        )}
      >
        <TrendingDown size={11} /> Trì trệ
      </button>
    </div>
  )
}

// ── Vertical bar chart for assignees (like TopObjectivesDualChart) ────────────
function AssigneeBarPanel({
  title,
  dataKey,
  data,
  filter,
  onFilterChange,
  colors,
  hoveredId,
  onHoverChange,
}: {
  title: string
  dataKey: keyof OrgUnitAssigneeStat
  data: OrgUnitAssigneeStat[]
  filter: RankFilter
  onFilterChange: (f: RankFilter) => void
  colors: { normal: string; dim: string }
  hoveredId: string | null
  onHoverChange: (id: string | null) => void
}) {
  const chartData = useMemo(() => {
    return [...data]
      .sort((a, b) =>
        filter === 'BEST'
          ? (b[dataKey] as number) - (a[dataKey] as number)
          : (a[dataKey] as number) - (b[dataKey] as number)
      )
      .map(a => ({
        ...a,
        displayName: a.fullName.length > 12 ? a.fullName.substring(0, 12) + '…' : a.fullName,
        tooltipName: a.fullName,
      }))
  }, [data, filter, dataKey])

  const maxVal = Math.max(...chartData.map(d => d[dataKey] as number), 100)
  const domain = Math.ceil(maxVal / 50) * 50
  const barSize = Math.max(20, Math.min(44, Math.floor(180 / Math.max(chartData.length, 1))))

  if (!data.length) return <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">Không có dữ liệu</div>

  return (
    <div className="bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-white/10 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</h4>
        <RankToggle filter={filter} onChange={onFilterChange} />
      </div>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 25, right: 10, left: 15, bottom: 20 }} onMouseLeave={() => onHoverChange(null)}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.15} />
            <XAxis dataKey="displayName" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} dy={5}>
              <Label value="Người thực hiện" offset={-5} position="insideBottom" style={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
            </XAxis>
            <YAxis tickFormatter={v => `${Math.round(v)}%`} domain={[0, domain]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false}>
              <Label value="(%) Tỷ lệ" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
            </YAxis>
            <Tooltip content={<BarTooltip />} cursor={{ fill: '#94a3b8', opacity: 0.08 }} />
            <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} wrapperStyle={{ paddingBottom: '12px', fontSize: 11, fontWeight: 500 }} />
            <Bar name={title} dataKey={dataKey as string} fill={colors.normal} radius={[4, 4, 0, 0]} barSize={barSize} isAnimationActive={false} label={<BarTopLabel />}>
              {chartData.map((item, idx) => (
                <Cell
                  key={idx}
                  fill={hoveredId !== null && hoveredId !== item.userId ? colors.dim : colors.normal}
                  onMouseEnter={() => onHoverChange(item.userId)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Horizontal bar chart for submissions (like TopUnitsDualChart) ─────────────
function SubmissionBarPanel({
  title,
  dataKey,
  data,
  filter,
  onFilterChange,
  colors,
  hoveredId,
  onHoverChange,
}: {
  title: string
  dataKey: keyof OrgUnitSubmissionStat
  data: OrgUnitSubmissionStat[]
  filter: RankFilter
  onFilterChange: (f: RankFilter) => void
  colors: { normal: string; dim: string }
  hoveredId: string | null
  onHoverChange: (id: string | null) => void
}) {
  const chartData = useMemo(() => {
    return [...data]
      .sort((a, b) =>
        filter === 'BEST'
          ? (b[dataKey] as number) - (a[dataKey] as number)
          : (a[dataKey] as number) - (b[dataKey] as number)
      )
      .map(s => ({
        ...s,
        displayLabel: s.submitterName.length > 18 ? s.submitterName.substring(0, 18) + '…' : s.submitterName,
        tooltipName: s.submitterName,
      }))
  }, [data, filter, dataKey])

  const maxVal = Math.max(...chartData.map(d => d[dataKey] as number), 100)
  const domain = Math.ceil(maxVal / 50) * 50

  if (!data.length) return <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">Không có dữ liệu</div>

  return (
    <div className="bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-white/10 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</h4>
        <RankToggle filter={filter} onChange={onFilterChange} />
      </div>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 50, left: 15, bottom: 25 }} onMouseLeave={() => onHoverChange(null)}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#94a3b8" strokeOpacity={0.1} />
            <XAxis type="number" domain={[0, domain]} tickFormatter={v => `${Math.round(v)}%`} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false}>
              <Label value="(%) Tỷ lệ" offset={-5} position="insideBottom" style={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
            </XAxis>
            <YAxis dataKey="displayLabel" type="category" width={130} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
            <Tooltip content={<BarTooltip />} cursor={{ fill: '#94a3b8', opacity: 0.06 }} />
            <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} wrapperStyle={{ paddingBottom: '10px', fontSize: 11, fontWeight: 500 }} />
            <Bar
              name={title}
              dataKey={dataKey as string}
              fill={colors.normal}
              radius={[0, 6, 6, 0]}
              barSize={16}
              isAnimationActive={false}
              label={{ position: 'right', fill: '#64748b', fontSize: 10, fontWeight: 600, formatter: (v: any) => `${Math.round(v)}%` }}
            >
              {chartData.map((item, idx) => (
                <Cell
                  key={idx}
                  fill={hoveredId !== null && hoveredId !== item.label ? colors.dim : colors.normal}
                  onMouseEnter={() => onHoverChange(item.label)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Main drawer ───────────────────────────────────────────────────────────────
export default function OrgUnitKpiDrawer({
  kpiId,
  onClose,
  globalFrom,
  globalTo,
  globalOnlyApproved,
  globalPeriodId,
}: {
  kpiId: string
  onClose: () => void
  globalFrom?: string
  globalTo?: string
  globalOnlyApproved?: boolean
  globalPeriodId?: string
}) {
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('GLOBAL')
  const [customRange, setCustomRange] = useState({ from: '', to: '' })
  const [activeAssignees, setActiveAssignees] = useState<string[]>([])
  const [trendMode, setTrendMode] = useState<TrendMode>('BOTH')
  // Assignee chart filters (independent per panel)
  const [assigneeCompFilter, setAssigneeCompFilter] = useState<RankFilter>('BEST')
  const [assigneePerfFilter, setAssigneePerfFilter] = useState<RankFilter>('BEST')
  // Submission chart filters (independent per panel)
  const [subCompFilter, setSubCompFilter] = useState<RankFilter>('BEST')
  const [subPerfFilter, setSubPerfFilter] = useState<RankFilter>('BEST')
  // Shared hover IDs for synchronized highlight across paired panels
  const [hoveredAssigneeId, setHoveredAssigneeId] = useState<string | null>(null)
  const [hoveredSubmissionId, setHoveredSubmissionId] = useState<string | null>(null)

  const { from, to } = useMemo(() => {
    if (dateFilterType === 'GLOBAL') return { from: globalFrom, to: globalTo }
    const now = new Date()
    switch (dateFilterType) {
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
  }, [dateFilterType, customRange, globalFrom, globalTo])

  const periodId = dateFilterType === 'GLOBAL' ? globalPeriodId : undefined

  const { data, isLoading } = useQuery({
    queryKey: ['orgUnitKpi', 'drawer', kpiId, from, to, globalOnlyApproved, periodId],
    queryFn: () => orgUnitKpiApi.getKpiDrawerData(kpiId, { from, to, onlyApproved: globalOnlyApproved, periodId }),
  })

  // Build trend chart data — team lines + per-active-assignee lines
  const trendChartData = useMemo(() => {
    if (!data?.chartPoints) return []
    return data.chartPoints.map(p => {
      const row: any = {
        label: p.label,
        targetValue: p.targetValue,
        teamTotalActual: p.teamTotalActual,
        teamPerformance: p.teamPerformance,
      }
      activeAssignees.forEach(uid => {
        const av = p.assigneeValues?.[uid]
        if (av) { row[`act_${uid}`] = av.actual; row[`prf_${uid}`] = av.performance }
      })
      return row
    })
  }, [data, activeAssignees])

  const toggleAssignee = (uid: string) =>
    setActiveAssignees(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid])

  const customTitle = (
    <div className="flex items-center flex-wrap gap-2">
      <span className="text-base font-bold text-slate-900 dark:text-white leading-snug">
        {data?.kpiName || 'Chi tiết KPI'}
      </span>
      {data?.isShared && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 text-[10px] font-black uppercase border border-purple-200 dark:border-purple-500/30 flex-shrink-0">
          <Users size={10} /> KPI chung
        </span>
      )}
    </div>
  )

  return (
    <ObjectiveDrawer isOpen={true} onClose={onClose} title={customTitle}>
      {isLoading ? (
        <div className="w-full min-h-[400px] flex items-center justify-center">
          <LoadingSkeleton rows={15} />
        </div>
      ) : (
        <div className="space-y-6 pb-10">
          {/* Date filter */}
          <div className="flex justify-end">
            <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-white/10 shadow-sm text-sm">
              <select
                value={dateFilterType}
                onChange={e => setDateFilterType(e.target.value as DateFilterType)}
                className="bg-transparent border-none outline-none text-slate-700 dark:text-slate-300 px-2 py-1 cursor-pointer font-medium"
              >
                <option value="GLOBAL">Theo bộ lọc KPI đơn vị</option>
                <option value="THIS_WEEK">Tuần này</option>
                <option value="THIS_MONTH">Tháng này</option>
                <option value="THIS_QUARTER">Quý này</option>
                <option value="6_MONTHS">6 tháng qua</option>
                <option value="THIS_YEAR">Năm nay</option>
                <option value="CUSTOM">Tùy chỉnh</option>
              </select>
              {dateFilterType === 'CUSTOM' && (
                <div className="flex items-center gap-2 px-2 border-l border-slate-200 dark:border-white/10">
                  <input type="date" className="bg-transparent border-none outline-none text-slate-700 dark:text-slate-300 text-xs" value={customRange.from} onChange={e => setCustomRange(prev => ({ ...prev, from: e.target.value }))} />
                  <span className="text-slate-400">-</span>
                  <input type="date" className="bg-transparent border-none outline-none text-slate-700 dark:text-slate-300 text-xs" value={customRange.to} onChange={e => setCustomRange(prev => ({ ...prev, to: e.target.value }))} />
                </div>
              )}
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-500 mb-1">Mục tiêu yêu cầu</p>
              <p className="text-xl font-black text-slate-900 dark:text-white">
                {data?.targetValue?.toLocaleString('vi-VN')} <span className="text-xs font-medium text-slate-500">{data?.unit}</span>
              </p>
            </div>
            <div className="bg-violet-50 dark:bg-violet-900/20 p-4 rounded-2xl border border-violet-100 dark:border-violet-900/30">
              <p className="text-[10px] font-bold text-violet-500 mb-1">Lũy kế tổng</p>
              <p className="text-xl font-black text-violet-700 dark:text-violet-400">
                {data?.totalActualValue?.toLocaleString('vi-VN')} <span className="text-xs font-medium text-violet-400">{data?.unit}</span>
              </p>
              <p className="text-[10px] font-bold text-violet-500 mt-1">Đạt {data?.totalProgress?.toFixed(1)}%</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
              <p className="text-[10px] font-bold text-emerald-500 mb-1">Hiệu suất nhóm</p>
              <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">{data?.teamPerformance?.toFixed(1)}%</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
              <p className="text-[10px] font-bold text-blue-500 mb-1">Tổng bài nộp</p>
              <p className="text-xl font-black text-blue-700 dark:text-blue-400">{data?.topSubmissions?.length ?? 0}</p>
            </div>
          </div>

          {/* Trend chart */}
          {data?.chartPoints && data.chartPoints.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800">
              {/* Header — matches AnalyticsComboChart style */}
              <div className="mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity size={18} className="text-violet-500" />
                  Xu hướng theo thời gian: Tiến độ & Hiệu suất
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  So sánh lũy kế thực tế với mục tiêu và hiệu suất nhóm theo từng mốc thời gian
                </p>
              </div>

              {/* Mode filter + assignee toggles on the same row */}
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div className="flex items-center gap-2">
                  {(
                    [
                      { value: 'BOTH', label: 'Cả hai' },
                      { value: 'PROGRESS', label: 'Chỉ Tiến độ' },
                      { value: 'PERFORMANCE', label: 'Chỉ Hiệu suất' },
                    ] as { value: TrendMode; label: string }[]
                  ).map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setTrendMode(value)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                        trendMode === value
                          ? 'bg-indigo-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {data.availableAssignees && data.availableAssignees.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-end">
                    {data.availableAssignees.map((a, idx) => (
                      <button
                        key={a.userId}
                        onClick={() => toggleAssignee(a.userId)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border',
                          activeAssignees.includes(a.userId)
                            ? 'text-white border-transparent'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-700'
                        )}
                        style={activeAssignees.includes(a.userId)
                          ? { backgroundColor: ASSIGNEE_COLORS[idx % ASSIGNEE_COLORS.length], borderColor: ASSIGNEE_COLORS[idx % ASSIGNEE_COLORS.length] }
                          : {}
                        }
                      >
                        {activeAssignees.includes(a.userId) && '✓ '}{a.fullName}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 px-1">
                {trendMode !== 'PERFORMANCE' ? <span>Đơn vị ({data.unit || ''})</span> : <span />}
                {trendMode !== 'PROGRESS' ? <span>(%) Hiệu suất</span> : <span />}
              </div>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis yAxisId="left" orientation="left" hide={trendMode === 'PERFORMANCE'} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis yAxisId="right" orientation="right" hide={trendMode === 'PROGRESS'} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `${Math.round(v)}%`} />
                    <Tooltip content={<TrendTooltip />} cursor={{ fill: '#94a3b8', opacity: 0.06 }} />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                    {trendMode !== 'PERFORMANCE' && (
                      <Line yAxisId="left" type="step" dataKey="targetValue" name="Mục tiêu" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                    )}
                    {trendMode !== 'PERFORMANCE' && (
                      <Line yAxisId="left" type="monotone" dataKey="teamTotalActual" name="Lũy kế tổng" stroke="#7c3aed" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    )}
                    {trendMode !== 'PROGRESS' && (
                      <Line yAxisId="right" type="monotone" dataKey="teamPerformance" name="Hiệu suất nhóm (%)" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                    )}
                    {activeAssignees.map((uid, idx) => {
                      const colorIdx = data.availableAssignees?.findIndex(a => a.userId === uid) ?? idx
                      const color = ASSIGNEE_COLORS[colorIdx % ASSIGNEE_COLORS.length]
                      const name = data.availableAssignees?.find(a => a.userId === uid)?.fullName || uid
                      return [
                        trendMode !== 'PERFORMANCE' && (
                          <Line key={`act_${uid}`} yAxisId="left" type="monotone" dataKey={`act_${uid}`} name={`Lũy kế - ${name}`} stroke={color} strokeWidth={1.5} dot={{ r: 2 }} opacity={0.8} />
                        ),
                        trendMode !== 'PROGRESS' && (
                          <Line key={`prf_${uid}`} yAxisId="right" type="monotone" dataKey={`prf_${uid}`} name={`Hiệu suất - ${name} (%)`} stroke={color} strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 4" opacity={0.8} />
                        ),
                      ]
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Top người đảm nhiệm ──────────────────────────────────────────── */}
          {data?.assigneeStats && data.assigneeStats.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5 mb-6">
                <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl shadow-lg shadow-amber-500/20">
                  <Users size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Top người đảm nhiệm</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Tiến độ và hiệu suất theo từng người thực hiện</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AssigneeBarPanel
                  title="Tiến độ hoàn thành"
                  dataKey="completionRate"
                  data={data.assigneeStats}
                  filter={assigneeCompFilter}
                  onFilterChange={setAssigneeCompFilter}
                  colors={COMPLETION_COLORS}
                  hoveredId={hoveredAssigneeId}
                  onHoverChange={setHoveredAssigneeId}
                />
                <AssigneeBarPanel
                  title="Hiệu suất"
                  dataKey="performanceRate"
                  data={data.assigneeStats}
                  filter={assigneePerfFilter}
                  onFilterChange={setAssigneePerfFilter}
                  colors={PERFORMANCE_COLORS}
                  hoveredId={hoveredAssigneeId}
                  onHoverChange={setHoveredAssigneeId}
                />
              </div>
            </div>
          )}

          {/* ── Top bài nộp ──────────────────────────────────────────────────── */}
          {data?.topSubmissions && data.topSubmissions.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5 mb-6">
                <div className="p-2 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
                  <ClipboardList size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Top bài nộp</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Tiến độ đóng góp và hiệu suất theo từng bài nộp</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SubmissionBarPanel
                  title="Tiến độ đóng góp"
                  dataKey="contributionProgress"
                  data={data.topSubmissions}
                  filter={subCompFilter}
                  onFilterChange={setSubCompFilter}
                  colors={COMPLETION_COLORS}
                  hoveredId={hoveredSubmissionId}
                  onHoverChange={setHoveredSubmissionId}
                />
                <SubmissionBarPanel
                  title="Hiệu suất bài nộp"
                  dataKey="performance"
                  data={data.topSubmissions}
                  filter={subPerfFilter}
                  onFilterChange={setSubPerfFilter}
                  colors={PERFORMANCE_COLORS}
                  hoveredId={hoveredSubmissionId}
                  onHoverChange={setHoveredSubmissionId}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </ObjectiveDrawer>
  )
}
