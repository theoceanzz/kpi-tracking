import PageHeader from '@/components/common/PageHeader'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import SubmissionCard from '../components/SubmissionCard'
import { useMySubmissions } from '../hooks/useMySubmissions'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'

export default function MySubmissionsPage() {
  const { data, isLoading } = useMySubmissions()

  return (
    <div>
      <PageHeader
        title="Bài nộp của tôi"
        description="Danh sách bài nộp KPI"
        action={
          <Link to="/submissions/new" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition">
            <Plus size={16} /> Nộp bài mới
          </Link>
        }
      />
      {isLoading ? <LoadingSkeleton rows={3} /> : !data || data.content.length === 0 ? (
        <EmptyState title="Chưa có bài nộp" description="Bạn chưa nộp bài nào." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.content.map((s) => <SubmissionCard key={s.id} submission={s} />)}
        </div>
      )}
    </div>
  )
}
