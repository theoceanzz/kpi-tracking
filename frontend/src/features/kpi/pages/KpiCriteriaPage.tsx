import { useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import StatusBadge from '@/components/common/StatusBadge'
import DataTable from '@/components/common/DataTable'
import KpiFormModal from '../components/KpiFormModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useKpiCriteria } from '../hooks/useKpiCriteria'
import { useSubmitKpi } from '../hooks/useSubmitKpi'
import { useDeleteKpi } from '../hooks/useDeleteKpi'
import { Plus, Send, Pencil, Trash2 } from 'lucide-react'
import type { KpiCriteria } from '@/types/kpi'

const frequencyMap: Record<string, string> = {
  DAILY: 'Hàng ngày', WEEKLY: 'Hàng tuần', MONTHLY: 'Hàng tháng', QUARTERLY: 'Hàng quý', YEARLY: 'Hàng năm',
}

export default function KpiCriteriaPage() {
  const [showForm, setShowForm] = useState(false)
  const [editKpi, setEditKpi] = useState<KpiCriteria | null>(null)
  const [deleteKpi, setDeleteKpi] = useState<KpiCriteria | null>(null)
  const [submitKpiId, setSubmitKpiId] = useState<string | null>(null)
  const { data, isLoading } = useKpiCriteria({})
  const deleteMutation = useDeleteKpi()
  const submitMutation = useSubmitKpi()

  const columns = [
    { key: 'name', header: 'Tên chỉ tiêu', render: (k: KpiCriteria) => <span className="font-medium">{k.name}</span> },
    { key: 'target', header: 'Mục tiêu', render: (k: KpiCriteria) => k.targetValue != null ? `${k.targetValue} ${k.unit ?? ''}` : '—' },
    { key: 'weight', header: 'Trọng số', render: (k: KpiCriteria) => k.weight != null ? `${k.weight}%` : '—' },
    { key: 'frequency', header: 'Tần suất', render: (k: KpiCriteria) => frequencyMap[k.frequency] ?? k.frequency },
    { key: 'assignedTo', header: 'Giao cho', render: (k: KpiCriteria) => k.assignedToName ?? '—' },
    { key: 'status', header: 'Trạng thái', render: (k: KpiCriteria) => <StatusBadge status={k.status} /> },
    {
      key: 'actions', header: '', render: (k: KpiCriteria) => (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          {k.status === 'DRAFT' && (
            <>
              <button onClick={() => setSubmitKpiId(k.id)} title="Gửi duyệt" className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-[var(--color-muted-foreground)] hover:text-blue-500 transition">
                <Send size={14} />
              </button>
              <button onClick={() => { setEditKpi(k); setShowForm(true) }} title="Sửa" className="p-1.5 rounded-md hover:bg-[var(--color-accent)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition">
                <Pencil size={14} />
              </button>
            </>
          )}
          <button onClick={() => setDeleteKpi(k)} title="Xoá" className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--color-muted-foreground)] hover:text-red-500 transition">
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Chỉ tiêu KPI"
        description="Tạo và quản lý chỉ tiêu KPI cho phòng ban của bạn"
        action={
          <button onClick={() => { setEditKpi(null); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition">
            <Plus size={16} /> Tạo chỉ tiêu
          </button>
        }
      />

      {isLoading ? <LoadingSkeleton type="table" rows={5} /> : !data || data.content.length === 0 ? (
        <EmptyState title="Chưa có chỉ tiêu" description="Hãy tạo chỉ tiêu đầu tiên cho phòng ban." />
      ) : (
        <DataTable columns={columns} data={data.content} keyExtractor={(k) => k.id} />
      )}

      <KpiFormModal open={showForm} onClose={() => { setShowForm(false); setEditKpi(null) }} editKpi={editKpi} />

      <ConfirmDialog open={!!submitKpiId} onClose={() => setSubmitKpiId(null)} onConfirm={() => submitKpiId && submitMutation.mutate(submitKpiId, { onSuccess: () => setSubmitKpiId(null) })} title="Gửi duyệt KPI" description="Bạn có chắc muốn gửi chỉ tiêu này lên Giám đốc để duyệt?" confirmLabel="Gửi duyệt" loading={submitMutation.isPending} />
      <ConfirmDialog open={!!deleteKpi} onClose={() => setDeleteKpi(null)} onConfirm={() => deleteKpi && deleteMutation.mutate(deleteKpi.id, { onSuccess: () => setDeleteKpi(null) })} title="Xoá chỉ tiêu" description={`Bạn có chắc muốn xoá "${deleteKpi?.name}"?`} confirmLabel="Xoá" loading={deleteMutation.isPending} />
    </div>
  )
}
