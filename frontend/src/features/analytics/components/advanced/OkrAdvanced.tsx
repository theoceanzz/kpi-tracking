import FlowSankey from '@/components/charts/primitives/FlowSankey'
import { useOkrFlow } from '../../hooks/useAdvancedAnalytics'
import type { AdvancedFilter } from '../../api/advancedAnalyticsApi'
import { useTranslation } from 'react-i18next'

/**
 * F5 — Luồng phân bổ OKR: Mục tiêu → Key Result → Đơn vị.
 *
 * <p>Bảng phân cấp cho biết mỗi mục tiêu có những Key Result nào; biểu đồ này cho biết trọng số
 * thực sự đổ về đơn vị nào. Một đơn vị nhận nhiều dải dày từ nhiều mục tiêu khác nhau là dấu hiệu
 * quá tải mà bảng lồng ba tầng rất khó cho thấy.
 */
export function OkrFlowSection({ filter }: { filter: AdvancedFilter }) {
  const { t } = useTranslation('analytics')
  const { data, isLoading } = useOkrFlow(filter)

  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center text-[var(--color-subtle-foreground)] font-semibold">
        {t('OkrAdvanced.loadingOkrFlow')}
      </div>
    )
  }

  if (!data || data.empty) {
    return (
      <div className="h-[300px] flex items-center justify-center text-sm text-[var(--color-subtle-foreground)] font-medium text-center px-4">
        {t('OkrAdvanced.noKeyResultHasHadWeight')}<br />
        {t('OkrAdvanced.flowsAppearWhenAKeyResult')}
      </div>
    )
  }

  return (
    <div className="w-full">
      <FlowSankey nodes={data.nodes} links={data.links} valueLabel={data.valueLabel} height={340} />
      <p className="text-caption font-medium text-center mt-1">
        {t('OkrAdvanced.bandThicknessIsTheAllocatedWeight')}
      </p>
    </div>
  )
}
