import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { AXIS_COLORS } from '../chartPalette'
import { xAxisLabel, yAxisLabel } from '../axisLabel'

export interface SeriesMeta {
  code: string
  label: string
  color: string
}

export interface CompositionPoint {
  label: string
  values: Record<string, number>
}

interface Props {
  series: SeriesMeta[]
  points: CompositionPoint[]
  /**
   * `area` cho trục thời gian (liên tục), `bar` cho danh mục rời rạc như đơn vị.
   * Vẽ vùng trên trục danh mục ngụ ý một sự liên tục không có thật giữa hai đơn vị cạnh nhau.
   */
  variant?: 'area' | 'bar'
  /** Chuẩn hoá về 100% — dùng khi so cơ cấu giữa các nhóm có quy mô rất khác nhau. */
  normalize?: boolean
  /**
   * Vẽ bậc thang thay vì nội suy mượt — dùng khi giá trị đổi tại mốc rời rạc chứ không biến thiên
   * liên tục. Ví dụ trọng số hạng mục: nó nhảy bậc đúng ngày phê duyệt, nên nối mượt giữa hai mốc
   * là vẽ ra những giá trị chưa từng tồn tại.
   */
  step?: boolean
  unit?: string
  /** Nhãn trục — bỏ trống khi trục đó là danh mục hiển nhiên (tên đơn vị, tên người). */
  xLabel?: string
  yLabel?: string
  /** Số pixel, hoặc `"100%"` để lấp đầy vật chứa (vật chứa phải có chiều cao xác định). */
  height?: number | `${number}%`
  /** Xoay nhãn trục ngang khi danh mục nhiều và tên dài. */
  rotateLabels?: boolean
}

/**
 * Biểu đồ chồng: vùng chồng theo thời gian hoặc cột chồng theo danh mục.
 *
 * <p>Ở chế độ `normalize`, mỗi cột cao đúng 100% nên đơn vị 5 người và đơn vị 50 người so được
 * cơ cấu với nhau — con số tuyệt đối luôn khiến đơn vị lớn trông tệ hơn dù tỉ lệ tốt hơn. Đổi lại
 * mất thông tin quy mô, nên tooltip vẫn hiện số tuyệt đối.
 */
export default function StackedComposition({
  series, points, variant = 'area', normalize = false, step = false, unit = '', height = 300,
  rotateLabels = false, xLabel, yLabel,
}: Props) {
  if (!points.length) {
    return (
      <div className="w-full flex items-center justify-center text-sm text-[var(--color-subtle-foreground)] font-medium" style={{ height }}>
        Chưa có dữ liệu trong phạm vi này
      </div>
    )
  }

  // Trải Record thành các khoá phẳng vì Recharts chỉ đọc được thuộc tính cấp một của mỗi điểm.
  const rows = points.map(p => {
    const raw: Record<string, number> = {}
    let total = 0
    series.forEach(s => {
      const v = p.values[s.code] ?? 0
      raw[s.code] = v
      total += v
    })
    const row: Record<string, string | number> = { label: p.label, __total: total }
    series.forEach(s => {
      row[s.code] = normalize && total > 0 ? Math.round((raw[s.code]! * 1000) / total) / 10 : raw[s.code]!
      row[`__raw_${s.code}`] = raw[s.code]!
    })
    return row
  })

  const axisProps = {
    axisLine: false as const,
    tickLine: false as const,
    tick: { fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 },
  }
  const xAxis = (
    <XAxis
      dataKey="label"
      label={xLabel ? xAxisLabel(xLabel) : undefined}
      {...axisProps}
      interval={0}
      angle={rotateLabels ? -25 : 0}
      textAnchor={rotateLabels ? 'end' : 'middle'}
      height={rotateLabels ? 62 : 28}
    />
  )
  const yAxis = (
    <YAxis
      label={yLabel ? yAxisLabel(yLabel) : undefined}
      {...axisProps}
      domain={normalize ? [0, 100] : undefined}
      tickFormatter={(v: number) => (normalize ? `${v}%` : String(v))}
    />
  )
  const tooltip = (
    <Tooltip
      cursor={{ fill: 'rgba(148,163,184,0.12)' }}
      content={<CompositionTooltip series={series} normalize={normalize} unit={unit} />}
    />
  )
  const legend = (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-3 text-xs font-medium text-[var(--color-muted-foreground)]">
      {series.map(s => (
        <span key={s.code} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
          <span>{s.label}</span>
        </span>
      ))}
    </div>
  )

  // `height="100%"` chỉ có tác dụng khi chính vật chứa cao xác định, nên ở chế độ lấp đầy thì vỏ bọc
  // phải là flex column và khung biểu đồ chiếm phần còn lại — nếu không ResponsiveContainer đo ra 0.
  const fill = height === '100%'
  return (
    <div className={fill ? 'w-full h-full flex flex-col' : 'w-full'}>
      <div className={fill ? 'flex-1 min-h-0' : undefined}>
        <ResponsiveContainer width="100%" height={height}>
          {variant === 'area' ? (
            <AreaChart data={rows} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={AXIS_COLORS.grid} />
              {xAxis}
              {yAxis}
              {tooltip}
              {series.map(s => (
                <Area
                  key={s.code}
                  type={step ? 'stepAfter' : 'monotone'}
                  dataKey={s.code}
                  stackId="comp"
                  stroke={s.color}
                  fill={s.color}
                  fillOpacity={0.72}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          ) : (
            <BarChart data={rows} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={AXIS_COLORS.grid} />
              {xAxis}
              {yAxis}
              {tooltip}
              {series.map((s, i) => (
                <Bar
                  key={s.code}
                  dataKey={s.code}
                  stackId="comp"
                  fill={s.color}
                  isAnimationActive={false}
                  radius={i === series.length - 1 ? [3, 3, 0, 0] : undefined}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {legend}
    </div>
  )
}

function CompositionTooltip({ active, payload, label, series, normalize, unit }: {
  active?: boolean
  payload?: { payload: Record<string, number | string> }[]
  label?: string
  series: SeriesMeta[]
  normalize?: boolean
  unit?: string
}) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  const total = Number(row['__total'] ?? 0)
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-3.5 rounded-card shadow-lg">
      <p className="font-bold text-[var(--color-foreground)] mb-2">{label}</p>
      <div className="space-y-1 text-sm">
        {series.map(s => {
          const raw = Number(row[`__raw_${s.code}`] ?? 0)
          const shown = Number(row[s.code] ?? 0)
          if (raw === 0) return null
          return (
            <div key={s.code} className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-[var(--color-muted-foreground)] font-medium min-w-[92px]">{s.label}:</span>
              <span className="font-bold text-[var(--color-foreground)] tabular-nums">
                {normalize ? `${shown}% (${raw})` : `${raw}${unit ? ` ${unit}` : ''}`}
              </span>
            </div>
          )
        })}
        <p className="text-xs text-[var(--color-subtle-foreground)] pt-1.5 border-t border-[var(--color-border)] mt-1.5">
          Tổng {total}{unit ? ` ${unit}` : ''}
        </p>
      </div>
    </div>
  )
}
