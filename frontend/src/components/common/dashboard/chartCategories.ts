/**
 * Tám nhóm biểu đồ của thư viện "Thêm biểu đồ", theo đúng thứ tự muốn hiện.
 *
 * <p>Tách khỏi `DashboardCustomizeChrome` vì file đó chỉ được xuất component — xuất thêm hằng ở
 * đó là fast-refresh mất tác dụng cho cả file.
 */
export const CHART_CATEGORY_ORDER = [
  'Số liệu',
  'Biểu đồ so sánh',
  'Biểu đồ tương quan',
  'Biểu đồ xu hướng',
  'Biểu đồ phân phối',
  'Từ bộ phận đến tổng thể',
  'Biểu đồ luồng',
  'Biểu đồ xếp hạng',
] as const
