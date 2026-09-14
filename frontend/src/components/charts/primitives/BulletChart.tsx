import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts'
import { AXIS_COLORS, NEUTRAL_COLOR, ratingColor } from '../chartPalette'
import { xAxisLabel } from '../axisLabel'

export interface BulletDatum {
  id?: string
  name: string
  /** Giá trị thực tế đạt được (đơn vị gốc của KPI). */
  actual: number
  /** Mục tiêu phải đạt. */
  target: number
  /** Ngưỡng tối thiểu, nếu KPI có đặt. */
  minimum?: number | null
  /** Đơn vị gốc của KPI này (%, triệu, cái…) — mỗi dòng một đơn vị khác nhau. */
  unit?: string | null
  /** KPI ngược: càng thấp càng tốt. */
  isReverse?: boolean
  subText?: string
}

interface Props {
  data: BulletDatum[]
  /** Nhãn trục đại lượng (trục NGANG). Trục dọc là tên KPI nên không gắn nhãn. */
  valueLabel?: string
  height?: number
  onSelect?: (d: BulletDatum) => void
}

/** % đạt so với mục tiêu; KPI ngược thì đảo tỉ lệ để "cao hơn = tốt hơn" đúng ở mọi dòng. */
function achievement(d: BulletDatum): number {
  if (!d.target) return 0
  const raw = d.isReverse
    ? (d.actual > 0 ? (d.target / d.actual) * 100 : 100)
    : (d.actual / d.target) * 100
  return Math.max(0, Math.round(raw * 10) / 10)
}

/**
 * Bullet chart: thực tế đối chiếu mục tiêu và ngưỡng tối thiểu.
 *
 * <p>Trục là **% đạt so với mục tiêu**, không phải giá trị thô — vì các KPI trên cùng một màn hình
 * đo bằng những đơn vị khác nhau (doanh thu triệu đồng, số vụ, tỉ lệ %). Vẽ giá trị thô thì một
 * KPI đo bằng triệu sẽ nuốt chửng KPI đo bằng đơn vị đếm và không so được gì. Giá trị gốc kèm đơn
 * vị vẫn hiện đủ trong tooltip.
 *
 * <p>Vạch 100% là mục tiêu; vạch ngưỡng tối thiểu vẽ riêng cho từng dòng nên nằm trong shape.
 */
export default function BulletChart({ data, valueLabel, height, onSelect }: Props) {
  const rows = data.map(d => ({
    ...d,
    pct: achievement(d),
    minPct: d.minimum != null && d.target ? Math.round((d.minimum / d.target) * 1000) / 10 : null,
  }))
  const chartHeight = height ?? Math.max(180, rows.length * 34 + 44)
  const max = Math.max(...rows.map(r => r.pct), 100)

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={rows} layout="vertical" margin={{ top: 12, right: 30, left: 8, bottom: 30 }}>
        <CartesianGrid stroke="var(--color-border)" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, Math.ceil(Math.min(max * 1.05, 200))]}
          axisLine={false}
          tickLine={false}
          tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
          tickFormatter={(v: number) => `${v}%`}
          label={xAxisLabel(valueLabel ?? 'Tiến độ (%)')}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          axisLine={false}
          tickLine={false}
          tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
        />
        <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} content={<BulletTooltip />} />
        <ReferenceLine
          x={100}
          stroke={NEUTRAL_COLOR}
          strokeDasharray="4 4"
          label={{ value: 'Mục tiêu', position: 'top', fill: NEUTRAL_COLOR, fontSize: 11, fontWeight: 700 }}
        />
        <Bar
          dataKey="pct"
          barSize={14}
          radius={3}
          isAnimationActive={false}
          onClick={onSelect ? ((d: unknown) => onSelect((d as { payload: BulletDatum }).payload)) : undefined}
          cursor={onSelect ? 'pointer' : undefined}
        >
          {rows.map((r, i) => (
            <Cell key={i} fill={bandColor(r.pct)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Mượn thang màu xếp loại để mức đạt đọc cùng một ngôn ngữ màu với phần còn lại của hệ thống. */
function bandColor(pct: number): string {
  if (pct >= 100) return ratingColor(5)
  if (pct >= 80) return ratingColor(4)
  if (pct >= 60) return ratingColor(3)
  if (pct >= 40) return ratingColor(2)
  return ratingColor(1)
}

type Row = BulletDatum & { pct: number; minPct: number | null }

function BulletTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  const u = d.unit ? ` ${d.unit}` : ''
  const r1 = (v: number) => Math.round(v * 10) / 10
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-lg shadow-lg">
      <p className="font-semibold text-slate-900 dark:text-white">{d.name}</p>
      {d.subText && <p className="text-xs text-slate-500 mb-2">{d.subText}</p>}
      <p className="font-semibold text-lg tabular-nums mb-2" style={{ color: bandColor(d.pct) }}>
        {d.pct}% mục tiêu
      </p>
      <div className="space-y-1 text-sm">
        <Row label="Thực tế" value={`${r1(d.actual)}${u}`} />
        <Row label="Mục tiêu" value={`${r1(d.target)}${u}`} />
        {d.minimum != null && <Row label="Ngưỡng tối thiểu" value={`${r1(d.minimum)}${u}`} />}
        {d.isReverse && <p className="text-xs text-amber-600 font-semibold pt-1">KPI ngược: càng thấp càng tốt</p>}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-slate-500 font-medium min-w-[120px]">{label}:</span>
      <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{value}</span>
    </div>
  )
}
