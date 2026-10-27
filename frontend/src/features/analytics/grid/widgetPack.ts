import type { ReactNode } from 'react'
import type { DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import type { WidgetSettings } from '@/components/common/dashboard/widgetSettings'
import type { DateFilterIntent } from '../filter/dateFilterModel'
import type { KpiCycle, KpiPeriod } from '@/types/kpi'
import type { OptionField } from './analyticsGrid'

/**
 * Hợp đồng giữa trang Thống kê (một lưới duy nhất) và từng CỤM Ô.
 *
 * <p>Trước đây mỗi cụm là một tab riêng, tự giữ lưới và bố cục của mình. Gộp về một trang thì chỉ
 * còn MỘT lưới, nên mỗi cụm thu lại thành một component vẽ ĐÚNG MỘT ô mà lưới hỏi tới.
 *
 * <p>Một cụm bị gắn nhiều lần (mỗi ô đang hiện một lần) nên các truy vấn cấp cụm chạy lặp — nhưng
 * React Query gộp theo khoá nên chỉ có MỘT lần ra mạng; phần lặp chỉ là đăng ký cache. Đổi lại,
 * cụm không có ô nào đang hiện thì KHÔNG được gắn lần nào (lưới chỉ gọi `renderWidget` cho ô
 * `visible`), nên người dùng ẩn hết ô BSC là không có lời gọi BSC nào.
 */
export interface WidgetPackProps {
  /** Ô mà lưới đang hỏi. Cụm tự switch theo `widget.type`/`widget.i`. */
  widget: DashboardWidget
  /** Dòng tóm tắt cấu hình đặt dưới tiêu đề — trang dựng sẵn cho mọi cụm. */
  meta: ReactNode
  /** Mở bảng cấu hình của chính ô này. */
  openConfig: () => void
  pageIntent: DateFilterIntent
  periods: KpiPeriod[]
  cycles: KpiCycle[]
  unitOptions: { id: string; label: string }[]
  /** Toàn bộ ô trên lưới — cụm nào cần đọc cài đặt của ô khác (Tổng quan) thì tra ở đây. */
  widgets: DashboardWidget[]
  updateWidgetSettings: (i: string, patch: Partial<WidgetSettings>) => void
}

/** Một cụm ô: danh sách ô mặc định + nhãn thư viện + component vẽ. */
export interface WidgetPack {
  /** Ô của cụm, theo đúng thứ tự muốn xuất hiện trong thư viện. */
  widgets: () => DashboardWidget[]
  groupOf: () => Record<string, string>
  previewOf: Record<string, string>
  descOf: () => Record<string, string>
  /** Tuỳ chọn động (danh sách kỳ, danh sách mục tiêu…) cho bảng cấu hình của một ô. */
  extraFieldsOf?: (i: string) => OptionField[] | undefined
}
