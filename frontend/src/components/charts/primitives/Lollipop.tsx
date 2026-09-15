import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { AXIS_COLORS, METRIC_COLORS, NEUTRAL_COLOR } from '../chartPalette'
import { xAxisLabel } from '../axisLabel'

export interface LollipopDatum {
  /** Khoá để trả về khi người dùng bấm (userId, orgUnitId…). */
  id?: string
  name: string
  value: number
  /** Dòng phụ dưới tên trong tooltip (đơn vị, email…). */
  subText?: string
  color?: string
}

interface Props {
  data: LollipopDatum[]
  /** Đơn vị hiển thị (vd "%", "điểm"). */
  unit?: string
  /**
   * Nhãn trục đại lượng (trục NGANG vì biểu đồ nằm ngang). Trục dọc là tên người/đơn vị nên cố ý
   * không gắn nhãn — dán chữ "Nhân sự" cạnh một cột toàn tên người là chú thích thừa.
   */
  valueLabel?: string
  /** Vạch tham chiếu, thường là trung bình toàn tổ chức. */
  reference?: { value: number; label: string }
  height?: number
  domainMax?: number
  onSelect?: (d: LollipopDatum) => void
}

/**
 * Lollipop: mỗi mục một cọng nối từ trục tới một chấm tròn.
 *
 * <p>Đọc được nhiều mục hơn hẳn biểu đồ cột: 25 thanh đặc cạnh nhau tạo thành một mảng màu khiến
 * mắt phải dò từng cái, trong khi 25 chấm thì vị trí chấm là thứ duy nhất đập vào mắt. Dùng khi
 * xếp hạng đơn vị hoặc nhân sự — nơi số mục thường vượt xa số cột mà biểu đồ cột chịu được.
 */
export default function Lollipop({ data, unit = '', valueLabel, reference, height, domainMax, onSelect }: Props) {
  // Cao theo số mục để nhãn không chồng nhau; sàn 180px cho danh sách rất ngắn.
  const chartHeight = height ?? Math.max(180, data.length * 28 + 40)
  const max = domainMax ?? Math.max(...data.map(d => d.value), reference?.value ?? 0, 1)

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      {/* top 18: chữ của vạch tham chiếu đứng trên vạch, thiếu lề là bị khung cắt nửa. */}
      <BarChart data={data} layout="vertical" margin={{ top: reference ? 18 : 8, right: 44, left: 8, bottom: 30 }}>
        <CartesianGrid stroke="var(--color-border)" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, Math.ceil(max * 1.05)]}
          axisLine={false}
          tickLine={false}
          tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
          label={xAxisLabel(valueLabel ?? (unit ? `Giá trị (${unit.trim()})` : 'Giá trị'))}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          axisLine={false}
          tickLine={false}
          // Mỗi mục một nhãn: chiều cao đã tính theo số mục nên Recharts không được tự bỏ bớt.
          interval={0}
          tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
        />
        <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} content={<LollipopTooltip unit={unit} />} />

        {reference && (
          <ReferenceLine
            x={reference.value}
            stroke={NEUTRAL_COLOR}
            strokeDasharray="4 4"
            label={{ value: reference.label, position: 'top', fill: NEUTRAL_COLOR, fontSize: 11, fontWeight: 700 }}
          />
        )}

        <Bar
          dataKey="value"
          isAnimationActive={false}
          shape={<StemDot unit={unit} />}
          onClick={onSelect ? ((d: unknown) => onSelect((d as { payload: LollipopDatum }).payload)) : undefined}
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
  payload?: LollipopDatum
  unit?: string
}

function StemDot({ x = 0, y = 0, width = 0, height = 0, payload, unit = '' }: ShapeProps) {
  if (!payload) return null
  const color = payload.color ?? METRIC_COLORS.performance.normal
  const cy = y + height / 2
  const end = x + width
  return (
    <g>
      <line x1={x} y1={cy} x2={end} y2={cy} stroke={color} strokeWidth={2} strokeOpacity={0.45} />
      <circle cx={end} cy={cy} r={5.5} fill={color} />
      <text x={end + 9} y={cy + 4} fontSize={11} fontWeight={700} fill={AXIS_COLORS.tick}>
        {Math.round(payload.value * 10) / 10}{unit}
      </text>
    </g>
  )
}

function LollipopTooltip({ active, payload, unit }: {
  active?: boolean
  payload?: { payload: LollipopDatum }[]
  unit?: string
}) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-3.5 rounded-lg shadow-lg">
      <p className="font-semibold text-[var(--color-foreground)]">{d.name}</p>
      {d.subText && <p className="text-xs text-slate-500 mb-2">{d.subText}</p>}
      <p className="font-semibold text-lg text-[var(--color-foreground)] tabular-nums">
        {Math.round(d.value * 10) / 10}{unit ? ` ${unit}` : ''}
      </p>
    </div>
  )
}
