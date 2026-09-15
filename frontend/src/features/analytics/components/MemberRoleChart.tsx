import { useMemo } from 'react'
import { xAxisLabel } from '@/components/charts/axisLabel'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { seriesColor } from '@/components/charts/chartPalette'
import ChartTooltip from '@/components/charts/ChartTooltip'

type RoleDist = { unitName: string; roles: { roleName: string; count: number }[] }


interface RoleTooltipEntry {
  name?: string
  value?: number
  color?: string
  payload?: { __total?: number }
}

function RoleTooltip({ active, payload, label }: {
  active?: boolean
  payload?: RoleTooltipEntry[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const total = payload[0]?.payload?.__total ?? 0
  // Bỏ những vai trò không có ai: biểu đồ xếp chồng luôn truyền đủ mọi chuỗi vào payload, nên
  // đơn vị nhỏ sẽ hiện một danh sách dài toàn số 0 — nhiễu hơn là thông tin.
  const rows = payload
    .filter(p => (p.value ?? 0) > 0)
    .map(p => ({ color: p.color, label: p.name ?? '', value: p.value ?? 0 }))
  if (rows.length === 0) return null
  return (
    <ChartTooltip
      title={label}
      rows={rows}
      footer={<>Tổng <span className="font-semibold text-[var(--color-muted-foreground)] tabular-nums">{total}</span> người</>}
    />
  )
}

/**
 * Segment vai trò tự vẽ: bo tròn góc phải CHỈ ở đoạn cuối cùng CÓ GIÁ TRỊ của mỗi hàng
 * (đồng bộ mọi đơn vị) + in TỔNG số người ngay bên phải thanh (luôn hiển thị).
 */
function RoleSegment(props: any) {
  const { x, y, width, height, fill, payload, roleName } = props
  if (!(width > 0) || !(height > 0)) return null
  const isLast = payload?.__lastRole === roleName
  const r = isLast ? Math.min(6, height / 2) : 0
  const right = x + width
  const d = r > 0
    ? `M${x},${y} H${right - r} Q${right},${y} ${right},${y + r} V${y + height - r} Q${right},${y + height} ${right - r},${y + height} H${x} Z`
    : `M${x},${y} H${right} V${y + height} H${x} Z`
  return (
    <g>
      <path d={d} fill={fill} />
      {isLast && (
        <text x={right + 8} y={y + height / 2} dominantBaseline="central"
          className="fill-slate-500 dark:fill-slate-300 text-xs font-medium">
          {payload.__total}
        </text>
      )}
    </g>
  )
}

/**
 * "Nhân sự & vai trò theo đơn vị" — gộp số lượng nhân sự + phân bổ vai trò vào 1 biểu đồ:
 * mỗi đơn vị 1 thanh ngang, độ dài = số người, chia đoạn theo vai trò; nhãn tổng ở cuối thanh.
 * Dữ liệu đã đếm MỖI NGƯỜI 1 LẦN ở đơn vị sâu nhất nên các đơn vị cộng lại = tổng thật (không trùng).
 */
export default function MemberRoleChart({ data }: { data?: RoleDist[] }) {
  const dist = data ?? []

  const { chartData, roleNames, total } = useMemo(() => {
    const roles = new Set<string>()
    dist.forEach(item => item.roles?.forEach(r => roles.add(r.roleName)))
    const roleNames = Array.from(roles)
    const chartData = dist.map(item => {
      const dp: any = { unitName: item.unitName }
      let rowTotal = 0
      let lastRole: string | null = null
      // Duyệt theo THỨ TỰ stack (roleNames) để lastRole = đoạn phải cùng có giá trị.
      roleNames.forEach(rn => {
        const count = item.roles?.find(r => r.roleName === rn)?.count ?? 0
        dp[rn] = count
        if (count > 0) lastRole = rn
        rowTotal += count
      })
      dp.__total = rowTotal
      dp.__lastRole = lastRole
      return dp
    })
    // Đơn vị hiện tại (phần tử [0]) đã gồm toàn bộ đơn vị con → tổng = số của đơn vị hiện tại.
    const total = chartData[0]?.__total ?? 0
    return { chartData, roleNames, total }
  }, [dist])

  if (dist.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-[var(--color-subtle-foreground)] text-sm">Không có dữ liệu</div>
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%" minHeight={0}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 24 }}>
            <CartesianGrid stroke="var(--color-border)" horizontal={false} />
            <XAxis type="number" label={xAxisLabel('S\u1ed1 ng\u01b0\u1eddi')} allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis dataKey="unitName" type="category" axisLine={false} tickLine={false} width={130}
              tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} />
            <Tooltip content={<RoleTooltip />} cursor={{ fill: '#94a3b8', opacity: 0.06 }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 800, paddingTop: '8px' }} />
            {roleNames.map((roleName, index) => (
              <Bar key={roleName} dataKey={roleName} stackId="a" fill={seriesColor(index)} name={roleName}
                barSize={22} isAnimationActive={false} shape={(p: any) => <RoleSegment {...p} roleName={roleName} />} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tổng + chú thích */}
      <div className="mt-2 pt-2 border-t border-[var(--color-border)] text-center">
        <span className="text-xs font-medium">Tổng: <span className="text-[var(--color-foreground)]">{total}</span> người</span>
        <p className="text-caption mt-0.5">Đơn vị hiện tại gồm toàn bộ nhân sự (kể cả đơn vị con) · mỗi người tính theo vai trò ở đơn vị sâu nhất</p>
      </div>
    </div>
  )
}
