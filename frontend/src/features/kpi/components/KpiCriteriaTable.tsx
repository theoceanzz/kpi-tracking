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

  const renderMobileCard = (k: KpiCriteria) => (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-bold text-slate-900 dark:text-white">{k.name}</span>
          {enableOkr && k.keyResultName && (
            <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-tight flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              KR: {k.keyResultName}
            </span>
          )}
        </div>
        {onDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(k) }} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--color-muted-foreground)] hover:text-red-500 transition shrink-0">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <StatusBadge status={k.status} />
      <dl className="grid grid-cols-2 gap-2 text-sm pt-1 border-t border-[var(--color-border)]">
        <div><dt className="text-xs text-[var(--color-muted-foreground)]">Đợt KPI</dt><dd>{k.kpiPeriod?.name ?? '—'}</dd></div>
        <div><dt className="text-xs text-[var(--color-muted-foreground)]">Đơn vị</dt><dd>{k.orgUnitName ?? '—'}</dd></div>
        <div><dt className="text-xs text-[var(--color-muted-foreground)]">Mục tiêu</dt><dd>{k.targetValue != null ? `${k.targetValue} ${k.unit ?? ''}` : '—'}</dd></div>
        <div><dt className="text-xs text-[var(--color-muted-foreground)]">Trọng số</dt><dd>{k.weight != null ? `${k.weight}%` : '—'}</dd></div>
        <div><dt className="text-xs text-[var(--color-muted-foreground)]">Tần suất</dt><dd>{FREQUENCY_MAP[k.frequency as keyof typeof FREQUENCY_MAP] ?? k.frequency}</dd></div>
        <div><dt className="text-xs text-[var(--color-muted-foreground)]">Giao cho</dt><dd>{formatAssigneeNames(k.assigneeNames)}</dd></div>
      </dl>
    </div>
  )

  return <DataTable columns={columns} data={data} keyExtractor={(k) => k.id} onRowClick={onAction} renderMobileCard={renderMobileCard} />
}
