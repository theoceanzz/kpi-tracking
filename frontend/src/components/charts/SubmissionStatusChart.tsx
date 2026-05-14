import { PieChart, Pie, Cell, ResponsiveContainer} from 'recharts'

interface SubmissionStatusChartProps {
  pending: number
  approved: number
  rejected: number
}

const COLORS = ['#f59e0b', '#10b981', '#ef4444']

export default function SubmissionStatusChart({ pending, approved, rejected }: SubmissionStatusChartProps) {
  const data = [
    { name: 'Chờ duyệt', value: pending },
    { name: 'Đã duyệt', value: approved },
    { name: 'Từ chối', value: rejected },
  ]

  const total = pending + approved + rejected
  if (total === 0) {
    return <div className="text-center py-8 text-[var(--color-muted-foreground)]">Chưa có dữ liệu</div>
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie 
          data={data} 
          cx="50%" 
          cy="50%" 
          innerRadius="65%" 
          outerRadius="90%" 
          paddingAngle={8} 
          dataKey="value"
          stroke="none"
        >
          {data.map((_, index) => (
            <Cell 
              key={index} 
              fill={COLORS[index % COLORS.length]} 
              className="outline-none"
            />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  )
}
