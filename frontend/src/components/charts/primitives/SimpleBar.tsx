import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, LabelList, ResponsiveContainer } from 'recharts'
import { AXIS_COLORS, NEUTRAL_COLOR, seriesColor } from '../chartPalette'
import { xAxisLabel, yAxisLabel } from '../axisLabel'
import { SeriesTooltip } from '../ChartTooltip'

export interface BarSeries {
  key: string
  label: string
  color?: string
}

interface Props {
  data: Record<string, string | number | null>[]
  /** Tên trường chứa nhãn hạng mục. */
  categoryKey: string
  /** 1 chuỗi = cột đơn; 2–4 chuỗi = cột nhóm. */
  series: BarSeries[]
  unit?: string
  xLabel?: string
  yLabel?: string
  reference?: { value: number; label: string }
  /** Hạng mục cần tô đậm; các hạng mục khác nhạt đi. Chỉ dùng với MỘT chuỗi. */
  highlight?: string[]
  height?: number
  /** Nhãn số trên đầu cột. Mặc định tự bật khi ≤ 12 hạng mục và chỉ một chuỗi. */
  showValues?: boolean
  /** Định dạng giá trị hiển thị (nhãn + tooltip). */
  format?: (value: number | string) => string
}

/**
 * Cột dọc đơn hoặc nhóm — kiểu so sánh cơ bản nhất giữa các hạng mục.
 *
 * <p>Bổ sung cho {@link Lollipop}: lollipop hợp khi nhiều mục hoặc tên dài (nằm ngang, đọc tên dễ),
 * còn cột dọc hợp khi ít mục và muốn so chiều cao ngay lập tức — và là loại duy nhất vẽ được 2–4
 * chuỗi cạnh nhau. Nhãn số chỉ hiện khi đủ chỗ, đúng ngưỡng của chuẩn biểu đồ dự án.
 */
export default function SimpleBar({
  data, categoryKey, series, unit = '', xLabel, yLabel, reference, highlight, height = 280, showValues, format,
}: Props) {
  if (!data.length || !series.length) {
    return <p className="py-6 text-center text-caption">Chưa có dữ liệu trong phạm vi này</p>
  }
  const single = series.length === 1
  const withValues = showValues ?? (single && data.length <= 12)
  const dim = (name: string) => highlight?.length ? !highlight.includes(name) : false
  const fmt = (v: number | string) => (format ? format(v) : `${typeof v === 'number' ? Math.round(v * 10) / 10 : v}`)

  return (
    <ResponsiveContainer width="100%" height={height}>
      {/* bottom 30: chừa chỗ cho nhãn trục X; top 18 khi có vạch tham chiếu để chữ của vạch không bị cắt. */}
      <BarChart data={data} margin={{ top: reference ? 18 : 12, right: 12, left: 4, bottom: xLabel ? 30 : 8 }}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey={categoryKey}
          axisLine={false}
          tickLine={false}
          interval={0}
          tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
          // Tên đơn vị/người dài thì xoay thay vì để Recharts bỏ bớt nhãn.
          angle={data.length > 6 ? -20 : 0}
          textAnchor={data.length > 6 ? 'end' : 'middle'}
          height={data.length > 6 ? 56 : 30}
          label={xLabel ? xAxisLabel(xLabel) : undefined}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          width={54}
          tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
          label={yLabel ? yAxisLabel(yLabel) : undefined}
        />
        <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} content={<SeriesTooltip unit={unit} format={format} />} />

        {reference && (
          <ReferenceLine
            y={reference.value}
            stroke={NEUTRAL_COLOR}
            strokeDasharray="4 4"
            label={{ value: reference.label, position: 'insideTopRight', fill: NEUTRAL_COLOR, fontSize: 11, fontWeight: 700 }}
          />
        )}

        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? seriesColor(i)} isAnimationActive={false} radius={[3, 3, 0, 0]} maxBarSize={56}>
            {single && data.map((row, idx) => (
              <Cell key={idx} fillOpacity={dim(String(row[categoryKey])) ? 0.35 : 1} />
            ))}
            {withValues && (
              <LabelList
                dataKey={s.key}
                position="top"
                formatter={(v: unknown) => fmt(v as number | string)}
                style={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 700 }}
              />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
