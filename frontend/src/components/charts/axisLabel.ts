import { AXIS_COLORS } from './chartPalette'

/**
 * Cấu hình nhãn trục dùng chung cho mọi biểu đồ.
 *
 * <p>Gom về một chỗ vì nhãn trục phải trông giống nhau ở mọi biểu đồ — lệch cỡ chữ hay lệch màu
 * giữa hai thẻ cạnh nhau đọc ra ngay. Cũng để chỉnh một lần là đổi cả hệ thống.
 *
 * <p>Trục ngang là danh mục hiển nhiên (tên đơn vị, tên người) thì ĐỪNG gắn nhãn — dán chữ
 * "Đơn vị" cạnh một cột tên đơn vị là chú thích thừa.
 */
export const xAxisLabel = (value: string) => ({
  value,
  position: 'insideBottom' as const,
  offset: -12,
  fill: AXIS_COLORS.tick,
  fontSize: 11,
  fontWeight: 700,
})

/** Trục dọc gần như luôn là đại lượng đo được, nên gần như luôn cần nhãn kèm đơn vị. */
export const yAxisLabel = (value: string) => ({
  value,
  angle: -90,
  position: 'insideLeft' as const,
  style: { textAnchor: 'middle' as const },
  fill: AXIS_COLORS.tick,
  fontSize: 11,
  fontWeight: 700,
})

/**
 * Nhãn cho trục dọc BÊN PHẢI của biểu đồ hai thang đo.
 *
 * <p>Không dùng chung với {@link yAxisLabel} được: `insideLeft` trên một trục nằm bên phải sẽ đặt
 * chữ ĐÈ vào giữa vùng vẽ. Xoay +90° để chữ vẫn đọc xuôi khi nghiêng đầu từ phía ngoài vào, đúng
 * quy ước của trục phụ.
 */
export const yAxisLabelRight = (value: string) => ({
  value,
  angle: 90,
  position: 'insideRight' as const,
  style: { textAnchor: 'middle' as const },
  fill: AXIS_COLORS.tick,
  fontSize: 11,
  fontWeight: 700,
})

/**
 * Thuộc tính cho chữ nằm TRỰC TIẾP trên mảng màu (ô treemap, ô heatmap).
 *
 * <p>Chọn màu chữ theo nền là chưa đủ: mảng màu bão hoà nào cũng làm chữ bị "rung" ở mép, và chỉ
 * cần nền lệch một bậc là tương phản tụt xuống dưới ngưỡng. Viền hào quang NGƯỢC màu vẽ dưới chữ
 * (`paintOrder="stroke"`) tách hẳn nét chữ khỏi nền, đọc được trên mọi màu — đây là cách nhãn bản
 * đồ vẫn dùng khi không kiểm soát được nền phía dưới.
 */
export function labelOnFill(fg: string) {
  return {
    fill: fg,
    stroke: fg === '#ffffff' ? '#0f172a' : '#ffffff',
    strokeWidth: 3,
    strokeOpacity: 0.5,
    strokeLinejoin: 'round' as const,
    paintOrder: 'stroke' as const,
  }
}
