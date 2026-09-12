import { useId } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { AXIS_COLORS } from '../chartPalette'
import ChartTooltip from '../ChartTooltip'
import { yAxisLabel } from '../axisLabel'

/** Một mức xếp loại và số người đạt mức đó. Thứ tự mảng chính là thứ tự trên trục, trái → phải. */
export interface DensityLevel {
  name: string
  count: number
  percent: number
  color: string
}

interface Props {
  levels: DensityLevel[]
  /** Tổng số người, hiện trong tooltip để biết tỉ lệ đang tính trên bao nhiêu. */
  total?: number
  /** Nhãn nhỏ ở hai mép, ví dụ "Cần cải thiện" ← → "Xuất sắc". */
  lowLabel?: string
  highLabel?: string
  height?: number
}

/**
 * Đường cong phân bố: mỗi mức xếp loại chiếm một dải bằng nhau trên trục, chiều cao là % người.
 *
 * <p>Cùng dữ liệu với dải ngang xếp chồng ở trên, nhưng trả lời một câu khác. Dải ngang cho biết
 * TỈ LỆ từng mức; đường cong cho biết HÌNH DẠNG của phân bố — đám đông dồn vào giữa, lệch về phía
 * yếu, hay tách thành hai cụm. Ba tình huống đó cần ba cách xử lý khác nhau mà nhìn dải ngang
 * không phân biệt được.
 *
 * <p>Màu chia dải cứng bằng gradient có hai điểm dừng trùng offset, nên phần diện tích thuộc mức
 * nào mang đúng màu của mức đó — khớp màu với dải ngang phía trên.
 *
 * <p>Đường được kéo PHẲNG ra tới hai mép chứ không vuốt về 0: mức ngoài cùng vẫn có người, hạ nó
 * xuống 0 ở mép là bịa ra một cái đuôi không tồn tại và làm nhóm đó trông ít hơn thực tế.
 */
export default function DensityCurve({
  levels, total, lowLabel, highLabel, height = 300,
}: Props) {
  const gradientId = useId()

  if (levels.length === 0) {
    return (
      <div className="w-full flex items-center justify-center text-sm text-[var(--color-subtle-foreground)] font-medium" style={{ height }}>
        Chưa có dữ liệu phân bố
      </div>
    )
  }

  const n = levels.length
  // Mức thứ i chiếm dải [i, i+1); điểm dữ liệu đặt ở giữa dải. Trục số chứ không phải trục danh mục
  // vì gradient cần biết mỗi mức bắt đầu và kết thúc ở đâu tính theo % chiều ngang.
  const points = [
    { x: 0, pct: levels[0]!.percent, idx: -1 },
    ...levels.map((l, i) => ({ x: i + 0.5, pct: l.percent, idx: i })),
    { x: n, pct: levels[n - 1]!.percent, idx: -1 },
  ]

  const axisProps = {
    axisLine: false as const,
    tickLine: false as const,
    tick: { fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 600 },
  }

  return (
    <div className="w-full relative">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={points} margin={{ top: 24, right: 12, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              {levels.map((l, i) => [
                <stop key={`${l.name}-a`} offset={`${(i / n) * 100}%`} stopColor={l.color} stopOpacity={0.85} />,
                <stop key={`${l.name}-b`} offset={`${((i + 1) / n) * 100}%`} stopColor={l.color} stopOpacity={0.85} />,
              ])}
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={AXIS_COLORS.grid} />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, n]}
            ticks={levels.map((_, i) => i + 0.5)}
            tickFormatter={(v: number) => levels[Math.floor(v)]?.name ?? ''}
            {...axisProps}
          />
          <YAxis label={yAxisLabel('% ng\u01b0\u1eddi')} {...axisProps} tickFormatter={(v: number) => `${v}%`} />

          {/* Ranh giới giữa các mức — mảnh, chỉ để mắt biết dải màu đổi ở đâu. */}
          {levels.slice(1).map((l, i) => (
            <ReferenceLine key={`b-${l.name}`} x={i + 1} stroke={AXIS_COLORS.grid} strokeDasharray="2 4" />
          ))}

          <Tooltip content={<DensityTooltip levels={levels} total={total} />} />

          <Area
            type="monotone"
            dataKey="pct"
            stroke={`url(#${gradientId})`}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            fillOpacity={1}
            isAnimationActive={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Nhãn hai mép: nói thẳng đầu nào là yếu, đầu nào là mạnh, khỏi phải suy từ tên mức. */}
      {(lowLabel || highLabel) && (
        <div className="absolute top-1 left-0 right-0 flex justify-between px-10 pointer-events-none">
          <span className="text-eyebrow">{lowLabel}</span>
          <span className="text-eyebrow">{highLabel}</span>
        </div>
      )}
    </div>
  )
}

function DensityTooltip({ active, payload, levels, total }: {
  active?: boolean
  payload?: { payload: { x: number; pct: number; idx: number } }[]
  levels: DensityLevel[]
  total?: number
}) {
  const d = payload?.[0]?.payload
  // Hai điểm kéo phẳng ở mép không phải một mức nào cả — đừng cho chúng hiện tooltip.
  if (!active || !d || d.idx < 0) return null
  const l = levels[d.idx]
  if (!l) return null
  return (
    <ChartTooltip
      title={l.name}
      rows={[
        { color: l.color, label: 'Tỉ lệ', value: `${Math.round(l.percent * 10) / 10}%` },
        { label: 'Số người', value: total ? `${l.count} / ${total}` : String(l.count) },
      ]}
    />
  )
}
