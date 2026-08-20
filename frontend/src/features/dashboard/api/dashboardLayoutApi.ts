import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'

/**
 * Vai trò quyết định danh mục widget của trang chủ; mỗi vai trò lưu một bố cục riêng.
 * Phó đơn vị tách khỏi trưởng đơn vị vì phạm vi và quyền hành động khác hẳn.
 */
export type DashboardScope = 'DIRECTOR' | 'HEAD' | 'DEPUTY' | 'STAFF'

/** Một ô trên lưới trang chủ. Khớp với `DashboardWidget` của ChartWrapper, bỏ phần chỉ dùng lúc chạy. */
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
}

export interface DashboardLayoutResponse {
  scope: DashboardScope
  /** null khi người dùng chưa từng tuỳ chỉnh → dùng preset mặc định. */
  layout: string | null
  updatedAt?: string
}

export const dashboardLayoutApi = {
  get: (scope: DashboardScope) =>
    axiosInstance
      .get<ApiResponse<DashboardLayoutResponse>>('/dashboard/layout', { params: { scope } })
      .then(r => r.data.data),

  save: (scope: DashboardScope, layout: DashboardLayoutItem[]) =>
    axiosInstance
      .put<ApiResponse<DashboardLayoutResponse>>('/dashboard/layout', {
        scope,
        layout: JSON.stringify(layout),
      })
      .then(r => r.data.data),

  reset: (scope: DashboardScope) =>
    axiosInstance.delete<void>('/dashboard/layout', { params: { scope } }).then(() => undefined),
}
