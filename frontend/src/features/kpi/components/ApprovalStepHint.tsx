import type { KpiCriteria } from '@/types/kpi'
import { stepPositionLabel } from '../utils/approvalChainLabels'

/**
 * "Bước 2/3 · Trần B" dưới badge trạng thái: KPI đang ở bước nào của chuỗi duyệt và ai đang giữ.
 * Không hiện gì khi KPI không đang chờ duyệt theo chuỗi.
 */
export default function ApprovalStepHint({ kpi, className }: { kpi: KpiCriteria; className?: string }) {
  if (kpi.status !== 'PENDING_APPROVAL' || !kpi.approval) return null
  const label = stepPositionLabel(kpi.approval)
  return (
    <p className={className ?? 'mt-1 max-w-[220px] truncate text-caption'} title={label}>
      {label}
    </p>
  )
}
