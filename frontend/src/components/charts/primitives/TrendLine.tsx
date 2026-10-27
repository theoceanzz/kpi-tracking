import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, LabelList, ResponsiveContainer } from 'recharts'
import { AXIS_COLORS, NEUTRAL_COLOR, seriesColor } from '../chartPalette'
import { xAxisLabel, yAxisLabel } from '../axisLabel'
import { SeriesTooltip } from '../ChartTooltip'

export interface TrendSeries {
  key: string
  label: string
  color?: string
}

interface Props {
  data: Record<string, string | number | null>[]
  /** Tên trường chứa mốc thời gian (kỳ, tháng, đợt). */
  categoryKey: string
  series: TrendSeries[]
  variant?: 'line' | 'area'
  unit?: string
  xLabel?: string
  yLabel?: string
  reference?: { value: number; label: string }
  height?: number
  /** Nhãn số tại mỗi điểm. Mặc định bật khi ≤ 8 mốc và chỉ một chuỗi. */
  showValues?: boolean
  /**
   * Giãn nhãn trục X. Mặc định in HẾT (`0`) vì phần lớn ô chỉ có vài mốc; ô hẹp mà nhiều mốc
   * (12 đợt trong nửa khung) thì tên đợt chồng lên nhau thành một vệt đen — truyền
   * `"preserveStartEnd"` để Recharts tự bỏ bớt mà vẫn giữ mốc đầu và mốc cuối.
   */
  xInterval?: number | 'preserveStart' | 'preserveEnd' | 'preserveStartEnd'
  /**
   * Nối các mốc bằng BẬC THANG thay vì đường cong. Dùng cho đại lượng giữ nguyên giá trị tới lần
   * đổi kế tiếp (xếp loại, hạng) — đường cong ở đó vẽ ra những giá trị trung gian không tồn tại.
   */
  step?: boolean
  /**
   * Trục Y là DANH MỤC đã mã hoá thành số: mỗi phần tử một vạch, in nhãn thay vì in số. Đặt prop
   * này thì trục chỉ có đúng những vạch đó và bề rộng tự giãn theo nhãn dài nhất (mặc định 54px
   * cắt mất chữ dài).
   */
  yTicks?: { value: number; label: string }[]
  format?: (value: number | string) => string
}

/**
 * Diễn biến theo THỜI GIAN: 1–4 chuỗi trên cùng một trục giá trị.
 *
 * <p>Cố ý KHÔNG có trục Y thứ hai. Hai đại lượng khác đơn vị trên hai trục là lỗi ngữ nghĩa dự án đã
 * mắc một lần: mắt tự so chiều cao đường này với đường kia, một phép so vô nghĩa. Cần hai đại lượng
 * thì vẽ hai biểu đồ.
 */
export default function TrendLine({
  data, categoryKey, series, variant = 'line', unit = '', xLabel, yLabel, reference, height = 260, showValues, format,
  xInterval = 0, step, yTicks,
}: Props) {
  if (!data.length || !series.length) {
    return <p className="py-6 text-center text-caption">Chưa có dữ liệu trong phạm vi này</p>
  }
  const withValues = showValues ?? (series.length === 1 && data.length <= 8)
  const curve = step ? 'stepAfter' : 'monotone'
  const tickLabel = yTicks ? new Map(yTicks.map(t => [t.value, t.label])) : null
  // 7px/ký tự là bề rộng thực đo của font trục ở 11px; cộng 32px cho nhãn trục dọc xoay đứng và
  // khoảng thở — thiếu chỗ thì Recharts XUỐNG DÒNG giữa nhãn ("TRUNG BÌNH" thành hai hàng).
  const yWidth = yTicks ? Math.max(54, Math.max(...yTicks.map(t => t.label.length)) * 7 + 32) : 54
  // Nới hai đầu thang danh mục: không nới thì chuỗi đứng ở bậc cao nhất nằm đè lên viền trên.
  const yDomain: [number, number] | undefined = yTicks
    ? [Math.min(...yTicks.map(t => t.value)) - 0.4, Math.max(...yTicks.map(t => t.value)) + 0.4]
    : undefined
  const fmt = (v: number | string) => (format ? format(v) : `${typeof v === 'number' ? Math.round(v * 10) / 10 : v}`)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: reference ? 20 : 14, right: 16, left: 4, bottom: xLabel ? 30 : 8 }}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey={categoryKey}
          axisLine={false}
          tickLine={false}
          interval={xInterval}
          tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
          label={xLabel ? xAxisLabel(xLabel) : undefined}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          width={yWidth}
          tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
          label={yLabel ? yAxisLabel(yLabel) : undefined}
          domain={yDomain}
          ticks={yTicks ? yTicks.map(t => t.value) : undefined}
          tickFormatter={tickLabel ? (v: number) => tickLabel.get(v) ?? '' : undefined}
          allowDecimals={!yTicks}
        />
        <Tooltip content={<SeriesTooltip unit={unit} format={format} />} />

        {reference && (
          <ReferenceLine
            y={reference.value}
            stroke={NEUTRAL_COLOR}
            strokeDasharray="4 4"
            label={{ value: reference.label, position: 'insideTopRight', fill: NEUTRAL_COLOR, fontSize: 11, fontWeight: 700 }}
          />
        )}

        {series.map((s, i) => {
          const color = s.color ?? seriesColor(i)
          return variant === 'area' ? (
            <Area
              key={s.key} type={curve} dataKey={s.key} name={s.label}
              stroke={color} fill={color} fillOpacity={0.18} strokeWidth={2}
              isAnimationActive={false} dot={{ r: 3, fill: color, strokeWidth: 0 }}
            >
              {withValues && (
                <LabelList dataKey={s.key} position="top" formatter={(v: unknown) => fmt(v as number | string)}
                  style={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 700 }} />
              )}
            </Area>
          ) : (
            <Line
              key={s.key} type={curve} dataKey={s.key} name={s.label}
              stroke={color} strokeWidth={2} isAnimationActive={false}
              dot={{ r: 3.5, fill: color, strokeWidth: 0 }} activeDot={{ r: 5 }}
            >
              {withValues && (
                <LabelList dataKey={s.key} position="top" formatter={(v: unknown) => fmt(v as number | string)}
                  style={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 700 }} />
              )}
            </Line>
          )
        })}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
