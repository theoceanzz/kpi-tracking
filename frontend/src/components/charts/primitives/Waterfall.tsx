import { useMemo } from 'react'
import { BarChart, Bar, LabelList, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { AXIS_COLORS, METRIC_COLORS, NEUTRAL_COLOR } from '../chartPalette'
import { yAxisLabel } from '../axisLabel'

export interface WaterfallDatum {
  name: string
  /** Phần đóng góp của bước này (âm = làm giảm). Bỏ qua khi `isTotal`. */
  value: number
  /** Cột chốt: vẽ từ 0 lên tổng luỹ kế thay vì nối tiếp bước trước. */
  isTotal?: boolean
  color?: string
}

interface Props {
  data: WaterfallDatum[]
  unit?: string
  /** Nhãn trục — bỏ trống khi trục đó là danh mục hiển nhiên (tên đơn vị, tên người). */
  yLabel?: string
  height?: number
}

type Row = WaterfallDatum & { base: number; bar: number; from: number; to: number }

const UP = METRIC_COLORS.completion.normal
const DOWN = '#ef4444'
const TOTAL = METRIC_COLORS.performance.normal

/**
 * Biểu đồ thác: cho thấy một con số tổng được cấu thành từ những phần nào.
 *
 * <p>Biểu đồ tròn nói được tỉ trọng nhưng không nói được thứ tự cộng dồn, và không xử lý được phần
 * đóng góp ÂM. Thác thì đọc từ trái sang phải như một phép tính: bắt đầu từ đâu, mỗi bước thêm bớt
 * bao nhiêu, kết ở đâu.
 *
 * <p>Dựng bằng một Bar đệm trong suốt (mức luỹ kế trước bước đó) chồng Bar giá trị — Recharts
 * không có waterfall sẵn.
 */
export default function Waterfall({ data, unit = '', height = 320, yLabel }: Props) {
  const rows = useMemo(() => {
    // Vòng for thay cho map + biến luỹ kế bên ngoài closure: mức luỹ kế phụ thuộc thứ tự nên
    // buộc phải tuần tự, và giữ nó là biến cục bộ của vòng lặp thì không có gì bị giữ lại sau render.
    const out: Row[] = []
    let running = 0
    for (const d of data) {
      if (d.isTotal) {
        // Cột chốt đứng từ 0, không nối tiếp — nó là kết quả, không phải một bước.
        out.push({ ...d, base: 0, bar: running, from: 0, to: running })
        continue
      }
      const from = running
      const to = from + d.value
      // Bước giảm vẽ từ mức thấp hơn lên, nên đáy là mức luỹ kế SAU bước.
      out.push({ ...d, base: Math.min(from, to), bar: Math.abs(d.value), from, to })
      running = to
    }
    return out
  }, [data])

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={AXIS_COLORS.grid} />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
          interval={0}
          angle={rows.length > 5 ? -20 : 0}
          textAnchor={rows.length > 5 ? 'end' : 'middle'}
          height={rows.length > 5 ? 60 : 30}
        />
        <YAxis
          label={yLabel ? yAxisLabel(yLabel) : undefined}
          axisLine={false}
          tickLine={false}
          tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
        />
        <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} content={<WaterfallTooltip unit={unit} />} />
        <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="bar" stackId="wf" radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {/* Thác nước thường chỉ 4-6 cột nên in thẳng số lên đầu cột, khỏi phải rê chuột. */}
          <LabelList dataKey="value" position="top" fill={AXIS_COLORS.tick} fontSize={10} fontWeight={700} />
          {rows.map((r, i) => (
            <Cell key={i} fill={r.color ?? (r.isTotal ? TOTAL : r.value >= 0 ? UP : DOWN)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function WaterfallTooltip({ active, payload, unit }: {
  active?: boolean
  payload?: { payload: Row }[]
  unit?: string
}) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  const u = unit ? ` ${unit}` : ''
  const r1 = (v: number) => Math.round(v * 10) / 10
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-3.5 rounded-card shadow-lg">
      <p className="font-bold text-[var(--color-foreground)] mb-2">{d.name}</p>
      {d.isTotal ? (
        <p className="font-semibold text-lg tabular-nums" style={{ color: TOTAL }}>{r1(d.to)}{u}</p>
      ) : (
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-lg tabular-nums" style={{ color: d.value >= 0 ? UP : DOWN }}>
            {d.value > 0 ? '+' : ''}{r1(d.value)}{u}
          </p>
          <p className="text-[var(--color-muted-foreground)] font-medium" style={{ color: NEUTRAL_COLOR }}>
            {r1(d.from)} → {r1(d.to)}{u}
          </p>
        </div>
      )}
    </div>
  )
}
