import { useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { Trophy, TrendingDown } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useSummaryComparison } from '../hooks/useAnalytics'
import { usePerformanceScale } from '../hooks/usePerformanceScale'
import type { UnitComparison } from '@/types/stats'

// Chú thích màu: 2 cột (hiệu suất, tiến độ) + 2 chỉ số trong tooltip (trễ hạn, không nộp).
const UNIT_CHART_KEYS = [
  { label: 'Hiệu suất', color: '#10b981' },
  { label: 'Tiến độ', color: '#6366f1' },
  { label: 'Trễ hạn', color: '#f59e0b' },
  { label: 'Không nộp', color: '#f43f5e' },
]

function UnitBarTooltip({ active, payload, perf }: any) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}
  const unit = row.tooltipName || row.unitName || ''
  const total: number = row.totalExpected ?? 0
  return (
    <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs shadow-xl border border-white/10 max-w-[240px]">
      <p className="font-bold mb-1 break-words">{unit}</p>
      {payload.map((p: any, i: number) => {
        // Cột Hiệu suất theo đơn vị của org (điểm/%); các cột còn lại luôn %.
        if (p.dataKey === 'performance') {
          return (
            <p key={i} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
              {p.name}: <span className="font-bold">{perf ? perf.formatShort(p.value) : `${Math.round(p.value)}%`}</span>
            </p>
          )
        }
        let suffix = ''
        if (p.dataKey === 'lateRate') suffix = total > 0 ? ` (${row.lateCount ?? 0}/${total})` : ''
        else if (p.dataKey === 'missedRate') suffix = total > 0 ? ` (${row.missedCount ?? 0}/${total})` : ''
        return (
          <p key={i} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
            {p.name}: <span className="font-bold">{Math.round(p.value)}%{suffix}</span>
          </p>
        )
      })}
    </div>
  )
}

/** Legend gọn, tự xuống dòng (responsive) — gồm cả trễ hạn / không nộp (chỉ hiện trong tooltip). */
function UnitChartLegend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
      {UNIT_CHART_KEYS.map((k) => (
        <span key={k.label} className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: k.color }} />
          {k.label}
        </span>
      ))}
    </div>
  )
}

/** Toggle Tốt nhất / Trì trệ. */
function RankFilterToggle({ filter, onChange }: { filter: 'BEST' | 'WORST'; onChange: (f: 'BEST' | 'WORST') => void }) {
  return (
    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 gap-0.5">
      <button
        onClick={() => onChange('BEST')}
        className={cn('flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
          filter === 'BEST' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400')}
      >
        <Trophy size={11} /> Tốt nhất
      </button>
      <button
        onClick={() => onChange('WORST')}
        className={cn('flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
          filter === 'WORST' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400')}
      >
        <TrendingDown size={11} /> Trì trệ
      </button>
    </div>
  )
}

/** Bộ chọn số lượng đơn vị hiển thị: Tất cả / Top 5 / Top 10. */
function TopNSelect({ value, onChange }: { value: 'ALL' | '5' | '10'; onChange: (v: 'ALL' | '5' | '10') => void }) {
  return (
    <Select value={value} onValueChange={v => onChange(v as 'ALL' | '5' | '10')}>
      <SelectTrigger
        className="h-8 w-auto gap-1 px-2 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300"
        title="Số đơn vị hiển thị"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">Tất cả</SelectItem>
        <SelectItem value="5">Top 5</SelectItem>
        <SelectItem value="10">Top 10</SelectItem>
      </SelectContent>
    </Select>
  )
}

/**
 * Biểu đồ cột "Hiệu suất & Tiến độ đơn vị" — mỗi đơn vị 4 cột (Hiệu suất đánh giá / Tiến độ /
 * Trễ hạn / Không nộp) + BEST/WORST + Top-N. Tự fetch qua unit-comparison.
 * Dùng chung cho SummaryTab (bọc ChartWrapper) và SubordinateManagementTab (bọc card).
 */
export default function UnitComparisonBarChart({ orgUnitId, from, to, onlyApproved, periodId, periodIdTo, hoveredUnit, onHoverUnit }: {
  orgUnitId?: string; from?: string; to?: string; onlyApproved?: boolean; periodId?: string; periodIdTo?: string
  hoveredUnit?: string | null; onHoverUnit?: (u: string | null) => void
}) {
  const [filter, setFilter] = useState<'BEST' | 'WORST'>('BEST')
  const [topN, setTopN] = useState<'ALL' | '5' | '10'>('ALL')
  const [localHover, setLocalHover] = useState<string | null>(null)
  const hov = hoveredUnit !== undefined ? hoveredUnit : localHover
  const setHov = onHoverUnit ?? setLocalHover
  const { data } = useSummaryComparison(orgUnitId, from, to, onlyApproved, periodId, periodIdTo)
  const perf = usePerformanceScale()

  const chartData = useMemo(() => {
    // Backend đã sort: topPerformingUnits (hiệu suất giảm dần), worstPerformingUnits (tăng dần).
    const source = (filter === 'BEST' ? data?.topPerformingUnits : data?.worstPerformingUnits) as UnitComparison[] | undefined
    let list = source || []
    if (topN !== 'ALL') list = list.slice(0, Number(topN))
    return list.map((u: UnitComparison) => {
      const total = u.totalExpected || 0
      return {
        ...u,
        lateRate: total > 0 ? Math.round((u.lateCount / total) * 100) : 0,
        missedRate: total > 0 ? Math.round((u.missedCount / total) * 100) : 0,
        displayName: u.unitName.length > 16 ? u.unitName.substring(0, 16) + '…' : u.unitName,
        tooltipName: u.unitName,
      }
    })
  }, [data, filter, topN])

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-end gap-2 mb-2">
        <RankFilterToggle filter={filter} onChange={setFilter} />
        <TopNSelect value={topN} onChange={setTopN} />
      </div>
      {chartData.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Không có dữ liệu</div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%" minHeight={0}>
            <BarChart data={chartData} barGap={0} barCategoryGap="20%"
              margin={{ top: 8, right: 12, left: 0, bottom: 24 }}
              onMouseLeave={() => setHov(null)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" strokeOpacity={0.8} />
              <XAxis dataKey="displayName" type="category" interval={0} height={50}
                tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} tickMargin={8}
                angle={chartData.length > 4 ? -25 : 0} textAnchor={chartData.length > 4 ? 'end' : 'middle'}
                axisLine={false} tickLine={false} />
              <YAxis yAxisId="pct" type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} width={38}
                tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              {/* Trục ẩn thang điểm cho cột Hiệu suất khi org dùng matrix (để cột không bị dí thấp). */}
              {perf.isMatrix && <YAxis yAxisId="perf" type="number" domain={[0, perf.axisMax]} hide />}
              <Tooltip content={<UnitBarTooltip perf={perf} />} cursor={{ fill: '#94a3b8', opacity: 0.06 }} />
              <Legend verticalAlign="top" height={30} content={<UnitChartLegend />} />
              <Bar yAxisId={perf.isMatrix ? 'perf' : 'pct'} name="Hiệu suất" dataKey="performance" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} barSize={30}
                onMouseEnter={(d: any) => setHov(d.payload?.tooltipName ?? null)}>
                {chartData.map((item, i) => (
                  <Cell key={`p${i}`} fill="#10b981" opacity={hov && hov !== item.tooltipName ? 0.3 : 1} />
                ))}
              </Bar>
              <Bar yAxisId="pct" name="Tiến độ" dataKey="completionRate" fill="#6366f1" radius={[4, 4, 0, 0]} isAnimationActive={false} barSize={30}
                onMouseEnter={(d: any) => setHov(d.payload?.tooltipName ?? null)}>
                {chartData.map((item, i) => (
                  <Cell key={`c${i}`} fill="#6366f1" opacity={hov && hov !== item.tooltipName ? 0.3 : 1} />
                ))}
              </Bar>
              <Bar yAxisId="pct" name="Trễ hạn" dataKey="lateRate" fill="#f59e0b" radius={[4, 4, 0, 0]} isAnimationActive={false} barSize={30}
                onMouseEnter={(d: any) => setHov(d.payload?.tooltipName ?? null)}>
                {chartData.map((item, i) => (
                  <Cell key={`l${i}`} fill="#f59e0b" opacity={hov && hov !== item.tooltipName ? 0.3 : 1} />
                ))}
              </Bar>
              <Bar yAxisId="pct" name="Không nộp" dataKey="missedRate" fill="#f43f5e" radius={[4, 4, 0, 0]} isAnimationActive={false} barSize={30}
                onMouseEnter={(d: any) => setHov(d.payload?.tooltipName ?? null)}>
                {chartData.map((item, i) => (
                  <Cell key={`m${i}`} fill="#f43f5e" opacity={hov && hov !== item.tooltipName ? 0.3 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
