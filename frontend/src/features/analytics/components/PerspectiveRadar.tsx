import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts'

export interface PerspectiveRadarDatum {
  name: string
  value: number
}

/** Nhãn viễn cảnh trên radar: tự xuống dòng để tên dài không bị cắt. (trích từ BscDashboardPage) */
function PerspectiveTick({ payload, x, y, textAnchor }: any) {
  const label: string = payload?.value ?? ''
  const words = label.split(' ')
  const lines: string[] = []
  let cur = ''
  words.forEach((w: string) => {
    const next = cur ? `${cur} ${w}` : w
    if (next.length <= 12) cur = next
    else { if (cur) lines.push(cur); cur = w }
  })
  if (cur) lines.push(cur)
  return (
    <text x={x} y={y} textAnchor={textAnchor} className="fill-slate-500 dark:fill-slate-400" fontSize={10} fontWeight={700}>
      {lines.map((ln, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 12}>{ln}</tspan>
      ))}
    </text>
  )
}

/**
 * Radar độ cân bằng giữa các viễn cảnh BSC. Dùng chung cho tab "Viễn cảnh (BSC)" ở trang Thống kê
 * (và có thể tái dùng cho BSC Dashboard). Trục 0..100; giá trị > 100 vẫn vẽ (điểm có thể tới 150).
 */
export default function PerspectiveRadar({
  data, height = 320, color = 'var(--color-primary, #6366f1)', seriesName = 'Đạt %',
}: {
  data: PerspectiveRadarDatum[]
  height?: number
  color?: string
  seriesName?: string
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%" margin={{ top: 18, right: 24, bottom: 18, left: 24 }}>
        <PolarGrid strokeOpacity={0.25} />
        <PolarAngleAxis dataKey="name" tick={<PerspectiveTick />} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
        <Radar name={seriesName} dataKey="value" stroke={color} fill={color} fillOpacity={0.35} strokeWidth={2} />
        <Tooltip formatter={(v: any) => [`${v}%`, 'Đạt']} />
      </RadarChart>
    </ResponsiveContainer>
  )
}
