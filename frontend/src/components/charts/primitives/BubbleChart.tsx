import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts'
import { AXIS_COLORS, METRIC_COLORS, NEUTRAL_COLOR } from '../chartPalette'

export interface BubbleDatum {
  id?: string
  name: string
  x: number
  y: number
  /** Đại lượng thứ ba, quyết định kích thước bong bóng. */
  z: number
  color?: string
  subText?: string
}

interface Props {
  data: BubbleDatum[]
  xLabel: string
  yLabel: string
  zLabel: string
  xUnit?: string
  yUnit?: string
  zUnit?: string
  xMax?: number
  yMax?: number
  /** Vạch chia góc phần tư — nơi "bình thường" chuyển thành "cần xử lý". */
  quadrant?: { x?: number; y?: number }
  height?: number
  onSelect?: (d: BubbleDatum) => void
}

/**
 * Bong bóng: hai trục cộng thêm kích thước, tức ba đại lượng trên một hình.
 *
 * <p>Dùng khi hai con số chỉ có ý nghĩa khi đọc cùng nhau và kèm quy mô. Ví dụ một đơn vị trễ 40%
 * số KPI nghe rất tệ, nhưng nếu đó là 2 trên 5 KPI thì khác hẳn 40% của 200 KPI — kích thước bong
 * bóng là thứ nói ra điều đó, mà bảng xếp theo tỉ lệ trễ thì không.
 */
export default function BubbleChart({
  data, xLabel, yLabel, zLabel, xUnit = '', yUnit = '', zUnit = '',
  xMax, yMax, quadrant, height = 340, onSelect,
}: Props) {
  const xTop = xMax ?? Math.ceil(Math.max(...data.map(d => d.x), 1) * 1.1)
  const yTop = yMax ?? Math.ceil(Math.max(...data.map(d => d.y), 1) * 1.1)
  const zTop = Math.max(...data.map(d => d.z), 1)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 16, right: 24, left: 4, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={AXIS_COLORS.grid} />
        <XAxis
          type="number"
          dataKey="x"
          name={xLabel}
          domain={[0, xTop]}
          axisLine={false}
          tickLine={false}
          tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
          tickFormatter={(v: number) => `${v}${xUnit}`}
          label={{ value: xLabel, position: 'insideBottom', offset: -12, fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 700 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={yLabel}
          domain={[0, yTop]}
          axisLine={false}
          tickLine={false}
          tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
          tickFormatter={(v: number) => `${v}${yUnit}`}
        />
        <ZAxis type="number" dataKey="z" range={[60, 620]} domain={[0, zTop]} name={zLabel} />

        {quadrant?.x != null && <ReferenceLine x={quadrant.x} stroke={NEUTRAL_COLOR} strokeDasharray="4 4" />}
        {quadrant?.y != null && <ReferenceLine y={quadrant.y} stroke={NEUTRAL_COLOR} strokeDasharray="4 4" />}

        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          content={<BubbleTooltip xLabel={xLabel} yLabel={yLabel} zLabel={zLabel} xUnit={xUnit} yUnit={yUnit} zUnit={zUnit} />}
        />

        <Scatter data={data} cursor={onSelect ? 'pointer' : undefined} onClick={onSelect ? ((d: unknown) => onSelect((d as { payload: BubbleDatum }).payload)) : undefined}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? METRIC_COLORS.performance.normal} fillOpacity={0.62} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  )
}

function BubbleTooltip({ active, payload, xLabel, yLabel, zLabel, xUnit, yUnit, zUnit }: {
  active?: boolean
  payload?: { payload: BubbleDatum }[]
  xLabel: string
  yLabel: string
  zLabel: string
  xUnit?: string
  yUnit?: string
  zUnit?: string
}) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  const r1 = (v: number) => Math.round(v * 10) / 10
  const rows: [string, string][] = [
    [xLabel, `${r1(d.x)}${xUnit ?? ''}`],
    [yLabel, `${r1(d.y)}${yUnit ?? ''}`],
    [zLabel, `${r1(d.z)}${zUnit ?? ''}`],
  ]
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-3.5 rounded-card shadow-lg">
      <p className="font-bold text-[var(--color-foreground)]">{d.name}</p>
      {d.subText && <p className="text-xs text-[var(--color-muted-foreground)] mb-2">{d.subText}</p>}
      <div className="space-y-1 text-sm">
        {rows.map(([label, v]) => (
          <div key={label} className="flex items-center gap-3">
            <span className="text-[var(--color-muted-foreground)] font-medium min-w-[120px]">{label}:</span>
            <span className="font-bold text-[var(--color-foreground)] tabular-nums">{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
