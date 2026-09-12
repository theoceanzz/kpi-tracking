import { PieChart, Pie, Cell, ResponsiveContainer} from 'recharts'
import { SUBMISSION_STATUS_COLORS, SUBMISSION_STATUS_LABELS } from './chartPalette'

interface SubmissionStatusChartProps {
  pending: number
  approved: number
  rejected: number
}


export default function SubmissionStatusChart({ pending, approved, rejected }: SubmissionStatusChartProps) {
  // Gắn màu theo MÃ trạng thái chứ không theo vị trí trong mảng: đổi thứ tự lát bánh sau này
  // sẽ không âm thầm đổi màu "Đã duyệt" thành màu của "Từ chối".
  const data = [
    { status: 'PENDING', value: pending },
    { status: 'APPROVED', value: approved },
    { status: 'REJECTED', value: rejected },
  ].map(d => ({ ...d, name: SUBMISSION_STATUS_LABELS[d.status] ?? d.status }))

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
          {data.map((d, index) => (
            <Cell 
              key={index} 
              fill={SUBMISSION_STATUS_COLORS[d.status]} 
              className="outline-none"
            />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  )
}
