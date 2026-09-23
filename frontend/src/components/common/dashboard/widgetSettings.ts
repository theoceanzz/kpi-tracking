import type { DateFilterIntent } from '@/features/analytics/filter/dateFilterModel'

/**
 * Cấu hình riêng của MỘT ô trên lưới — thứ bảng cấu hình bên phải chỉnh và lưới lưu xuống server.
 *
 * <p>Trước đây hai thứ này nằm ở hai chỗ khác nhau và không đồng bộ được: cách biểu diễn nằm trong
 * `localStorage` (`useTrendMode`, `useChartTableView`) nên không theo người dùng sang máy khác,
 * còn bộ lọc thì dùng chung cho cả trang nên không có "riêng của ô" nào cả.
 *
 * <p>Tên khoá cố ý ngắn: cả mảng widget nằm gọn trong một cột JSON.
 */
export interface WidgetSettings {
  /** Cách biểu diễn, phải là một `key` trong `variants` của định nghĩa biểu đồ. */
  v?: string
  /**
   * Ghi đè bộ lọc thời gian. Vắng mặt = kế thừa bộ lọc mặc định của trang.
   *
   * <p>Lưu Ý ĐỊNH chứ không lưu khoảng đã tính — xem `dateFilterModel`.
   */
  f?: DateFilterIntent
  /** Ghi đè đơn vị. Vắng mặt = theo mặc định của trang. */
  orgUnitId?: string
  /** Chế độ xem bảng thay vì biểu đồ, với những ô có cả hai. */
  table?: boolean
  /**
   * Lựa chọn riêng của từng loại biểu đồ (Top-N, tốt nhất/trì trệ, chung/riêng…). Khoá và giá trị
   * hợp lệ do `WIDGET_OPTIONS` ở tầng tính năng khai báo; ở đây chỉ mang đi.
   */
  o?: Record<string, string>
}
