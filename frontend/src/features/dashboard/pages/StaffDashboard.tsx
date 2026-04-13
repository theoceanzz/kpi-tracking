import PageHeader from '@/components/common/PageHeader'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import StatusBadge from '@/components/common/StatusBadge'
import { useMyKpiProgress } from '../hooks/useMyKpiProgress'
import { useMySubmissions } from '@/features/submissions/hooks/useMySubmissions'
import { Link } from 'react-router-dom'
import { Target, FileText, CheckCircle, XCircle, Clock, Plus } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

export default function StaffDashboard() {
  const { data: progress, isLoading: progressLoading } = useMyKpiProgress()
  const { data: submissions, isLoading: subLoading } = useMySubmissions(0, 5)

  if (progressLoading) return <LoadingSkeleton rows={3} />

  const cards = [
    { label: 'KPI được giao', value: progress?.totalAssignedKpi ?? 0, icon: <Target size={20} />, color: 'bg-blue-500', link: '/my-kpi' },
    { label: 'Tổng bài nộp', value: progress?.totalSubmissions ?? 0, icon: <FileText size={20} />, color: 'bg-purple-500', link: '/submissions' },
    { label: 'Đã duyệt', value: progress?.approvedSubmissions ?? 0, icon: <CheckCircle size={20} />, color: 'bg-emerald-500', link: '/submissions' },
    { label: 'Chờ duyệt', value: progress?.pendingSubmissions ?? 0, icon: <Clock size={20} />, color: 'bg-amber-500', link: '/submissions' },
    { label: 'Từ chối', value: progress?.rejectedSubmissions ?? 0, icon: <XCircle size={20} />, color: 'bg-red-500', link: '/submissions' },
  ]

  return (
    <div>
      <PageHeader
        title="KPI của tôi"
        description="Theo dõi tiến độ thực hiện chỉ tiêu"
        action={
          <Link to="/submissions/new" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition">
            <Plus size={16} /> Nộp bài mới
          </Link>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {cards.map((card) => (
          <Link key={card.label} to={card.link} className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-4 flex items-center gap-3 hover:shadow-md hover:border-[var(--color-primary)]/30 transition-all">
            <div className={`${card.color} w-10 h-10 rounded-lg flex items-center justify-center text-white`}>{card.icon}</div>
            <div>
              <p className="text-xl font-bold">{card.value}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">{card.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Average score */}
      {progress?.averageScore != null && (
        <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-6 mb-6">
          <h3 className="font-semibold mb-2">Điểm trung bình</h3>
          <div className="flex items-end gap-2">
            <p className="text-4xl font-bold text-[var(--color-primary)]">{progress.averageScore.toFixed(1)}</p>
            <p className="text-sm text-[var(--color-muted-foreground)] mb-1">/ 100</p>
          </div>
        </div>
      )}

      {/* Recent submissions */}
      <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Bài nộp gần đây</h3>
          <Link to="/submissions" className="text-xs text-[var(--color-primary)] font-medium hover:underline">Xem tất cả →</Link>
        </div>
        {subLoading ? (
          <LoadingSkeleton type="table" rows={3} />
        ) : !submissions || submissions.content.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)] text-center py-4">Chưa có bài nộp nào</p>
        ) : (
          <div className="space-y-2">
            {submissions.content.map((s) => (
              <Link key={s.id} to={`/submissions/${s.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--color-accent)] transition">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.kpiCriteriaName}</p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">{formatDateTime(s.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{s.actualValue}</span>
                  <StatusBadge status={s.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
