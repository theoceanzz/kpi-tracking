import { Badge } from '@/components/ui/badge'
import { FREQUENCY_MAP } from '@/lib/utils'
import type { KpiCriteria } from '@/types/kpi'
import { useTranslation } from 'react-i18next'
import { MessageSquare, ListTodo, AlertTriangle } from 'lucide-react'

/**
 * Hàng nhãn phân loại của một chỉ tiêu, dùng chung cho mọi bảng/thẻ KPI (UX_PATTERNS.md P1
 * "Tên chỉ tiêu"): tần suất · N KPI con · Định tính · KPI ngược · KPI thưởng · quan hệ cha-con ·
 * hạng mục BSC. Cùng một thứ tự và cùng biến thể Badge ở mọi trang.
 *
 * Cuối hàng là số liệu cộng tác của NGƯỜI XEM: bình luận chưa đọc (để cấp trên biết KPI nào đang có trao đổi mới)
 * và tiến độ công việc "x/y việc" (+ số quá hạn).
 */
export default function KpiTagChips({ kpi, childCount = 0, isChildRow = false, showFrequency = true }: {
  kpi: KpiCriteria
  childCount?: number
  isChildRow?: boolean
  showFrequency?: boolean
}) {
  const { t } = useTranslation('kpi')
  return (
    <div className="flex flex-wrap items-center gap-1">
      {showFrequency && <span className="text-caption">{FREQUENCY_MAP()[kpi.frequency as keyof ReturnType<typeof FREQUENCY_MAP>] || kpi.frequency}</span>}
      {!isChildRow && childCount > 0 && <Badge variant="secondary">{t('KpiTagChips.childCount', { count: childCount })}</Badge>}
      {kpi.kpiType === 'QUALITATIVE' && <Badge variant="outline">{t('KpiTagChips.qualitative')}</Badge>}
      {kpi.isReverseKpi && <Badge variant="warning">{t('KpiTagChips.inverseKpi')}</Badge>}
      {kpi.isBonusKpi && <Badge variant="success">{t('KpiTagChips.bonusKpi')}</Badge>}
      {isChildRow && kpi.parentRelationType && (
        <Badge variant="info">{kpi.parentRelationType === 'DECOMPOSITION' ? t('KpiTagChips.split') : t('KpiTagChips.cascade')}</Badge>
      )}
      {kpi.effectivePerspectiveName && (
        <Badge variant="outline" title={t('KpiTagChips.bscItem', { effectivePerspectiveName: kpi.effectivePerspectiveName })}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: kpi.effectivePerspectiveColor || 'var(--color-primary)' }} aria-hidden="true" />
          {kpi.effectivePerspectiveName}
        </Badge>
      )}
      {!!kpi.unreadComments && (
        <Badge variant="info" title={t('KpiTagChips.unreadComments', { count: kpi.unreadComments })}>
          <MessageSquare size={11} aria-hidden="true" /> {kpi.unreadComments}
        </Badge>
      )}
      {kpi.taskProgress && kpi.taskProgress.total > 0 && (
        <Badge
          variant={kpi.taskProgress.overdue > 0 ? 'warning' : 'outline'}
          title={t('KpiTagChips.taskProgress', { done: kpi.taskProgress.done, total: kpi.taskProgress.total, overdue: kpi.taskProgress.overdue })}
        >
          <ListTodo size={11} aria-hidden="true" /> {kpi.taskProgress.done}/{kpi.taskProgress.total}
          {kpi.taskProgress.overdue > 0 && <><AlertTriangle size={11} aria-hidden="true" /> {kpi.taskProgress.overdue}</>}
        </Badge>
      )}
    </div>
  )
}
