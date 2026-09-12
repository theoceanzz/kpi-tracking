import { Badge } from '@/components/ui/badge'
import { FREQUENCY_MAP } from '@/lib/utils'
import type { KpiCriteria } from '@/types/kpi'

/**
 * Hàng nhãn phân loại của một chỉ tiêu, dùng chung cho mọi bảng/thẻ KPI (UX_PATTERNS.md P1
 * "Tên chỉ tiêu"): tần suất · N KPI con · Định tính · KPI ngược · KPI thưởng · quan hệ cha-con ·
 * hạng mục BSC. Cùng một thứ tự và cùng biến thể Badge ở mọi trang.
 */
export default function KpiTagChips({ kpi, childCount = 0, isChildRow = false, showFrequency = true }: {
  kpi: KpiCriteria
  childCount?: number
  isChildRow?: boolean
  showFrequency?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {showFrequency && <span className="text-caption">{FREQUENCY_MAP[kpi.frequency as keyof typeof FREQUENCY_MAP] || kpi.frequency}</span>}
      {!isChildRow && childCount > 0 && <Badge variant="secondary">{childCount} KPI con</Badge>}
      {kpi.kpiType === 'QUALITATIVE' && <Badge variant="outline">Định tính</Badge>}
      {kpi.isReverseKpi && <Badge variant="warning">KPI ngược</Badge>}
      {kpi.isBonusKpi && <Badge variant="success">KPI thưởng</Badge>}
      {isChildRow && kpi.parentRelationType && (
        <Badge variant="info">{kpi.parentRelationType === 'DECOMPOSITION' ? 'Chia nhỏ' : 'Phân rã'}</Badge>
      )}
      {kpi.effectivePerspectiveName && (
        <Badge variant="outline" title={`Hạng mục BSC: ${kpi.effectivePerspectiveName}`}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: kpi.effectivePerspectiveColor || 'var(--color-primary)' }} aria-hidden="true" />
          {kpi.effectivePerspectiveName}
        </Badge>
      )}
    </div>
  )
}
