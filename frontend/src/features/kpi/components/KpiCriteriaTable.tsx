import DataTable from '@/components/common/DataTable'
import StatusBadge from '@/components/common/StatusBadge'
import type { KpiCriteria } from '@/types/kpi'
import { Trash2 } from 'lucide-react'
import { formatAssigneeNames } from '@/lib/utils'

const frequencyMap: Record<string, string> = {
  DAILY: 'Hàng ngày',
  WEEKLY: 'Hàng tuần',
  MONTHLY: 'Hàng tháng',
  QUARTERLY: 'Hàng quý',
  YEARLY: 'Hàng năm',
}

interface KpiCriteriaTableProps {
  data: KpiCriteria[]
  onAction?: (kpi: KpiCriteria) => void
  onDelete?: (kpi: KpiCriteria) => void
}

export default function KpiCriteriaTable({ data, onAction, onDelete }: KpiCriteriaTableProps) {
  const columns = [
    { key: 'name', header: 'Tên chỉ tiêu', render: (k: KpiCriteria) => <span className="font-medium">{k.name}</span> },
    { key: 'orgUnit', header: 'Đơn vị', render: (k: KpiCriteria) => k.orgUnitName ?? '—' },
    { key: 'target', header: 'Mục tiêu', render: (k: KpiCriteria) => k.targetValue != null ? `${k.targetValue} ${k.unit ?? ''}` : '—' },
    { key: 'weight', header: 'Trọng số', render: (k: KpiCriteria) => k.weight != null ? `${k.weight}%` : '—' },
    { key: 'frequency', header: 'Tần suất', render: (k: KpiCriteria) => frequencyMap[k.frequency] ?? k.frequency },
    { key: 'assignedTo', header: 'Giao cho', render: (k: KpiCriteria) => formatAssigneeNames(k.assigneeNames) },
    { key: 'status', header: 'Trạng thái', render: (k: KpiCriteria) => <StatusBadge status={k.status} /> },
    ...(onDelete ? [{
      key: 'actions',
      header: '',
      render: (k: KpiCriteria) => (
        <button onClick={(e) => { e.stopPropagation(); onDelete(k) }} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--color-muted-foreground)] hover:text-red-500 transition">
          <Trash2 size={14} />
        </button>
      ),
    }] : []),
  ]

  return <DataTable columns={columns} data={data} keyExtractor={(k) => k.id} onRowClick={onAction} />
}
