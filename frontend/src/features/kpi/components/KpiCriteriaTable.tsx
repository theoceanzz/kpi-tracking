import DataTable from '@/components/common/DataTable'
import StatusBadge from '@/components/common/StatusBadge'
import type { KpiCriteria } from '@/types/kpi'
import { Trash2 } from 'lucide-react'
import { formatAssigneeNames, FREQUENCY_MAP } from '@/lib/utils'



interface KpiCriteriaTableProps {
  data: KpiCriteria[]
  onAction?: (kpi: KpiCriteria) => void
  onDelete?: (kpi: KpiCriteria) => void
  enableOkr?: boolean
}

export default function KpiCriteriaTable({ data, onAction, onDelete, enableOkr }: KpiCriteriaTableProps) {
  const columns = [
    { key: 'name', header: 'Tên chỉ tiêu', render: (k: KpiCriteria) => (
      <div className="flex flex-col">
        <span className="font-bold text-slate-900 dark:text-white">{k.name}</span>
        {enableOkr && k.keyResultName && (
          <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-tight flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
            KR: {k.keyResultName}
          </span>
        )}
      </div>
    )},
    { key: 'period', header: 'Đợt KPI', render: (k: KpiCriteria) => k.kpiPeriod?.name ?? '—' },
    { key: 'orgUnit', header: 'Đơn vị', render: (k: KpiCriteria) => k.orgUnitName ?? '—' },
    { key: 'target', header: 'Mục tiêu', render: (k: KpiCriteria) => k.targetValue != null ? `${k.targetValue} ${k.unit ?? ''}` : '—' },
    { key: 'weight', header: 'Trọng số', render: (k: KpiCriteria) => k.weight != null ? `${k.weight}%` : '—' },
    { key: 'frequency', header: 'Tần suất', render: (k: KpiCriteria) => FREQUENCY_MAP[k.frequency as keyof typeof FREQUENCY_MAP] ?? k.frequency },
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
