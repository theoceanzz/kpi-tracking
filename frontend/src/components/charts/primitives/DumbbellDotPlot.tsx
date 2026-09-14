import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { AXIS_COLORS, METRIC_COLORS } from '../chartPalette'
import { xAxisLabel } from '../axisLabel'

export interface DumbbellDatum {
  id?: string
  name: string
  /** Chấm đầu — thường là hiện tại / kỳ trước. */
  from: number
  /** Chấm cuối — thường là mục tiêu / kỳ này. */
  to: number
  unit?: string | null
  subText?: string
}

interface Props {
  data: DumbbellDatum[]
  fromLabel: string
  toLabel: string
  fromColor?: string
  toColor?: string
  /** Nhãn trục — bỏ trống khi trục đó là danh mục hiển nhiên (tên đơn vị, tên người). */
  xLabel?: string
  height?: number
  domainMax?: number
  onSelect?: (d: DumbbellDatum) => void
}

/**
 * Dot plot dạng tạ: hai chấm nối nhau trên cùng một dòng.
 *
 * <p>Khi cần so hai giá trị của CÙNG một đối tượng (hiện tại vs mục tiêu, kỳ trước vs kỳ này),
 * chiều dài đoạn nối chính là khoảng cách còn phải đi — đọc ngay được ai gần đích, ai còn xa.
 * Hai cột cạnh nhau buộc mắt phải trừ nhẩm từng cặp.
 */
export default function DumbbellDotPlot({
  data, fromLabel, toLabel, fromColor, toColor, height, domainMax, xLabel, onSelect,
}: Props) {
  const fc = fromColor ?? METRIC_COLORS.completion.normal
  const tc = toColor ?? METRIC_COLORS.performance.normal
  const chartHeight = height ?? Math.max(180, data.length * 32 + 44)
  const max = domainMax ?? Math.max(...data.flatMap(d => [d.from, d.to]), 1)

  // Bar đệm tới chấm trái, bar thân là khoảng cách giữa hai chấm — shape vẽ đoạn nối + hai chấm.
  const rows = data.map(d => ({
    ...d,
    base: Math.min(d.from, d.to),
    span: Math.abs(d.to - d.from),
  }))

  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-6 mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: fc }} /> {fromLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tc }} /> {toLabel}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="var(--color-border)" horizontal={false} />
          <XAxis
            label={xLabel ? xAxisLabel(xLabel) : undefined}
            type="number"
            domain={[0, Math.ceil(max * 1.08)]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            axisLine={false}
            tickLine={false}
            tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
          />
          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.12)' }}
            content={<DumbbellTooltip fromLabel={fromLabel} toLabel={toLabel} fromColor={fc} toColor={tc} />}
          />
          <Bar dataKey="base" stackId="db" fill="transparent" isAnimationActive={false} />
          <Bar
            dataKey="span"
            stackId="db"
            isAnimationActive={false}
            shape={<DumbbellShape fromColor={fc} toColor={tc} />}
            onClick={onSelect ? ((d: unknown) => onSelect((d as { payload: DumbbellDatum }).payload)) : undefined}
            cursor={onSelect ? 'pointer' : undefined}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface ShapeProps {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: DumbbellDatum
  fromColor?: string
  toColor?: string
}

function DumbbellShape({ x = 0, y = 0, width = 0, height = 0, payload, fromColor, toColor }: ShapeProps) {
  if (!payload) return null
  const cy = y + height / 2
  // Bar luôn vẽ từ giá trị nhỏ sang lớn; xác định đầu nào là "from" để tô đúng màu.
  const fromAtLeft = payload.from <= payload.to
  const leftX = x
  const rightX = x + width
  return (
    <g>
      <line x1={leftX} y1={cy} x2={rightX} y2={cy} stroke={AXIS_COLORS.tick} strokeWidth={2} strokeOpacity={0.35} />
      <circle cx={leftX} cy={cy} r={5.5} fill={fromAtLeft ? fromColor : toColor} />
      <circle cx={rightX} cy={cy} r={5.5} fill={fromAtLeft ? toColor : fromColor} />
    </g>
  )
}

function DumbbellTooltip({ active, payload, fromLabel, toLabel, fromColor, toColor }: {
  active?: boolean
  payload?: { payload: DumbbellDatum }[]
  fromLabel: string
  toLabel: string
  fromColor: string
  toColor: string
}) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  const u = d.unit ? ` ${d.unit}` : ''
  const r1 = (v: number) => Math.round(v * 10) / 10
  const gap = r1(d.to - d.from)
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-lg shadow-lg">
      <p className="font-semibold text-slate-900 dark:text-white">{d.name}</p>
      {d.subText && <p className="text-xs text-slate-500 mb-2">{d.subText}</p>}
      <div className="space-y-1 text-sm">
        {([[fromLabel, d.from, fromColor], [toLabel, d.to, toColor]] as [string, number, string][]).map(([label, v, color]) => (
          <div key={label} className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-slate-500 font-medium min-w-[110px]">{label}:</span>
            <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{r1(v)}{u}</span>
          </div>
        ))}
        <p className="text-xs text-slate-400 pt-1.5 border-t border-slate-100 dark:border-slate-800 mt-1.5">
          Còn cách {Math.abs(gap)}{u}
        </p>
      </div>
    </div>
  )
}
