import { useState } from 'react'
import { ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip, CartesianGrid, Bar, Line } from 'recharts'
import { Loader2 } from 'lucide-react'
import type { ComboChartPoint } from '@/types/stats'

type LineFilter = 'BOTH' | 'COMPLETION' | 'PERFORMANCE'

interface AnalyticsComboChartProps {
  data: ComboChartPoint[]
  isLoading?: boolean
  itemName?: string
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-lg">
        <p className="font-bold text-slate-900 dark:text-white mb-3">{label}</p>
        <div className="space-y-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-3 text-sm">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-500 font-medium min-w-[120px]">{entry.name}:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {entry.value}{entry.dataKey.includes('Trend') ? '%' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

export default function AnalyticsComboChart({ data, isLoading, itemName = 'Mục tiêu' }: AnalyticsComboChartProps) {
  const [lineFilter, setLineFilter] = useState<LineFilter>('BOTH')

  console.log(data);
  

  if (isLoading) {
    return (
      <div className="w-full h-[400px] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-slate-500 font-medium">Đang tải dữ liệu biểu đồ...</p>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
        <p className="text-slate-500 font-medium">Không có dữ liệu trong thời gian này</p>
      </div>
    )
  }

  return (
    <div className="w-full min-h-[510px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm relative flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Xu hướng {itemName}: Tiến độ & Hiệu suất
            <span className="text-[10px] text-indigo-500 font-bold" title="API độc lập">*</span>
          </h3>
          <p className="text-sm text-slate-500 mt-1">So sánh số lượng {itemName.toLowerCase()} đang chạy với tiến độ và hiệu suất đạt được</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {(
          [
            { value: 'BOTH', label: 'Cả hai' },
            { value: 'COMPLETION', label: 'Chỉ Tiến độ' },
            { value: 'PERFORMANCE', label: 'Chỉ Hiệu suất' },
          ] as { value: LineFilter; label: string }[]
        ).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setLineFilter(value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              lineFilter === value
                ? 'bg-indigo-500 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Nhãn đơn vị đo nằm ngang ở phía trên */}
      <div className="flex justify-between text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 px-1">
        <span>(%) Tỷ lệ</span>
        <span>Số lượng {itemName}</span>
      </div>

      <div className="h-[380px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorOldObjectives" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#64748b" stopOpacity={0.5}/>
              </linearGradient>
              <linearGradient id="colorNewObjectives" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis 
              dataKey="label" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
              dy={10}
            />
            {/* Left Y Axis for Percentages */}
            <YAxis 
              yAxisId="left" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
              tickFormatter={(val) => `${Math.round(val)}%`}
              domain={[0, 'dataMax + 20']}
            />
            {/* Right Y Axis for Quantity */}
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
            />
            
            <Tooltip content={<CustomTooltip />} />

            {/* Stacked Columns for Number of Items (Mapped to right Y-axis) */}
            <Bar 
              yAxisId="right"
              dataKey="oldItems" 
              name={`Số ${itemName} cũ`} 
              stackId="a" 
              fill="url(#colorOldObjectives)" 
              radius={[0, 0, 4, 4]} 
              barSize={32}
            />
            <Bar 
              yAxisId="right"
              dataKey="newItems" 
              name={`Số ${itemName} mới`} 
              stackId="a" 
              fill="url(#colorNewObjectives)" 
              radius={[4, 4, 0, 0]} 
            />

            {/* Lines for Trends (Mapped to left Y-axis) */}
            {(lineFilter === 'BOTH' || lineFilter === 'COMPLETION') && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="completionTrend"
                name="Xu hướng Tiến độ"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            )}
            {(lineFilter === 'BOTH' || lineFilter === 'PERFORMANCE') && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="performanceTrend"
                name="Xu hướng Hiệu suất"
                stroke="#f59e0b"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Custom legend rendered in normal flow so it never overlaps chart content on narrow screens */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-4 text-xs font-medium text-slate-500 dark:text-slate-400">
        <LegendItem color="#64748b" label={`Số ${itemName} cũ`} />
        <LegendItem color="#4f46e5" label={`Số ${itemName} mới`} />
        {(lineFilter === 'BOTH' || lineFilter === 'COMPLETION') && (
          <LegendItem color="#10b981" label="Xu hướng Tiến độ" />
        )}
        {(lineFilter === 'BOTH' || lineFilter === 'PERFORMANCE') && (
          <LegendItem color="#f59e0b" label="Xu hướng Hiệu suất" />
        )}
      </div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  )
}
