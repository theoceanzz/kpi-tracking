import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts'
import { AXIS_COLORS, METRIC_COLORS } from '../chartPalette'
import { xAxisLabel } from '../axisLabel'

export interface DivergingDatum {
  id?: string
  name: string
  /** Chênh lệch so với mốc: dương = trên mốc, âm = dưới mốc. */
  value: number
  subText?: string
}

interface Props {
  data: DivergingDatum[]
  unit?: string
  /** Nhãn giải thích mốc 0 (vd "so với trung bình đơn vị"). */
  baselineLabel?: string
  /** Nhãn trục — bỏ trống khi trục đó là danh mục hiển nhiên (tên đơn vị, tên người). */
  xLabel?: string
  height?: number
  onSelect?: (d: DivergingDatum) => void
}

const POSITIVE = METRIC_COLORS.completion.normal
const NEGATIVE = '#ef4444'

/**
 * Biểu đồ phân kỳ: thanh mọc sang hai phía của mốc 0.
 *
 * <p>Khi câu hỏi là "ai đang trên/dưới mặt bằng chung", vẽ giá trị tuyệt đối bắt người đọc tự trừ
 * nhẩm với một con số trung bình nằm đâu đó ngoài biểu đồ. Vẽ thẳng phần chênh lệch thì chiều dài
 * thanh CHÍNH LÀ mức lệch, và bên nào của vạch 0 nói ngay dấu.
 */
export default function DivergingBar({ data, unit = '', baselineLabel, height, xLabel, onSelect }: Props) {
  const chartHeight = height ?? Math.max(180, data.length * 30 + 40)
  const bound = Math.max(...data.map(d => Math.abs(d.value)), 1)
  const domain = Math.ceil(bound * 1.1)

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={AXIS_COLORS.grid} />
        <XAxis
          label={xLabel ? xAxisLabel(xLabel) : undefined}
          type="number"
          domain={[-domain, domain]}
          axisLine={false}
          tickLine={false}
          tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
          tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          axisLine={false}
          tickLine={false}
          tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
        />
        <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} content={<DivergingTooltip unit={unit} baselineLabel={baselineLabel} />} />
        <ReferenceLine x={0} stroke={AXIS_COLORS.tick} strokeWidth={1.5} />
        <Bar
          dataKey="value"
          isAnimationActive={false}
          radius={3}
          onClick={onSelect ? ((d: unknown) => onSelect((d as { payload: DivergingDatum }).payload)) : undefined}
          cursor={onSelect ? 'pointer' : undefined}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.value >= 0 ? POSITIVE : NEGATIVE} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function DivergingTooltip({ active, payload, unit, baselineLabel }: {
  active?: boolean
  payload?: { payload: DivergingDatum }[]
  unit?: string
  baselineLabel?: string
}) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  const v = Math.round(d.value * 10) / 10
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-3.5 rounded-card shadow-lg">
      <p className="font-bold text-[var(--color-foreground)]">{d.name}</p>
      {d.subText && <p className="text-xs text-[var(--color-muted-foreground)] mb-2">{d.subText}</p>}
      <p className="font-semibold text-lg tabular-nums" style={{ color: d.value >= 0 ? POSITIVE : NEGATIVE }}>
        {v > 0 ? '+' : ''}{v}{unit ? ` ${unit}` : ''}
      </p>
      {baselineLabel && <p className="text-[11px] text-[var(--color-subtle-foreground)] font-medium mt-0.5">{baselineLabel}</p>}
    </div>
  )
}
