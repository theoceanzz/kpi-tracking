import type { DashboardWidget } from './ChartWrapper'
import type { GridLayoutItem } from './DashboardCustomizeChrome'

/**
 * Bố cục lưới theo breakpoint cho react-grid-layout: lg/md giữ vị trí tuỳ chỉnh; sm/xs/xxs
 * xếp chồng full-width theo thứ tự trên xuống.
 *
 * <p>Chỉ đưa vào lưới ĐÚNG năm trường hình học `{i, x, y, w, h}`. Widget lấy từ catalog còn mang
 * theo `icon` (React element), mô tả, cờ tính năng… — react-grid-layout so sánh sâu `layouts`
 * mỗi lần render để quyết định có dựng lại bố cục hay không, và một React element trong đó làm
 * phép so sánh ấy không bao giờ bằng nhau: mỗi render lại "đổi bố cục", GridItem nhận lẫn lộn
 * bố cục của breakpoint cũ với số cột của breakpoint mới trong lúc đổi kích thước. Đó là mắt
 * xích đầu của lỗi "Maximum update depth exceeded" làm trắng cả trang chủ (15/09).
 *
 * <p>Nơi gọi bọc trong `useMemo(..., [widgets])` để object không đổi identity giữa các render.
 */
export function buildGridLayouts(widgets: DashboardWidget[]): Record<string, GridLayoutItem[]> {
  const visible = widgets
    .filter(b => b.visible)
    .map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))
  const ordered = [...visible].sort((a, b) => a.y - b.y || a.x - b.x)
  const stackFull = (cols: number) => ordered.map((w, i) => ({ i: w.i, x: 0, y: i, w: cols, h: w.h }))
  return {
    lg: visible, md: visible,
    sm: stackFull(12), xs: stackFull(6), xxs: stackFull(4),
  }
}
