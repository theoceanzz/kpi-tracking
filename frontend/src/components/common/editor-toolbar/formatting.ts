/**
 * Lựa chọn định dạng dùng chung cho mọi trình soạn (tài liệu, thư gửi tài liệu, mẫu email) — và phải khớp `MailDocRenderer` phía máy chủ, nơi
 * dựng HTML thư từ cùng các giá trị này (giá trị ngoài danh sách bị bỏ).
 */

/**
 * Bảng màu có tên của BlockNote (lưu trong tài liệu bằng TÊN, không phải mã màu). Mã hex chỉ để vẽ ô chọn và để máy chủ
 * dựng thư đúng màu.
 */
export const TEXT_COLORS: Record<string, string> = {
  gray: '#9b9a97', brown: '#64473a', red: '#e03e3e', orange: '#d9730d', yellow: '#dfab01',
  green: '#4d6461', blue: '#0b6e99', purple: '#6940a5', pink: '#ad1a72',
}
export const BG_COLORS: Record<string, string> = {
  gray: '#ebeced', brown: '#e9e5e3', red: '#fbe4e4', orange: '#f6e9d9', yellow: '#fbf3db',
  green: '#ddedea', blue: '#ddebf1', purple: '#eae4f2', pink: '#f4dfeb',
}

/** Phông chữ: tên hiển thị → giá trị CSS lưu trong tài liệu. Toàn phông có sẵn trên Windows / macOS / điện thoại. */
export const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
]

/** Nấc cỡ chữ của nút − / + (px). Gõ tay được số khác trong khoảng MIN–MAX. */
export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72]
export const FONT_SIZE_MIN = 6
export const FONT_SIZE_MAX = 96
/** Cỡ chữ đoạn văn mặc định của BlockNote. */
export const DEFAULT_FONT_SIZE = 16

export const FONT_SIZE_VALUE = /^\d{1,2}px$/

/** Mức thu phóng của trang soạn tài liệu (%). */
export const ZOOM_LEVELS = [50, 75, 90, 100, 110, 125, 150, 200]
