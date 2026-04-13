import { useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import DataTable from '@/components/common/DataTable'
import StatusBadge from '@/components/common/StatusBadge'
import ReviewModal from '../components/ReviewModal'
import { useDeptSubmissions } from '../hooks/useDeptSubmissions'
import { formatDateTime } from '@/lib/utils'
import type { Submission } from '@/types/submission'
import type { SubmissionStatus } from '@/types/submission'

export default function DeptSubmissionsPage() {
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | ''>('')
  const { data, isLoading } = useDeptSubmissions(statusFilter ? { status: statusFilter } : {})
  const [reviewSub, setReviewSub] = useState<Submission | null>(null)

  const columns = [
    { key: 'submittedByName', header: 'Người nộp', render: (s: Submission) => <span className="font-medium">{s.submittedByName}</span> },
    { key: 'kpi', header: 'Chỉ tiêu', render: (s: Submission) => s.kpiCriteriaName },
    { key: 'value', header: 'Giá trị', render: (s: Submission) => <span>{s.actualValue}{s.targetValue != null ? <span className="text-[var(--color-muted-foreground)]"> / {s.targetValue}</span> : ''}</span> },
    { key: 'date', header: 'Ngày nộp', render: (s: Submission) => formatDateTime(s.createdAt) },
    { key: 'status', header: 'Trạng thái', render: (s: Submission) => <StatusBadge status={s.status} /> },
  ]

  return (
    <div>
      <PageHeader
        title="Duyệt bài nộp"
        description="Xem và xử lý bài nộp KPI"
        action={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SubmissionStatus | '')}
            className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm"
          >
            <option value="">Tất cả</option>
            <option value="SUBMITTED">Chờ duyệt</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="REJECTED">Từ chối</option>
          </select>
        }
      />
      {isLoading ? (
        <LoadingSkeleton type="table" rows={5} />
      ) : !data || data.content.length === 0 ? (
        <EmptyState title="Không có bài nộp" description="Chưa có bài nộp nào cần xử lý." />
      ) : (
        <DataTable columns={columns} data={data.content} keyExtractor={(s) => s.id} onRowClick={(s) => setReviewSub(s)} />
      )}

      <ReviewModal open={!!reviewSub} onClose={() => setReviewSub(null)} submission={reviewSub} />
    </div>
  )
}
