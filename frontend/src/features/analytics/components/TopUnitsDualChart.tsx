import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, Label } from 'recharts'
import type { TopUnitDto } from '@/types/stats'
import { useState, useCallback, useRef } from 'react'

interface Props {
  data: TopUnitDto[]
}

function DualTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs shadow-xl border border-white/10">
      <p className="font-bold mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-bold">{Math.round(p.value)}%</span>
        </p>
      ))}
    </div>
  )
}

const COMPLETION_COLORS = { normal: '#10b981', dim: '#10b98140' }
const PERFORMANCE_COLORS = { normal: '#3b82f6', dim: '#3b82f640' }

export default function TopUnitsDualChart({ data }: Props) {
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

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
        Không có dữ liệu đơn vị
      </div>
    )
  }

  const maxPerformance = Math.max(...data.map(d => d.performanceRate), 100)
  const perfDomain = Math.ceil(maxPerformance / 50) * 50

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* LEFT — Completion Rate (horizontal) */}
      <div className="bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-white/10 p-5 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Tiến độ đơn vị</h4>
        </div>
        <div className="w-full h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 10, right: 45, left: 15, bottom: 25 }}
              onMouseLeave={onChartLeave}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#94a3b8" strokeOpacity={0.1} />
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
                width={120}
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
              >
                <Label value="Đơn vị" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
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
                barSize={16}
                isAnimationActive={false}
                label={{ position: 'right', fill: '#64748b', fontSize: 10, fontWeight: 600, formatter: (v: any) => `${Math.round(v)}%` }}
              >
                {data.map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={hoverIndex !== null && hoverIndex !== idx ? COMPLETION_COLORS.dim : COMPLETION_COLORS.normal}
                    onMouseEnter={(e: any) => onCellEnter(e, idx)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* RIGHT — Performance Rate (horizontal) */}
      <div className="bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-white/10 p-5 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Hiệu suất Phòng ban</h4>
        </div>
        <div className="w-full h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 10, right: 45, left: 15, bottom: 25 }}
              onMouseLeave={onChartLeave}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#94a3b8" strokeOpacity={0.1} />
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
                width={120}
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
              >
                <Label value="Đơn vị" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
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
                barSize={16}
                isAnimationActive={false}
                label={{ position: 'right', fill: '#64748b', fontSize: 10, fontWeight: 600, formatter: (v: any) => `${Math.round(v)}%` }}
              >
                {data.map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={hoverIndex !== null && hoverIndex !== idx ? PERFORMANCE_COLORS.dim : PERFORMANCE_COLORS.normal}
                    onMouseEnter={(e: any) => onCellEnter(e, idx)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
