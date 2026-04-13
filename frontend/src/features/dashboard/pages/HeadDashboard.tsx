import PageHeader from '@/components/common/PageHeader'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import SubmissionStatusChart from '@/components/charts/SubmissionStatusChart'
import { useOverviewStats } from '../hooks/useOverviewStats'
import { Target, FileText, CheckCircle, Clock, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function HeadDashboard() {
  const { data: stats, isLoading } = useOverviewStats()

  if (isLoading) return <LoadingSkeleton rows={3} />

  const cards = [
    { label: 'Chỉ tiêu KPI', value: stats?.totalKpiCriteria ?? 0, icon: <Target size={20} />, color: 'bg-purple-500', link: '/kpi-criteria' },
    { label: 'Chờ duyệt', value: stats?.pendingSubmissions ?? 0, icon: <Clock size={20} />, color: 'bg-amber-500', link: '/submissions/department' },
    { label: 'Đã duyệt', value: stats?.approvedSubmissions ?? 0, icon: <CheckCircle size={20} />, color: 'bg-emerald-500', link: '/submissions/department' },
    { label: 'Từ chối', value: stats?.rejectedSubmissions ?? 0, icon: <XCircle size={20} />, color: 'bg-red-500', link: '/submissions/department' },
  ]

  return (
    <div>
      <PageHeader title="Tổng quan phòng ban" description="Quản lý KPI và bài nộp trong phòng ban" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <Link key={card.label} to={card.link} className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-5 flex items-center gap-4 hover:shadow-md hover:border-[var(--color-primary)]/30 transition-all">
            <div className={`${card.color} w-12 h-12 rounded-xl flex items-center justify-center text-white`}>
              {card.icon}
            </div>
            <div>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-sm text-[var(--color-muted-foreground)]">{card.label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-6">
          <h3 className="font-semibold mb-4">Trạng thái bài nộp</h3>
          <SubmissionStatusChart
            pending={stats?.pendingSubmissions ?? 0}
            approved={stats?.approvedSubmissions ?? 0}
            rejected={stats?.rejectedSubmissions ?? 0}
          />
        </div>

        <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-6">
          <h3 className="font-semibold mb-4">Thao tác nhanh</h3>
          <div className="space-y-3">
            <Link to="/kpi-criteria" className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-muted)]/50 hover:bg-[var(--color-accent)] transition group">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 group-hover:bg-purple-500 flex items-center justify-center text-purple-500 group-hover:text-white transition"><Target size={18} /></div>
              <div><p className="text-sm font-medium">Quản lý chỉ tiêu KPI</p><p className="text-xs text-[var(--color-muted-foreground)]">Tạo mới, sửa, gửi duyệt</p></div>
            </Link>
            <Link to="/submissions/department" className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-muted)]/50 hover:bg-[var(--color-accent)] transition group">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 group-hover:bg-amber-500 flex items-center justify-center text-amber-500 group-hover:text-white transition"><FileText size={18} /></div>
              <div><p className="text-sm font-medium">Duyệt bài nộp</p><p className="text-xs text-[var(--color-muted-foreground)]">Xem và xử lý bài nộp nhân viên</p></div>
            </Link>
            <Link to="/evaluations" className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-muted)]/50 hover:bg-[var(--color-accent)] transition group">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 group-hover:bg-blue-500 flex items-center justify-center text-blue-500 group-hover:text-white transition"><CheckCircle size={18} /></div>
              <div><p className="text-sm font-medium">Đánh giá nhân viên</p><p className="text-xs text-[var(--color-muted-foreground)]">Tạo đánh giá hiệu suất</p></div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
