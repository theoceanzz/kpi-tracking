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
}: Props) {
  if (!data.length || !series.length) {
    return <p className="py-6 text-center text-caption">Chưa có dữ liệu trong phạm vi này</p>
  }
  const withValues = showValues ?? (series.length === 1 && data.length <= 8)
  const fmt = (v: number | string) => (format ? format(v) : `${typeof v === 'number' ? Math.round(v * 10) / 10 : v}`)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: reference ? 20 : 14, right: 16, left: 4, bottom: xLabel ? 30 : 8 }}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey={categoryKey}
          axisLine={false}
          tickLine={false}
          interval={0}
          tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
          label={xLabel ? xAxisLabel(xLabel) : undefined}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          width={54}
          tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
          label={yLabel ? yAxisLabel(yLabel) : undefined}
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
              key={s.key} type="monotone" dataKey={s.key} name={s.label}
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
              key={s.key} type="monotone" dataKey={s.key} name={s.label}
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
