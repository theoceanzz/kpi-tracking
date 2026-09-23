import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import type { WidgetSettings } from '@/components/common/dashboard/widgetSettings'

/**
 * Vai trò quyết định danh mục widget của trang chủ; mỗi vai trò lưu một bố cục riêng.
 * Phó đơn vị tách khỏi trưởng đơn vị vì phạm vi và quyền hành động khác hẳn.
 */
export type DashboardScope = 'DIRECTOR' | 'HEAD' | 'DEPUTY' | 'STAFF'

/**
 * Các tab Thống kê cũng dùng đúng lưới đó, mỗi tab một bố cục riêng.
 *
 * <p>Cố ý tách khỏi {@link DashboardScope} chứ không gộp làm một union: nhiều chỗ ở trang chủ
 * khai báo `Record<DashboardScope, …>` đủ mọi nhánh, gộp vào là bắt chúng khai thêm bốn nhánh
 * vô nghĩa.
 */
export type AnalyticsGridScope =
  | 'ANALYTICS_SUMMARY'
  | 'ANALYTICS_MY_KPI'
  | 'ANALYTICS_MY_OBJECTIVES'
  | 'ANALYTICS_SUBORDINATE'
  | 'ANALYTICS_DRILLDOWN'
  | 'ANALYTICS_BSC'

/** Mọi khu vực lưới có bố cục lưu được. Khớp enum `DashboardScope` phía backend. */
export type LayoutScope = DashboardScope | AnalyticsGridScope

/** Một ô trên lưới. Khớp với `DashboardWidget` của ChartWrapper, bỏ phần chỉ dùng lúc chạy. */
export interface DashboardLayoutItem {
  i: string
  x: number
  y: number
  w: number
  h: number
  visible: boolean
  /**
   * Widget người dùng đã CHỦ ĐỘNG gỡ khỏi trang.
   *
   * <p>Phải lưu lại thay vì chỉ bỏ khỏi mảng, nếu không lúc nạp lại không có cách nào phân
   * biệt "widget mới ra ở bản deploy sau" với "widget người dùng vừa xoá" — và widget đã xoá
   * sẽ bị chèn lại. Bản ghi này không chiếm chỗ trên lưới, chỉ là dấu vết.
   */
  removed?: boolean
  /**
   * Cấu hình riêng của ô: cách biểu diễn và bộ lọc ghi đè. Tên khoá ngắn vì cả mảng nằm gọn
   * trong một cột; vắng mặt = dùng toàn bộ mặc định.
   */
  s?: WidgetSettings
}

export interface DashboardLayoutResponse {
  scope: LayoutScope
  /** null khi người dùng chưa từng tuỳ chỉnh → dùng preset mặc định. */
  layout: string | null
  updatedAt?: string
}

export const dashboardLayoutApi = {
  get: (scope: LayoutScope) =>
    axiosInstance
      .get<ApiResponse<DashboardLayoutResponse>>('/dashboard/layout', { params: { scope } })
      .then(r => r.data.data),

  save: (scope: LayoutScope, layout: DashboardLayoutItem[]) =>
    axiosInstance
      .put<ApiResponse<DashboardLayoutResponse>>('/dashboard/layout', {
        scope,
        layout: JSON.stringify(layout),
      })
      .then(r => r.data.data),

  reset: (scope: LayoutScope) =>
    axiosInstance.delete<void>('/dashboard/layout', { params: { scope } }).then(() => undefined),
}
