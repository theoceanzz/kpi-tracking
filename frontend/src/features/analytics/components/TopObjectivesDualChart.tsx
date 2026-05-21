import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, Label } from 'recharts'
import type { TopObjectiveDto } from '@/types/stats'
import { useState, useCallback, useRef } from 'react'

interface Props {
  data: TopObjectiveDto[]
}

const PERFORMANCE_CAP = 110

function prepareData(data: TopObjectiveDto[]) {
  return data.map((item) => ({
    ...item,
    displayName: item.code || (item.name.length > 12 ? item.name.substring(0, 12) + '...' : item.name),
    completionRender: Math.min(item.completionRate, 100),
    performanceRender: Math.min(item.performanceRate, PERFORMANCE_CAP),
    performanceActual: item.performanceRate,
    completionActual: item.completionRate,
    isOverCap: item.performanceRate > 100,
  }))
}

// Custom bar shape that draws wave cut marks when value exceeds 100%
function CutBarShape(props: any) {
  const {
    x,
    y,
    width,
    height,
    payload,
    fill,
    onMouseEnter,
    onMouseLeave,
    onClick,
    className,
    style,
    opacity,
  } = props

  const safeProps = { onMouseEnter, onMouseLeave, onClick, className, style, opacity }

  if (!payload?.isOverCap || height <= 0) {
    return <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} ry={4} {...safeProps} />
  }

  const cutY = y + 6
  return (
    <g {...safeProps}>
      <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} ry={4} />
      <path
        d={`M ${x} ${cutY} Q ${x + width * 0.25} ${cutY - 4}, ${x + width * 0.5} ${cutY} Q ${x + width * 0.75} ${cutY + 4}, ${x + width} ${cutY}`}
        stroke="white"
        strokeWidth={2}
        fill="none"
      />
      <path
        d={`M ${x} ${cutY + 3} Q ${x + width * 0.25} ${cutY - 1}, ${x + width * 0.5} ${cutY + 3} Q ${x + width * 0.75} ${cutY + 7}, ${x + width} ${cutY + 3}`}
        stroke="white"
        strokeWidth={1.5}
        fill="none"
        opacity={0.6}
      />
    </g>
  )
}

// Custom label on top of bars — always visible, no flicker
function BarTopLabel(props: any) {
  const { x, y, width, value, payload, dataKey } = props
  const actualValue = dataKey === 'performanceRender' ? payload?.performanceActual : payload?.completionActual
  const displayVal = actualValue !== undefined ? actualValue : value
  if (displayVal === 0 || displayVal === undefined) return null
  return (
    <text x={x + width / 2} y={y - 6} textAnchor="middle" fill="#64748b" fontSize={11} fontWeight={600}>
      {Math.round(displayVal)}%
    </text>
  )
}

// Custom tooltip
function DualTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null
  const item = payload[0]?.payload
  return (
    <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs shadow-xl border border-white/10">
      <p className="font-bold mb-1">{item?.name || label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-bold">{Math.round(p.name?.includes('Hiệu suất') ? item?.performanceActual : p.value)}%</span>
        </p>
      ))}
    </div>
  )
}

// Color constants
const COMPLETION_COLORS = { normal: '#10b981', dim: '#10b98140' }
const PERFORMANCE_COLORS = { normal: '#3b82f6', dim: '#3b82f640' }

export default function TopObjectivesDualChart({ data }: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const chartData = prepareData(data)
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
        Không có dữ liệu mục tiêu
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* LEFT — Completion Rate */}
      <div className="bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-white/10 p-5 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Tiến độ hoàn thành</h4>
        </div>
        <div className="w-full h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 25, right: 10, left: 15, bottom: 20 }}
              onMouseLeave={onChartLeave}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.15} />
              <XAxis
                dataKey="displayName"
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                dy={5}
              >
                <Label value="Mục tiêu" offset={-5} position="insideBottom" style={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
              </XAxis>
              <YAxis
                tickFormatter={(v) => `${v}%`}
                domain={[0, 100]}
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              >
                <Label value="(%) Tỷ lệ" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
              </YAxis>
              <Tooltip content={<DualTooltip />} cursor={{ fill: '#94a3b8', opacity: 0.08 }} />
              <Legend
                verticalAlign="top"
                align="right"
                layout="horizontal"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ paddingBottom: '15px', fontSize: 11, fontWeight: 500 }}
              />
              <Bar
                name="Tỉ lệ hoàn thành"
                dataKey="completionRender"
                fill={COMPLETION_COLORS.normal}
                radius={[4, 4, 0, 0]}
                barSize={36}
                isAnimationActive={false}
                label={<BarTopLabel dataKey="completionRender" />}
              >
                {chartData.map((_, idx) => (
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

      {/* RIGHT — Performance Rate */}
      <div className="bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-white/10 p-5 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Hiệu suất</h4>
        </div>
        <div className="w-full h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 25, right: 10, left: 15, bottom: 20 }}
              onMouseLeave={onChartLeave}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.15} />
              <XAxis
                dataKey="displayName"
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                dy={5}
              >
                <Label value="Mục tiêu" offset={-5} position="insideBottom" style={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
              </XAxis>
              <YAxis
                tickFormatter={(v) => `${v}%`}
                domain={[0, PERFORMANCE_CAP]}
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              >
                <Label value="(%) Tỷ lệ" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
              </YAxis>
              <Tooltip content={<DualTooltip />} cursor={{ fill: '#94a3b8', opacity: 0.08 }} />
              <Legend
                verticalAlign="top"
                align="right"
                layout="horizontal"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ paddingBottom: '15px', fontSize: 11, fontWeight: 500 }}
              />
              <Bar
                name="Hiệu suất"
                dataKey="performanceRender"
                fill={PERFORMANCE_COLORS.normal}
                radius={[4, 4, 0, 0]}
                barSize={36}
                isAnimationActive={false}
                shape={<CutBarShape />}
                label={<BarTopLabel dataKey="performanceRender" />}
              >
                {chartData.map((_, idx) => (
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
