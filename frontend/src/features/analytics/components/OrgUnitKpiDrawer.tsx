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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { orgUnitKpiApi } from '@/features/dashboard/api/orgUnitKpiApi'
import type { OrgUnitAssigneeStat, OrgUnitSubmissionStat } from '@/features/dashboard/api/orgUnitKpiApi'
import { useAnalyticsDateFilter } from '@/components/common/AnalyticsDateFilter'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import ObjectiveDrawer from './ObjectiveDrawer'

type FilterSource = 'GLOBAL' | 'CUSTOM'
type RankFilter = 'BEST' | 'WORST'

const ASSIGNEE_COLORS = ['#f59e0b', '#8b5cf6', '#ec4899', '#0ea5e9', '#14b8a6', '#f97316', '#a855f7']
const COMPLETION_COLORS = { normal: '#10b981', dim: '#10b98140' }

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

// ── Context badge (thông tin ngữ cảnh cạnh tiêu đề) ──────────────────────────
const BADGE_STYLES: Record<string, string> = {
  violet: 'bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-900/40',
  slate: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  blue: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/40',
}
function ContextBadge({ color, label }: { color: keyof typeof BADGE_STYLES; label: string }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border', BADGE_STYLES[color])}>
      {label}
    </span>
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
  const [filterSource, setFilterSource] = useState<FilterSource>('GLOBAL')
  const [activeAssignees, setActiveAssignees] = useState<string[]>([])
  // Assignee chart filter
  const [assigneeCompFilter, setAssigneeCompFilter] = useState<RankFilter>('BEST')
  // Submission chart filter
  const [subCompFilter, setSubCompFilter] = useState<RankFilter>('BEST')
  // Hover IDs for highlight
  const [hoveredAssigneeId, setHoveredAssigneeId] = useState<string | null>(null)
  const [hoveredSubmissionId, setHoveredSubmissionId] = useState<string | null>(null)

  // Bộ lọc "Tùy chỉnh theo đợt" — dùng lại đúng bộ lọc global (đợt + granularity + tùy chỉnh).
  const local = useAnalyticsDateFilter({ selectClassName: 'h-8' })

  // Nguồn thời gian hiệu lực: theo bộ lọc KPI đơn vị (global) hoặc tùy chỉnh trong drawer.
  const from = filterSource === 'GLOBAL' ? globalFrom : local.from
  const to = filterSource === 'GLOBAL' ? globalTo : local.to
  const periodId = filterSource === 'GLOBAL' ? globalPeriodId : local.periodId

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
      }
      activeAssignees.forEach(uid => {
        const av = p.assigneeValues?.[uid]
        if (av) { row[`act_${uid}`] = av.actual }
      })
      return row
    })
  }, [data, activeAssignees])

  const toggleAssignee = (uid: string) =>
    setActiveAssignees(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid])

  const kpiTypeBadge = data?.isBonusKpi
    ? { label: 'KPI thưởng', cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30' }
    : data?.isReverseKpi
    ? { label: 'KPI ngược', cls: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-500/30' }
    : { label: 'KPI thường', cls: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700' }

  const customTitle = (
    <div className="flex items-center flex-wrap gap-2">
      <span className="text-base font-bold text-slate-900 dark:text-white leading-snug">
        {data?.kpiName || 'Chi tiết KPI'}
      </span>
      {data && (
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase border flex-shrink-0', kpiTypeBadge.cls)}>
          {kpiTypeBadge.label}
        </span>
      )}
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
          {/* Thông tin KPI (trái) + nguồn thời gian (phải) */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {data?.periodName && <ContextBadge color="slate" label={`Đợt: ${data.periodName}`} />}
              {data?.orgUnitName && <ContextBadge color="slate" label={`Phòng ban: ${data.orgUnitName}`} />}
              {data?.weight != null && <ContextBadge color="slate" label={`Trọng số: ${data.weight}`} />}
              {data?.unit && <ContextBadge color="slate" label={`Đơn vị đo: ${data.unit}`} />}
            </div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-end items-stretch sm:items-center gap-2">
              <Select value={filterSource} onValueChange={(v) => setFilterSource(v as FilterSource)}>
                <SelectTrigger className="h-8 w-full sm:w-[220px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="w-[var(--radix-select-trigger-width)]">
                  <SelectItem value="GLOBAL">Theo bộ lọc KPI đơn vị</SelectItem>
                  <SelectItem value="CUSTOM">Tùy chỉnh theo đợt</SelectItem>
                </SelectContent>
              </Select>
              {filterSource === 'CUSTOM' && local.controls}
            </div>
          </div>

          {/* Metrics — chỉ tiến độ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
              <p className="text-[10px] font-bold text-blue-500 mb-1">Tổng bài nộp</p>
              <p className="text-xl font-black text-blue-700 dark:text-blue-400">{data?.topSubmissions?.length ?? 0}</p>
            </div>
          </div>

          {/* Trend chart */}
          {data?.chartPoints && data.chartPoints.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800">
              {/* Header */}
              <div className="mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity size={18} className="text-violet-500" />
                  Xu hướng tiến độ theo thời gian
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  So sánh lũy kế thực tế với mục tiêu theo từng mốc thời gian
                </p>
              </div>

              {/* Assignee toggles — thêm đường lũy kế theo người (căn phải) */}
              {data.availableAssignees && data.availableAssignees.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4 justify-end">
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

              <div className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 px-1">
                <span>Đơn vị ({data.unit || ''})</span>
              </div>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip content={<TrendTooltip />} cursor={{ fill: '#94a3b8', opacity: 0.06 }} />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                    <Line yAxisId="left" type="step" dataKey="targetValue" name="Mục tiêu" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                    <Line yAxisId="left" type="monotone" dataKey="teamTotalActual" name="Lũy kế tổng" stroke="#7c3aed" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    {activeAssignees.map((uid, idx) => {
                      const colorIdx = data.availableAssignees?.findIndex(a => a.userId === uid) ?? idx
                      const color = ASSIGNEE_COLORS[colorIdx % ASSIGNEE_COLORS.length]
                      const name = data.availableAssignees?.find(a => a.userId === uid)?.fullName || uid
                      return (
                        <Line key={`act_${uid}`} yAxisId="left" type="monotone" dataKey={`act_${uid}`} name={`Lũy kế - ${name}`} stroke={color} strokeWidth={1.5} dot={{ r: 2 }} opacity={0.8} />
                      )
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">Tiến độ hoàn thành theo từng người thực hiện</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6">
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">Tiến độ đóng góp theo từng bài nộp</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6">
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
              </div>
            </div>
          )}
        </div>
      )}
    </ObjectiveDrawer>
  )
}
