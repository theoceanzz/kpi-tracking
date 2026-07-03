import { useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

type RoleDist = { unitName: string; roles: { roleName: string; count: number }[] }

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

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
          className="fill-slate-500 dark:fill-slate-300 text-[11px] font-bold">
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
    return <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Không có dữ liệu</div>
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%" minHeight={0}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
            <YAxis dataKey="unitName" type="category" axisLine={false} tickLine={false} width={130}
              tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} />
            <Tooltip cursor={{ fill: '#94a3b8', opacity: 0.06 }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 800, paddingTop: '8px' }} />
            {roleNames.map((roleName, index) => (
              <Bar key={roleName} dataKey={roleName} stackId="a" fill={COLORS[index % COLORS.length]} name={roleName}
                barSize={22} isAnimationActive={false} shape={(p: any) => <RoleSegment {...p} roleName={roleName} />} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tổng + chú thích */}
      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
        <span className="text-[11px] font-bold">Tổng: <span className="text-slate-900 dark:text-white">{total}</span> người</span>
        <p className="text-[10px] text-slate-400 mt-0.5">Đơn vị hiện tại gồm toàn bộ nhân sự (kể cả đơn vị con) · mỗi người tính theo vai trò ở đơn vị sâu nhất</p>
      </div>
    </div>
  )
}
