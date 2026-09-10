import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { AXIS_COLORS, METRIC_COLORS, NEUTRAL_COLOR } from '../chartPalette'

export interface HistogramBinDatum {
  label: string
  from: number
  to: number
  count: number
}

export interface ThresholdMarker {
  name: string
  threshold: number
  color?: string | null
}

interface Props {
  bins: HistogramBinDatum[]
  /** Vạch mốc xếp loại, vẽ đúng màu tổ chức đã cấu hình. */
  thresholds?: ThresholdMarker[]
  /** Vạch riêng cho giá trị của người đang xem — cấp nhân viên dùng để định vị mình. */
  marker?: { value: number; label: string } | null
  unit?: string
  height?: number
}

/**
 * Histogram: đếm số bản ghi rơi vào từng khoảng giá trị.
 *
 * <p>Giá trị trung bình che mất hình dạng phân phối. Một tổ chức trung bình 78 điểm có thể là
 * "gần như ai cũng 75-80" hoặc "một nửa 95, một nửa 60" — hai tình huống đòi hai cách xử lý khác
 * hẳn nhau, và chỉ histogram phân biệt được. Nó cũng là cách nhanh nhất thấy hiện tượng dồn điểm
 * ngay sát ngưỡng xếp loại.
 */
export default function Histogram({ bins, thresholds = [], marker, unit = '', height = 300 }: Props) {
  const total = bins.reduce((s, b) => s + b.count, 0)

  if (total === 0) {
    return (
      <div className="w-full flex items-center justify-center text-sm text-slate-400 font-medium" style={{ height }}>
        Chưa có dữ liệu để dựng phân phối
      </div>
    )
  }

  // Vạch mốc nằm trên trục giá trị, còn trục X của biểu đồ là trục danh mục (nhãn khoảng) —
  // nên phải quy mốc về đúng nhãn khoảng chứa nó thì vạch mới rơi đúng chỗ.
  const binLabelFor = (v: number) => bins.find(b => v >= b.from && v < b.to)?.label ?? bins[bins.length - 1]?.label

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={bins} margin={{ top: 20, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={AXIS_COLORS.grid} />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fill: AXIS_COLORS.tick, fontSize: 10, fontWeight: 500 }}
          interval={0}
          angle={bins.length > 8 ? -30 : 0}
          textAnchor={bins.length > 8 ? 'end' : 'middle'}
          height={bins.length > 8 ? 54 : 28}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
        />
        <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} content={<HistTooltip total={total} unit={unit} />} />

        {thresholds.map(t => (
          <ReferenceLine
            key={t.name}
            x={binLabelFor(t.threshold)}
            stroke={t.color ?? NEUTRAL_COLOR}
            strokeDasharray="4 4"
            label={{ value: t.name, position: 'top', fill: t.color ?? NEUTRAL_COLOR, fontSize: 9, fontWeight: 800 }}
          />
        ))}
        {marker && (
          <ReferenceLine
            x={binLabelFor(marker.value)}
            stroke="#0f172a"
            strokeWidth={2}
            label={{ value: marker.label, position: 'top', fill: '#0f172a', fontSize: 10, fontWeight: 900 }}
          />
        )}

        <Bar dataKey="count" fill={METRIC_COLORS.performance.normal} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function HistTooltip({ active, payload, total, unit }: {
  active?: boolean
  payload?: { payload: HistogramBinDatum }[]
  total: number
  unit?: string
}) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  const pct = total > 0 ? Math.round(d.count * 1000 / total) / 10 : 0
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-lg">
      <p className="font-bold text-slate-900 dark:text-white mb-1">
        {d.label}{unit ? ` ${unit}` : ''}
      </p>
      <p className="font-black text-lg text-slate-900 dark:text-white tabular-nums">{d.count}</p>
      <p className="text-[11px] text-slate-400 font-medium">{pct}% tổng số</p>
    </div>
  )
}
