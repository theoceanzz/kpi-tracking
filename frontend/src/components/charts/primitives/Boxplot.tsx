import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { AXIS_COLORS, METRIC_COLORS } from '../chartPalette'
import { yAxisLabel } from '../axisLabel'

export interface BoxplotDatum {
  name: string
  min: number
  q1: number
  median: number
  q3: number
  max: number
  count?: number
  /** Màu riêng cho hộp; thiếu thì dùng màu hiệu suất mặc định. */
  color?: string
}

interface Props {
  data: BoxplotDatum[]
  /** Đơn vị hiển thị trong tooltip (vd "điểm", "%"). */
  unit?: string
  /** Nhãn trục — bỏ trống khi trục đó là danh mục hiển nhiên (tên đơn vị, tên người). */
  yLabel?: string
  height?: number
  onSelect?: (d: BoxplotDatum) => void
}

/**
 * Boxplot: min – Q1 – trung vị – Q3 – max cho mỗi nhóm.
 *
 * <p>Trả lời câu mà giá trị trung bình luôn giấu: nhóm này đều tay hay phân hoá. Hai đơn vị cùng
 * trung bình 75 điểm — một nơi ai cũng 73-77, một nơi nửa đội 95 nửa đội 55 — cần hai cách xử lý
 * hoàn toàn khác nhau, mà biểu đồ cột không phân biệt được.
 *
 * <p>Recharts không có boxplot. Cách dựng: một Bar đệm trong suốt cao tới Q1, chồng lên là Bar
 * thân hộp cao (Q3−Q1). Hàm `shape` nhận được `y` (pixel của Q3) và `height` (pixel của Q3−Q1),
 * từ đó suy ra tỉ lệ giá trị→pixel để vẽ râu và vạch trung vị — không cần truy cập scale nội bộ.
 */
export default function Boxplot({ data, unit = '', height = 320, yLabel, onSelect }: Props) {
  const rows = data.map(d => ({ ...d, base: d.q1, box: Math.max(d.q3 - d.q1, 0) }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
          interval={0}
          angle={rows.length > 6 ? -20 : 0}
          textAnchor={rows.length > 6 ? 'end' : 'middle'}
          height={rows.length > 6 ? 56 : 30}
        />
        <YAxis
          label={yLabel ? yAxisLabel(yLabel) : undefined}
          axisLine={false}
          tickLine={false}
          tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
        />
        <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} content={<BoxTooltip unit={unit} />} />

        {/* Bar đệm: chỉ để đẩy thân hộp lên đúng cao độ, không nhìn thấy. */}
        <Bar dataKey="base" stackId="box" fill="transparent" isAnimationActive={false} />
        <Bar
          dataKey="box"
          stackId="box"
          isAnimationActive={false}
          shape={<BoxShape />}
          onClick={onSelect ? ((d: unknown) => onSelect((d as { payload: BoxplotDatum }).payload)) : undefined}
          cursor={onSelect ? 'pointer' : undefined}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface ShapeProps {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: BoxplotDatum
}

/** Vẽ hộp + râu + vạch trung vị từ toạ độ pixel của thân hộp. */
function BoxShape({ x = 0, y = 0, width = 0, height = 0, payload }: ShapeProps) {
  if (!payload) return null
  const { min, q1, median, q3, max } = payload
  const color = payload.color ?? METRIC_COLORS.performance.normal

  // y ứng với Q3, y+height ứng với Q1 ⇒ suy ra pixel cho mỗi đơn vị giá trị.
  // Khi Q3 == Q1 (cả nhóm bằng nhau) thì không suy được tỉ lệ — chỉ vẽ hộp dẹt, bỏ râu.
  const span = q3 - q1
  if (span <= 0 || height <= 0) {
    return <rect x={x} y={y} width={width} height={Math.max(height, 2)} fill={color} rx={2} />
  }
  const pxPerUnit = height / span
  const yOf = (v: number) => y + (q3 - v) * pxPerUnit

  const cx = x + width / 2
  const capW = Math.min(width * 0.5, 22)

  return (
    <g>
      {/* Râu trên/dưới */}
      <line x1={cx} y1={yOf(max)} x2={cx} y2={y} stroke={color} strokeWidth={1.5} />
      <line x1={cx} y1={y + height} x2={cx} y2={yOf(min)} stroke={color} strokeWidth={1.5} />
      <line x1={cx - capW / 2} y1={yOf(max)} x2={cx + capW / 2} y2={yOf(max)} stroke={color} strokeWidth={1.5} />
      <line x1={cx - capW / 2} y1={yOf(min)} x2={cx + capW / 2} y2={yOf(min)} stroke={color} strokeWidth={1.5} />
      {/* Thân hộp */}
      <rect x={x} y={y} width={width} height={height} fill={color} fillOpacity={0.28} stroke={color} strokeWidth={1.5} rx={2} />
      {/* Trung vị — vạch đậm, thứ người đọc tìm đầu tiên */}
      <line x1={x} y1={yOf(median)} x2={x + width} y2={yOf(median)} stroke={color} strokeWidth={2.5} />
    </g>
  )
}

function BoxTooltip({ active, payload, unit }: {
  active?: boolean
  payload?: { payload: BoxplotDatum }[]
  unit?: string
}) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  const u = unit ? ` ${unit}` : ''
  const rows: [string, number][] = [
    ['Cao nhất', d.max], ['Q3 (75%)', d.q3], ['Trung vị', d.median], ['Q1 (25%)', d.q1], ['Thấp nhất', d.min],
  ]
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-3.5 rounded-card shadow-lg">
      <p className="font-bold text-[var(--color-foreground)] mb-2">{d.name}</p>
      <div className="space-y-1 text-sm">
        {rows.map(([label, v]) => (
          <div key={label} className="flex items-center gap-3">
            <span className="text-[var(--color-muted-foreground)] font-medium min-w-[90px]">{label}:</span>
            <span className="font-bold text-[var(--color-foreground)] tabular-nums">
              {Math.round(v * 10) / 10}{u}
            </span>
          </div>
        ))}
        {d.count != null && (
          <p className="text-xs text-[var(--color-subtle-foreground)] pt-1.5 border-t border-[var(--color-border)] mt-1.5">
            {d.count} bản ghi
          </p>
        )}
      </div>
    </div>
  )
}
