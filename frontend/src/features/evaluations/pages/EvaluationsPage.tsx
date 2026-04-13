import { useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import DataTable from '@/components/common/DataTable'
import EmptyState from '@/components/common/EmptyState'
import EvaluationFormModal from '../components/EvaluationFormModal'
import { useEvaluations } from '../hooks/useEvaluations'
import { formatDateTime } from '@/lib/utils'
import { Plus } from 'lucide-react'
import type { Evaluation } from '@/types/evaluation'

export default function EvaluationsPage() {
  const { data, isLoading } = useEvaluations({})
  const [showForm, setShowForm] = useState(false)

  const columns = [
    { key: 'userName', header: 'Nhân viên', render: (e: Evaluation) => <span className="font-medium">{e.userName}</span> },
    { key: 'kpiCriteria', header: 'Chỉ tiêu KPI', render: (e: Evaluation) => e.kpiCriteriaName },
    { key: 'evaluator', header: 'Người đánh giá', render: (e: Evaluation) => e.evaluatorName ?? '—' },
    { key: 'score', header: 'Điểm', render: (e: Evaluation) => e.score != null ? <span className="font-semibold text-[var(--color-primary)]">{e.score}</span> : '—' },
    { key: 'comment', header: 'Nhận xét', render: (e: Evaluation) => <span className="line-clamp-1">{e.comment ?? '—'}</span> },
    { key: 'createdAt', header: 'Ngày tạo', render: (e: Evaluation) => formatDateTime(e.createdAt) },
  ]

  return (
    <div>
      <PageHeader
        title="Đánh giá hiệu suất"
        description="Bảng đánh giá KPI nhân viên"
        action={
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition">
            <Plus size={16} /> Tạo đánh giá
          </button>
        }
      />
      {isLoading ? (
        <LoadingSkeleton type="table" rows={5} />
      ) : !data || data.content.length === 0 ? (
        <EmptyState title="Chưa có đánh giá" description="Hãy tạo đánh giá hiệu suất cho nhân viên." />
      ) : (
        <DataTable columns={columns} data={data.content} keyExtractor={(e) => e.id} />
      )}

      <EvaluationFormModal open={showForm} onClose={() => setShowForm(false)} />
    </div>
  )
}
