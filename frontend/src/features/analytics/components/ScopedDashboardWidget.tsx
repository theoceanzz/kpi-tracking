import React, { useState, useCallback, useRef, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { statsApi } from '@/features/dashboard/api/statsApi'
import { personalObjectiveApi } from '@/features/dashboard/api/personalObjectiveApi'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import {
  Loader2,
  Target,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Trophy,
  Building2,
  TrendingDown,
} from 'lucide-react'
import ObjectiveMetricCard from './ObjectiveMetricCard'
import AnalyticsComboChart from './AnalyticsComboChart'
import { subDays, subMonths, startOfYear } from 'date-fns'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  Label,
  ComposedChart,
  Line,
} from 'recharts'
import type { ScopedDashboardResponse } from '@/types/stats'

// Re-use the TopUnit shape from ScopedDashboardResponse directly
type ScopedTopUnit = ScopedDashboardResponse['topUnits'][number]

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  type: 'OBJECTIVE' | 'KR' | 'KPI'
  id: string
  dateRange: { from: string | undefined; to: string | undefined }
  onlyApproved?: boolean
}

type FilterType = 'BEST' | 'WORST'
type DateFilterType = 'GLOBAL' | 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_QUARTER' | '6_MONTHS' | 'THIS_YEAR' | 'CUSTOM'

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPLETION_COLORS = { normal: '#10b981', dim: '#10b98140' }
const PERFORMANCE_COLORS = { normal: '#3b82f6', dim: '#3b82f640' }

// ─── Sub-components ───────────────────────────────────────────────────────────

function DualTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null
  const item = payload[0]?.payload
  return (
    <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs shadow-xl border border-white/10 max-w-[280px] break-words">
      <p className="font-bold mb-1">{item?.name || label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-bold">{Math.round(p.value)}%</span>
        </p>
      ))}
    </div>
  )
}

/**
 * Horizontal dual bar chart for top child items (Key Results or KPIs).
 * Shows completion rate (left chart) and performance rate (right chart) side by side.
 */
function TopItemsDualChart({
  data,
  title,
  filterType,
  onFilterChange,
}: {
  data: ScopedDashboardResponse['topItems']
  title: string
  filterType: FilterType
  onFilterChange: (f: FilterType) => void
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const hoverRef = useRef<number | null>(null)

  const onCellEnter = useCallback((_: any, index: number) => {
    if (hoverRef.current !== index) {
      hoverRef.current = index
      setHoverIndex(index)
    }
  }, [])

  const onChartLeave = useCallback(() => {
    hoverRef.current = null
    setHoverIndex(null)
  }, [])

  // Sort based on filter
  const sorted = [...data]
    .sort((a, b) =>
      filterType === 'BEST'
        ? b.performanceRate - a.performanceRate
        : a.performanceRate - b.performanceRate
    )
    .slice(0, 5)
    .map((item) => {
      const isHexCode = /^[0-9a-fA-F]{8}$/.test(item.code || '');
      const isStatus = ['APPROVED', 'PENDING', 'REJECTED'].includes(item.code || '');
      const displayLabel = (item.code && !isHexCode && !isStatus)
        ? item.code
        : (item.name.length > 18 ? item.name.substring(0, 18) + '…' : item.name);
      return {
        ...item,
        displayName: displayLabel,
      };
    })

  if (sorted.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm min-h-[320px] flex flex-col">
        <SectionHeader title={title} icon={<Trophy size={18} />}>
          <FilterToggle value={filterType} onChange={onFilterChange} />
        </SectionHeader>
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
          Chưa có dữ liệu trong khoảng thời gian này
        </div>
      </div>
    )
  }

  const maxPerf = Math.max(...sorted.map((d) => d.performanceRate), 100)
  const perfDomain = Math.ceil(maxPerf / 50) * 50

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm">
      <SectionHeader title={title} icon={<Trophy size={18} />}>
        <FilterToggle value={filterType} onChange={onFilterChange} />
      </SectionHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* LEFT – Completion Rate */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">Tiến độ</h4>
          </div>
          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sorted}
                layout="vertical"
                margin={{ top: 10, right: 40, left: 25, bottom: 25 }}
                onMouseLeave={onChartLeave}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  vertical
                  stroke="#94a3b8"
                  strokeOpacity={0.1}
                />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                >
                  <Label value="(%) Tỷ lệ" offset={-5} position="insideBottom" style={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                </XAxis>
                <YAxis
                  dataKey="displayName"
                  type="category"
                  width={130}
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                >
                  <Label value={title.includes('Key Result') ? 'Key Result' : title.includes('KPI') ? 'KPI' : 'Bài nộp'} angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: '#64748b', fontSize: 10, fontWeight: 700 }} dx={-15} />
                </YAxis>
                <Tooltip content={<DualTooltip />} cursor={{ fill: '#94a3b8', opacity: 0.06 }} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  layout="horizontal"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ paddingBottom: '10px', fontSize: 11, fontWeight: 500 }}
                />
                <Bar
                  name="Tiến độ"
                  dataKey="completionRate"
                  fill={COMPLETION_COLORS.normal}
                  radius={[0, 6, 6, 0]}
                  barSize={14}
                  isAnimationActive={false}
                  label={{
                    position: 'right',
                    fill: '#64748b',
                    fontSize: 10,
                    fontWeight: 600,
                    formatter: (v: any) => `${Math.round(v)}%`,
                  }}
                >
                  {sorted.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        hoverIndex !== null && hoverIndex !== idx
                          ? COMPLETION_COLORS.dim
                          : COMPLETION_COLORS.normal
                      }
                      onMouseEnter={(e: any) => onCellEnter(e, idx)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RIGHT – Performance Rate */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">Hiệu suất</h4>
          </div>
          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sorted}
                layout="vertical"
                margin={{ top: 10, right: 40, left: 25, bottom: 25 }}
                onMouseLeave={onChartLeave}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  vertical
                  stroke="#94a3b8"
                  strokeOpacity={0.1}
                />
                <XAxis
                  type="number"
                  domain={[0, perfDomain]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                >
                  <Label value="(%) Tỷ lệ" offset={-5} position="insideBottom" style={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                </XAxis>
                <YAxis
                  dataKey="displayName"
                  type="category"
                  width={130}
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                >
                  <Label value={title.includes('Key Result') ? 'Key Result' : title.includes('KPI') ? 'KPI' : 'Bài nộp'} angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: '#64748b', fontSize: 10, fontWeight: 700 }} dx={-15} />
                </YAxis>
                <Tooltip content={<DualTooltip />} cursor={{ fill: '#94a3b8', opacity: 0.06 }} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  layout="horizontal"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ paddingBottom: '10px', fontSize: 11, fontWeight: 500 }}
                />
                <Bar
                  name="Hiệu suất"
                  dataKey="performanceRate"
                  fill={PERFORMANCE_COLORS.normal}
                  radius={[0, 6, 6, 0]}
                  barSize={14}
                  isAnimationActive={false}
                  label={{
                    position: 'right',
                    fill: '#64748b',
                    fontSize: 10,
                    fontWeight: 600,
                    formatter: (v: any) => `${Math.round(v)}%`,
                  }}
                >
                  {sorted.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        hoverIndex !== null && hoverIndex !== idx
                          ? PERFORMANCE_COLORS.dim
                          : PERFORMANCE_COLORS.normal
                      }
                      onMouseEnter={(e: any) => onCellEnter(e, idx)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Horizontal dual bar chart for top org units derived from child items.
 * Maps TopUnit[] to the shape expected by charts.
 */
function TopUnitsDualChartScoped({
  data,
  filterType,
  onFilterChange,
}: {
  data: ScopedTopUnit[]
  filterType: FilterType
  onFilterChange: (f: FilterType) => void
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const hoverRef = useRef<number | null>(null)

  const onCellEnter = useCallback((_: any, index: number) => {
    if (hoverRef.current !== index) {
      hoverRef.current = index
      setHoverIndex(index)
    }
  }, [])

  const onChartLeave = useCallback(() => {
    hoverRef.current = null
    setHoverIndex(null)
  }, [])

  // Sort based on filter
  const sorted = [...data]
    .sort((a, b) =>
      filterType === 'BEST'
        ? b.performanceRate - a.performanceRate
        : a.performanceRate - b.performanceRate
    )
    .slice(0, 5)

  if (sorted.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm min-h-[320px] flex flex-col">
        <SectionHeader title="Top Đơn vị phụ trách" icon={<Building2 size={18} />}>
          <FilterToggle value={filterType} onChange={onFilterChange} />
        </SectionHeader>
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
          Chưa có dữ liệu đơn vị
        </div>
      </div>
    )
  }

  const maxPerf = Math.max(...sorted.map((d) => d.performanceRate), 100)
  const perfDomain = Math.ceil(maxPerf / 50) * 50

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm">
      <SectionHeader title="Top Đơn vị phụ trách" icon={<Building2 size={18} />}>
        <FilterToggle value={filterType} onChange={onFilterChange} />
      </SectionHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* LEFT – Completion Rate */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">Tiến độ đơn vị</h4>
          </div>
          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sorted}
                layout="vertical"
                margin={{ top: 10, right: 40, left: 25, bottom: 25 }}
                onMouseLeave={onChartLeave}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  vertical
                  stroke="#94a3b8"
                  strokeOpacity={0.1}
                />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                >
                  <Label value="(%) Tỷ lệ" offset={-5} position="insideBottom" style={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                </XAxis>
                <YAxis
                  dataKey="unitName"
                  type="category"
                  width={130}
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                >
                  <Label value="Đơn vị" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: '#64748b', fontSize: 10, fontWeight: 700 }} dx={-15} />
                </YAxis>
                <Tooltip content={<DualTooltip />} cursor={{ fill: '#94a3b8', opacity: 0.06 }} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  layout="horizontal"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ paddingBottom: '10px', fontSize: 11, fontWeight: 500 }}
                />
                <Bar
                  name="Tiến độ"
                  dataKey="completionRate"
                  fill={COMPLETION_COLORS.normal}
                  radius={[0, 6, 6, 0]}
                  barSize={14}
                  isAnimationActive={false}
                  label={{
                    position: 'right',
                    fill: '#64748b',
                    fontSize: 10,
                    fontWeight: 600,
                    formatter: (v: any) => `${Math.round(v)}%`,
                  }}
                >
                  {sorted.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        hoverIndex !== null && hoverIndex !== idx
                          ? COMPLETION_COLORS.dim
                          : COMPLETION_COLORS.normal
                      }
                      onMouseEnter={(e: any) => onCellEnter(e, idx)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RIGHT — Performance Rate */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">Hiệu suất đơn vị</h4>
          </div>
          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sorted}
                layout="vertical"
                margin={{ top: 10, right: 40, left: 25, bottom: 25 }}
                onMouseLeave={onChartLeave}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  vertical
                  stroke="#94a3b8"
                  strokeOpacity={0.1}
                />
                <XAxis
                  type="number"
                  domain={[0, perfDomain]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                >
                  <Label value="(%) Tỷ lệ" offset={-5} position="insideBottom" style={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                </XAxis>
                <YAxis
                  dataKey="unitName"
                  type="category"
                  width={130}
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                >
                  <Label value="Đơn vị" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: '#64748b', fontSize: 10, fontWeight: 700 }} dx={-15} />
                </YAxis>
                <Tooltip content={<DualTooltip />} cursor={{ fill: '#94a3b8', opacity: 0.06 }} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  layout="horizontal"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ paddingBottom: '10px', fontSize: 11, fontWeight: 500 }}
                />
                <Bar
                  name="Hiệu suất"
                  dataKey="performanceRate"
                  fill={PERFORMANCE_COLORS.normal}
                  radius={[0, 6, 6, 0]}
                  barSize={14}
                  isAnimationActive={false}
                  label={{
                    position: 'right',
                    fill: '#64748b',
                    fontSize: 10,
                    fontWeight: 600,
                    formatter: (v: any) => `${Math.round(v)}%`,
                  }}
                >
                  {sorted.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        hoverIndex !== null && hoverIndex !== idx
                          ? PERFORMANCE_COLORS.dim
                          : PERFORMANCE_COLORS.normal
                      }
                      onMouseEnter={(e: any) => onCellEnter(e, idx)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Reusable header row for a chart section: icon + title + optional right slot. */
function SectionHeader({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-indigo-50 dark:bg-indigo-500/20 rounded-lg text-indigo-500 dark:text-indigo-400">
          {icon}
        </div>
        <h3 className="font-bold text-slate-900 dark:text-white tracking-tight text-sm">{title}</h3>
      </div>
      {children}
    </div>
  )
}

/** Best / Worst toggle button pair. */
function FilterToggle({
  value,
  onChange,
}: {
  value: FilterType
  onChange: (f: FilterType) => void
}) {
  return (
    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 gap-0.5">
      <button
        onClick={() => onChange('BEST')}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200 ${
          value === 'BEST'
            ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
        }`}
      >
        <Trophy size={11} />
        Tốt nhất
      </button>
      <button
        onClick={() => onChange('WORST')}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200 ${
          value === 'WORST'
            ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
        }`}
      >
        <TrendingDown size={11} />
        Trì trệ
      </button>
    </div>
  )
}

// ─── Metric cards section ─────────────────────────────────────────────────────

function MetricsBadge({ type }: { type: 'OBJECTIVE' | 'KR' | 'KPI' }) {
  if (type === 'OBJECTIVE') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30">
        <Target size={10} />
        Mục tiêu
      </span>
    )
  }
  if (type === 'KR') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/30">
        <TrendingUp size={10} />
        Key Result
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-500/30">
      <TrendingUp size={10} />
      KPI
    </span>
  )
}

// ─── Main widget ──────────────────────────────────────────────────────────────

/**
 * ScopedDashboardWidget renders a full analytics breakdown for a single
 * Objective, Key Result or KPI inside the drawer.
 */
export default function ScopedDashboardWidget({ type, id, dateRange: globalDateRange, onlyApproved = false }: Props) {
  const { user } = useAuthStore()
  const [itemsFilter, setItemsFilter] = useState<FilterType>('BEST')
  const [unitsFilter, setUnitsFilter] = useState<FilterType>('BEST')
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('GLOBAL')
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>({ from: '', to: '' })
  const [activeMembers, setActiveMembers] = useState<string[]>([])

  const localDateRange = useMemo(() => {
    if (dateFilterType === 'GLOBAL') return globalDateRange
    const now = new Date()
    switch (dateFilterType) {
      case 'THIS_WEEK': return { from: subDays(now, 7).toISOString(), to: now.toISOString() }
      case 'THIS_MONTH': return { from: subDays(now, 30).toISOString(), to: now.toISOString() }
      case 'THIS_QUARTER': return { from: subDays(now, 90).toISOString(), to: now.toISOString() }
      case '6_MONTHS': return { from: subMonths(now, 6).toISOString(), to: now.toISOString() }
      case 'THIS_YEAR': return { from: startOfYear(now).toISOString(), to: now.toISOString() }
      case 'CUSTOM':
        return {
          from: customRange.from ? new Date(customRange.from).toISOString() : undefined,
          to: customRange.to ? new Date(customRange.to).toISOString() : undefined
        }
      default: return { from: undefined, to: undefined }
    }
  }, [dateFilterType, customRange, globalDateRange])

  const { data: metrics, isLoading: isMetricsLoading } = useQuery({
    queryKey: ['scoped-metrics', type, id, localDateRange.from, localDateRange.to, onlyApproved],
    queryFn: () => type === 'OBJECTIVE'
      ? statsApi.getObjScopedMetrics(id, localDateRange.from, localDateRange.to, onlyApproved)
      : type === 'KR'
      ? statsApi.getKrScopedMetrics(id, localDateRange.from, localDateRange.to, onlyApproved)
      : statsApi.getKpiScopedMetrics(id, localDateRange.from, localDateRange.to, onlyApproved),
    enabled: !!id,
  })

  const { data: comboChart, isLoading: isComboLoading } = useQuery({
    queryKey: ['scoped-combo', type, id, localDateRange.from, localDateRange.to, onlyApproved],
    queryFn: () => type === 'OBJECTIVE'
      ? statsApi.getObjScopedCombo(id, localDateRange.from, localDateRange.to, onlyApproved)
      : type === 'KR'
      ? statsApi.getKrScopedCombo(id, localDateRange.from, localDateRange.to, onlyApproved)
      : statsApi.getKpiScopedCombo(id, localDateRange.from, localDateRange.to, onlyApproved),
    enabled: !!id,
  })

  const { data: topEntities, isLoading: isTopLoading } = useQuery({
    queryKey: ['scoped-top', type, id, localDateRange.from, localDateRange.to, onlyApproved],
    queryFn: () => type === 'OBJECTIVE'
      ? statsApi.getObjScopedTopEntities(id, localDateRange.from, localDateRange.to, onlyApproved)
      : type === 'KR'
      ? statsApi.getKrScopedTopEntities(id, localDateRange.from, localDateRange.to, onlyApproved)
      : statsApi.getKpiScopedTopEntities(id, localDateRange.from, localDateRange.to, onlyApproved),
    enabled: !!id,
  })

  // KPI-only: fetch per-member drawer data for the member-selector line chart
  const { data: kpiDrawerData } = useQuery({
    queryKey: ['kpi-drawer-members', id, localDateRange.from, localDateRange.to],
    queryFn: () => personalObjectiveApi.getKpiDrawerData(id, { from: localDateRange.from, to: localDateRange.to }),
    enabled: !!id && type === 'KPI',
  })

  const isUserAssigned = useMemo(() => {
    if (!kpiDrawerData?.contributions || !user?.id) return false
    return kpiDrawerData.contributions.some(c => c.userId === user.id)
  }, [kpiDrawerData, user])

  const toggleMember = (userId: string) =>
    setActiveMembers(prev => prev.includes(userId) ? prev.filter(x => x !== userId) : [...prev, userId])

  const kpiMemberChartData = useMemo(() => {
    if (!kpiDrawerData?.chartData?.points) return []
    return kpiDrawerData.chartData.points.map(p => {
      const row: any = {
        label: p.label,
        targetValue: p.targetValue,
        teamTotalActual: p.teamTotalActual,
        myActual: p.myActual,
        myPerformance: p.myPerformance,
      }
      activeMembers.forEach(uid => {
        const tv = p.teammateValues?.[uid]
        if (tv) {
          row[`act_${uid}`] = tv.actual
          row[`prf_${uid}`] = tv.performance
        }
      })
      return row
    })
  }, [kpiDrawerData, activeMembers])

  const isLoading = isMetricsLoading || isComboLoading || isTopLoading;

  if (isLoading || !metrics || !comboChart || !topEntities) {
    return (
      <div className="w-full min-h-[400px] flex flex-col items-center justify-center mt-10">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        <p className="text-slate-500 dark:text-slate-400 font-medium">
          Đang phân tích dữ liệu chuyên sâu...
        </p>
      </div>
    )
  }

  const { topItems, topUnits } = topEntities

  // Child entity label used in metric cards
  const childName = type === 'OBJECTIVE' ? 'Key Result' : type === 'KR' ? 'KPI' : 'Bài nộp'
  const topItemsTitle =
    type === 'OBJECTIVE'
      ? 'Top Key Results'
      : type === 'KR'
      ? 'Top KPIs'
      : 'Top Bài nộp'

  // Truncate long unit names to keep chart labels readable
  const unitChartData = (topUnits ?? []).map((u) => ({
    ...u,
    unitName: u.unitName.length > 20 ? u.unitName.substring(0, 20) + '…' : u.unitName,
  }))

  return (
    <div className="w-full space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <MetricsBadge type={type} />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Phân tích chi tiết theo{' '}
            {type === 'OBJECTIVE' ? 'Mục tiêu' : type === 'KR' ? 'Key Result' : 'KPI'}
          </span>
        </div>
        
        {/* Local Date Filter */}
        <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-white/10 shadow-sm text-sm">
          <select 
            value={dateFilterType}
            onChange={(e) => setDateFilterType(e.target.value as DateFilterType)}
            className="bg-transparent border-none outline-none text-slate-700 dark:text-slate-300 px-2 py-1 cursor-pointer font-medium"
          >
            <option value="GLOBAL">Theo bộ lọc tổng quan mục tiêu</option>
            <option value="THIS_WEEK">Tuần này</option>
            <option value="THIS_MONTH">Tháng này</option>
            <option value="THIS_QUARTER">Quý này</option>
            <option value="6_MONTHS">6 tháng qua</option>
            <option value="THIS_YEAR">Năm nay</option>
            <option value="CUSTOM">Tùy chỉnh</option>
          </select>
          {dateFilterType === 'CUSTOM' && (
            <div className="flex items-center gap-2 px-2 border-l border-slate-200 dark:border-white/10">
              <input 
                type="date" 
                className="bg-transparent border-none outline-none text-slate-700 dark:text-slate-300 text-xs"
                value={customRange.from}
                onChange={(e) => setCustomRange(prev => ({ ...prev, from: e.target.value }))}
              />
              <span className="text-slate-400">-</span>
              <input 
                type="date" 
                className="bg-transparent border-none outline-none text-slate-700 dark:text-slate-300 text-xs"
                value={customRange.to}
                onChange={(e) => setCustomRange(prev => ({ ...prev, to: e.target.value }))}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Section 1: 4 Metric Cards ── */}
      <div className="grid grid-cols-2 gap-3">
        <ObjectiveMetricCard
          title={type === 'KPI' ? "Tiến độ đóng góp" : "Tiến độ hoàn thành"}
          value={`${metrics.completionRate.toFixed(1)}%`}
          subtitle={`Trung bình ${childName}s`}
          icon={<Target size={18} />}
        />
        <ObjectiveMetricCard
          title="Hiệu suất trung bình"
          value={`${metrics.performanceRate.toFixed(1)}%`}
          subtitle={`Trung bình ${childName}s`}
          icon={<TrendingUp size={18} />}
        />
        <ObjectiveMetricCard
          title={type === 'KPI' ? 'Mục tiêu cần đạt' : `${childName} hoàn thành`}
          value={type === 'KPI' && kpiDrawerData
            ? `${kpiDrawerData.targetValue.toLocaleString('vi-VN')} ${kpiDrawerData.unit}`
            : `${metrics.completedCount}/${metrics.totalCount}`}
          subtitle={type === 'KPI' ? '' : `Đạt 100% tiến độ`}
          icon={<CheckCircle2 size={18} className="text-emerald-500" />}
        />
        <ObjectiveMetricCard
          title="Rủi ro"
          value={metrics.atRiskCount}
          subtitle="Tiến độ thấp & sắp hết hạn"
          icon={<AlertTriangle size={18} className="text-rose-500" />}
        />
      </div>

      {/* ── Section 2: Chart ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-indigo-50 dark:bg-indigo-500/20 rounded-lg text-indigo-500 dark:text-indigo-400">
            <TrendingUp size={16} />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white tracking-tight text-sm">
            {type === 'KPI' ? 'Xu hướng Bài nộp' : 'Xu hướng theo thời gian'}
          </h3>
        </div>
        <div className="w-full">
          {type === 'KPI' ? (
            /* ── KPI: Member-Picker + Multi-Line Chart ── */
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1">
                    Biểu đồ phân tích chuyên sâu
                    <span className="text-[10px] text-indigo-500 font-bold" title="Theo thành viên">*</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">So sánh số lượng bài nộp đang chạy với tiến độ và hiệu suất đạt được</p>
                </div>
                {/* Member Toggle Buttons */}
                {kpiDrawerData?.chartData?.availableTeammates && kpiDrawerData.chartData.availableTeammates.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {kpiDrawerData.chartData.availableTeammates.map(tm => (
                      <button
                        key={tm.userId}
                        onClick={() => toggleMember(tm.userId)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border',
                          activeMembers.includes(tm.userId)
                            ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900 dark:border-white'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-700'
                        )}
                      >
                        {activeMembers.includes(tm.userId) && '✓ '}{tm.fullName}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 px-1">
                <span>Đơn vị ({kpiDrawerData?.unit || ''})</span>
                <span>Hiệu suất (%)</span>
              </div>

              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={kpiMemberChartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      content={({ active, payload, label }: any) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-lg">
                              <p className="font-bold text-slate-900 dark:text-white mb-3">{label}</p>
                              <div className="space-y-2">
                                {payload.map((p: any, i: number) => {
                                  let valStr = p.value?.toLocaleString('vi-VN')
                                  if (p.name.includes('%')) {
                                    valStr = `${Math.round(p.value)}%`
                                  }
                                  return (
                                    <div key={i} className="flex items-center gap-3 text-sm">
                                      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: p.color }} />
                                      <span className="text-slate-500 font-medium min-w-[120px]">{p.name}:</span>
                                      <span className="font-bold text-slate-900 dark:text-white">{valStr}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                      cursor={{ fill: '#94a3b8', opacity: 0.06 }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />

                    {/* Target */}
                    <Line yAxisId="left" type="step" dataKey="targetValue" name="Mục tiêu" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                    {/* Team Total */}
                    {kpiDrawerData?.shared && (
                      <Line yAxisId="left" type="monotone" dataKey="teamTotalActual" name="Tổng Lũy kế Nhóm" stroke="#93c5fd" strokeWidth={2} strokeDasharray="3 3" dot={false} />
                    )}
                    {/* My Lines — only shown when current user is a contributor */}
                    {isUserAssigned && (
                      <>
                        <Line yAxisId="left" type="monotone" dataKey="myActual" name="Lũy kế của Tôi" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        <Line yAxisId="right" type="monotone" dataKey="myPerformance" name="Hiệu suất của Tôi (%)" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                      </>
                    )}
                    {/* Per-Member Lines */}
                    {activeMembers.map((uid, idx) => {
                      const COLORS = ['#f59e0b', '#8b5cf6', '#ec4899', '#0ea5e9', '#14b8a6', '#10b981']
                      const color = COLORS[idx % COLORS.length]
                      const name = kpiDrawerData?.chartData?.availableTeammates?.find(t => t.userId === uid)?.fullName || 'Thành viên'
                      return (
                        <React.Fragment key={uid}>
                          <Line yAxisId="left" type="monotone" dataKey={`act_${uid}`} name={`Lũy kế - ${name}`} stroke={color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                          <Line yAxisId="right" type="monotone" dataKey={`prf_${uid}`} name={`Hiệu suất - ${name} (%)`} stroke={color} strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 4" opacity={0.8} />
                        </React.Fragment>
                      )
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {activeMembers.length === 0 && (
                <div className="text-center text-xs text-slate-400 dark:text-slate-500 mt-3">
                  ← Chọn thành viên ở trên để so sánh thêm đường xu hướng của họ
                </div>
              )}
            </div>
          ) : (
            <AnalyticsComboChart data={comboChart?.points ?? []} itemName={type === 'OBJECTIVE' ? 'Key Result' : 'KPI'} />
          )}
        </div>
      </div>

      {/* ── Section 3: Top Child Items ── */}
      <TopItemsDualChart
        data={topItems ?? []}
        title={topItemsTitle}
        filterType={itemsFilter}
        onFilterChange={setItemsFilter}
      />

      {/* ── Section 4: Top Org Units ── */}
      <TopUnitsDualChartScoped
        data={unitChartData}
        filterType={unitsFilter}
        onFilterChange={setUnitsFilter}
      />
    </div>
  )
}
