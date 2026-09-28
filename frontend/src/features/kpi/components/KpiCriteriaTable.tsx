import DataTable from '@/components/common/DataTable'
import StatusBadge from '@/components/common/StatusBadge'
import ApprovalStepHint from './ApprovalStepHint'
import type { KpiCriteria } from '@/types/kpi'
import { Trash2 } from 'lucide-react'
import { formatAssigneeNames, FREQUENCY_MAP } from '@/lib/utils'
import { useTranslation } from 'react-i18next'



interface KpiCriteriaTableProps {
  data: KpiCriteria[]
  onAction?: (kpi: KpiCriteria) => void
  onDelete?: (kpi: KpiCriteria) => void
  enableOkr?: boolean
}

export default function KpiCriteriaTable({ data, onAction, onDelete, enableOkr }: KpiCriteriaTableProps) {
  const { t } = useTranslation('kpi')
  const columns = [
    { key: 'name', header: t('KpiCriteriaTable.kpiName'), render: (k: KpiCriteria) => (
      <div className="flex flex-col">
        <span className="font-semibold text-[var(--color-foreground)]">{k.name}</span>
        {enableOkr && k.keyResultName && (
          <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-[var(--color-primary)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
            KR: {k.keyResultName}
          </span>
        )}
      </div>
    )},
    { key: 'period', header: t('KpiCriteriaTable.kpiPeriod'), render: (k: KpiCriteria) => k.kpiPeriod?.name ?? '—' },
    { key: 'orgUnit', header: t('KpiCriteriaTable.unit'), render: (k: KpiCriteria) => k.orgUnitName ?? '—' },
    { key: 'target', header: t('KpiCriteriaTable.target'), render: (k: KpiCriteria) => k.targetValue != null ? `${k.targetValue} ${k.unit ?? ''}` : '—' },
    { key: 'weight', header: t('KpiCriteriaTable.weight'), render: (k: KpiCriteria) => k.weight != null ? `${k.weight}%` : '—' },
    { key: 'frequency', header: t('KpiCriteriaTable.frequency'), render: (k: KpiCriteria) => FREQUENCY_MAP()[k.frequency as keyof ReturnType<typeof FREQUENCY_MAP>] ?? k.frequency },
    { key: 'assignedTo', header: t('KpiCriteriaTable.assignedTo'), render: (k: KpiCriteria) => formatAssigneeNames(k.assigneeNames) },
    { key: 'status', header: t('KpiCriteriaTable.status'), render: (k: KpiCriteria) => <><StatusBadge status={k.status} /><ApprovalStepHint kpi={k} /></> },
    ...(onDelete ? [{
      key: 'actions',
      header: '',
      render: (k: KpiCriteria) => (
        <button onClick={(e) => { e.stopPropagation(); onDelete(k) }} className="p-1.5 rounded-control hover:bg-[var(--color-error-bg)] dark:hover:bg-[var(--color-error-bg)] text-[var(--color-muted-foreground)] hover:text-[var(--color-error)] transition">
          <Trash2 size={14} />
        </button>
      ),
    }] : []),
  ]

  const renderMobileCard = (k: KpiCriteria) => (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-semibold text-[var(--color-foreground)]">{k.name}</span>
          {enableOkr && k.keyResultName && (
            <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-[var(--color-primary)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
              KR: {k.keyResultName}
            </span>
          )}
        </div>
        {onDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(k) }} className="p-1.5 rounded-control hover:bg-[var(--color-error-bg)] dark:hover:bg-[var(--color-error-bg)] text-[var(--color-muted-foreground)] hover:text-[var(--color-error)] transition shrink-0">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <StatusBadge status={k.status} />
      <dl className="grid grid-cols-2 gap-2 text-sm pt-1 border-t border-[var(--color-border)]">
        <div><dt className="text-xs text-[var(--color-muted-foreground)]">{t('KpiCriteriaTable.kpiPeriod')}</dt><dd>{k.kpiPeriod?.name ?? '—'}</dd></div>
        <div><dt className="text-xs text-[var(--color-muted-foreground)]">{t('KpiCriteriaTable.unit')}</dt><dd>{k.orgUnitName ?? '—'}</dd></div>
        <div><dt className="text-xs text-[var(--color-muted-foreground)]">{t('KpiCriteriaTable.target')}</dt><dd>{k.targetValue != null ? `${k.targetValue} ${k.unit ?? ''}` : '—'}</dd></div>
        <div><dt className="text-xs text-[var(--color-muted-foreground)]">{t('KpiCriteriaTable.weight')}</dt><dd>{k.weight != null ? `${k.weight}%` : '—'}</dd></div>
        <div><dt className="text-xs text-[var(--color-muted-foreground)]">{t('KpiCriteriaTable.frequency')}</dt><dd>{FREQUENCY_MAP()[k.frequency as keyof ReturnType<typeof FREQUENCY_MAP>] ?? k.frequency}</dd></div>
        <div><dt className="text-xs text-[var(--color-muted-foreground)]">{t('KpiCriteriaTable.assignedTo')}</dt><dd>{formatAssigneeNames(k.assigneeNames)}</dd></div>
      </dl>
    </div>
  )

  return <DataTable columns={columns} data={data} keyExtractor={(k) => k.id} onRowClick={onAction} renderMobileCard={renderMobileCard} />
}
