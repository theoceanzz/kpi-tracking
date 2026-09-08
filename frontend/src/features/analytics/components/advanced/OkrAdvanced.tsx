import FlowSankey from '@/components/charts/primitives/FlowSankey'
import { useOkrFlow } from '../../hooks/useAdvancedAnalytics'
import type { AdvancedFilter } from '../../api/advancedAnalyticsApi'

/**
 * F5 — Luồng phân bổ OKR: Mục tiêu → Key Result → Đơn vị.
 *
 * <p>Bảng phân cấp cho biết mỗi mục tiêu có những Key Result nào; biểu đồ này cho biết trọng số
 * thực sự đổ về đơn vị nào. Một đơn vị nhận nhiều dải dày từ nhiều mục tiêu khác nhau là dấu hiệu
 * quá tải mà bảng lồng ba tầng rất khó cho thấy.
 */
export function OkrFlowSection({ filter }: { filter: AdvancedFilter }) {
  const { data, isLoading } = useOkrFlow(filter)

  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center text-slate-400 font-bold">
        Đang tải luồng OKR...
      </div>
    )
  }

  if (!data || data.empty) {
    return (
      <div className="h-[300px] flex items-center justify-center text-sm text-slate-400 font-medium text-center px-4">
        Chưa có Key Result nào được phân bổ trọng số xuống đơn vị.<br />
        Luồng xuất hiện khi Key Result được gán trọng số cho ít nhất một đơn vị.
      </div>
    )
  }

  return (
    <div className="w-full">
      <FlowSankey nodes={data.nodes} links={data.links} valueLabel={data.valueLabel} height={340} />
      <p className="text-[11px] text-slate-400 font-medium text-center mt-1">
        Độ dày dải là trọng số phân bổ (%) · ba tầng: Mục tiêu → Key Result → Đơn vị thực hiện.
      </p>
    </div>
  )
}
