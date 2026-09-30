import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { seriesColor } from '../chartPalette'
import ChartTooltip from '../ChartTooltip'

export interface DonutSlice {
  name: string
  value: number
  color?: string
}

interface Props {
  data: DonutSlice[]
  unit?: string
  height?: number
  /** Số chú thích ở giữa vòng (vd tổng). Vắng thì để trống. */
  centerValue?: string
  centerLabel?: string
  /** Gộp các phần nhỏ hơn ngưỡng này (%) vào "Khác". 0 = không gộp. */
  minSharePercent?: number
}

/**
 * Vòng tròn khuyết: TỈ TRỌNG của tối đa 6 phần trong một tổng.
 *
 * <p>Chỉ dùng khi các phần thật sự cộng thành một tổng. Nhiều lát mỏng thì mắt không so được nên các
 * phần dưới ngưỡng được gộp thành "Khác" — thà mất chi tiết còn hơn một vành toàn vạch. Chú giải là
 * HTML kèm % (không dùng {@code <Legend>} của Recharts, theo chuẩn biểu đồ dự án).
 */
export default function Donut({ data, unit = '', height = 240, centerValue, centerLabel, minSharePercent = 2 }: Props) {
  const slices = useMemo(() => {
    const total = data.reduce((s, d) => s + (d.value || 0), 0)
    if (total <= 0) return []
    const keep: DonutSlice[] = []
    let other = 0
    data.forEach(d => {
      const share = (d.value / total) * 100
      if (minSharePercent > 0 && share < minSharePercent) other += d.value
      else keep.push(d)
    })
    if (other > 0) keep.push({ name: 'Khác', value: other })
    return keep.slice(0, 7)
  }, [data, minSharePercent])

  const total = slices.reduce((s, d) => s + d.value, 0)
  if (!slices.length) {
    return <p className="py-6 text-center text-caption">Chưa có dữ liệu trong phạm vi này</p>
  }
  const pct = (v: number) => `${Math.round((v / total) * 1000) / 10}%`

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="82%"
            paddingAngle={1.5}
            isAnimationActive={false}
            stroke="var(--color-card)"
            strokeWidth={2}
          >
            {slices.map((s, i) => <Cell key={s.name} fill={s.color ?? seriesColor(i)} />)}
          </Pie>
          <Tooltip content={<DonutTooltip unit={unit} total={total} />} />
          {centerValue && (
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
              <tspan x="50%" dy="-2" className="fill-[var(--color-foreground)]" fontSize={20} fontWeight={600}>{centerValue}</tspan>
              {centerLabel && <tspan x="50%" dy="18" className="fill-[var(--color-muted-foreground)]" fontSize={11}>{centerLabel}</tspan>}
            </text>
          )}
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {slices.map((s, i) => (
          <span key={s.name} className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color ?? seriesColor(i) }} />
            {s.name}
            <b className="font-semibold text-[var(--color-foreground)]">{pct(s.value)}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

function DonutTooltip({ active, payload, unit = '', total }: {
  active?: boolean
  payload?: { payload: DonutSlice }[]
  unit?: string
  total: number
}) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  const value = Math.round(d.value * 10) / 10
  return (
    <ChartTooltip
      title={d.name}
      rows={[{ label: 'Giá trị', value: `${value}${unit ? ` ${unit}` : ''}` },
             { label: 'Tỉ trọng', value: `${Math.round((d.value / total) * 1000) / 10}%` }]}
    />
  )
}
