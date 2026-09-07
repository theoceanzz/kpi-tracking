/**
 * Bảng màu dùng chung cho biểu đồ.
 *
 * Trước file này, cùng một dải màu bị chép ở bảy chỗ với giá trị lệch nhau:
 * `CHART_COLORS` (MyStatsTab), `COLORS` (MemberRoleChart, SubmissionStatusChart),
 * `COMPLETION_COLORS`/`PERFORMANCE_COLORS` (ScopedDashboardWidget, OrgUnitKpiDrawer) và
 * `RATING_COLORS` (MatrixOverviewPanel, UnitClassificationConfigSection).
 * Đổi màu thương hiệu trước đây phải sửa từng nơi và luôn sót.
 *
 * Quy ước quan trọng: khi tổ chức đã cấu hình màu trong DB (`EvaluationLevel.color`,
 * `QualitativeLevel.color`, `BscPerspective.color`) thì màu đó THẮNG. Các hằng ở đây chỉ là
 * phương án dự phòng khi dữ liệu chưa có màu — dùng {@link resolveColor} để áp đúng thứ tự ưu tiên.
 */

/** Dải phân loại chuỗi (mỗi series một màu). Thứ tự cố định để cùng một series luôn cùng màu. */
export const SERIES_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e',
] as const

/** Hai đại lượng xuất hiện ở hầu hết biểu đồ; `dim` dùng khi làm mờ lúc hover series khác. */
export const METRIC_COLORS = {
  completion: { normal: '#10b981', dim: '#10b98140' },
  performance: { normal: '#3b82f6', dim: '#3b82f640' },
} as const

/** Xếp loại ma trận 1..5 — đỏ (kém) → xanh (tốt). */
export const RATING_COLORS: Record<number, string> = {
  1: '#ef4444', 2: '#f97316', 3: '#f59e0b', 4: '#84cc16', 5: '#10b981',
}

/** Không có dữ liệu / chưa xác định. */
export const NEUTRAL_COLOR = '#94a3b8'
/** Rating nằm ngoài dải 1..5 (tổ chức cấu hình thang khác). */
export const OUT_OF_RANGE_COLOR = '#8b5cf6'

/** Trạng thái bài nộp — dùng chung cho stacked area, 100% stacked, pie. */
export const SUBMISSION_STATUS_COLORS: Record<string, string> = {
  DRAFT: '#94a3b8',
  PENDING: '#f59e0b',
  APPROVED: '#10b981',
  REJECTED: '#ef4444',
}

/** Nhãn tiếng Việt đi kèm, để mọi biểu đồ gọi cùng một tên cho cùng một trạng thái. */
export const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
}

/** Màu theo xếp loại ma trận, tự lo trường hợp null và rating ngoài dải. */
export function ratingColor(rating?: number | null): string {
  if (rating == null) return NEUTRAL_COLOR
  return RATING_COLORS[Math.round(rating)] ?? OUT_OF_RANGE_COLOR
}

/** Màu theo chỉ số trong chuỗi, quay vòng khi vượt độ dài bảng. */
export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length]!
}

/**
 * Ưu tiên màu do tổ chức cấu hình, rơi về màu chuỗi theo vị trí nếu chưa có.
 * Dùng cho perspective/level lấy từ API — tránh mỗi biểu đồ tự viết một kiểu fallback.
 */
export function resolveColor(configured: string | null | undefined, index: number): string {
  return configured && configured.trim() ? configured : seriesColor(index)
}

/** Hex (#rrggbb) + alpha (0..1) → rgba(). Dùng cho nền heatmap và chấm mờ. */
export function hexAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return hex
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Màu lưới/trục dùng chung, giữ cho biểu đồ mới trông cùng một hệ với biểu đồ cũ. */
export const AXIS_COLORS = {
  grid: '#E2E8F0',
  tick: '#64748B',
} as const

/**
 * Màu chữ đọc được trên nền `bg`: đen phiến hoặc trắng, tuỳ độ sáng của nền.
 *
 * <p>Đừng mặc định chữ trắng. Thang xếp loại có `#84cc16` (lime) và `#f59e0b` (hổ phách) — chữ
 * trắng trên hai màu đó chỉ đạt tương phản khoảng 2:1, dưới xa ngưỡng đọc được 4.5:1, nên nhìn
 * như bị mờ. Tăng cỡ chữ không cứu được, phải đổi màu chữ.
 *
 * <p>Độ sáng tính theo công thức luminance của WCAG (có bước gamma), không phải trung bình cộng
 * RGB — mắt nhạy với xanh lá hơn hẳn xanh dương nên trung bình cộng sẽ chọn sai trên chính hai
 * màu lime và hổ phách đang gây lỗi.
 */
export function textOn(bg: string): string {
  const hex = bg.replace('#', '')
  if (hex.length !== 6) return '#ffffff'
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
  // Điểm cân: nơi tương phản với trắng bằng tương phản với #0f172a. Giải (1.05)/(L+.05) =
  // (L+.05)/(0.0636) ra L ≈ 0.21. Trên ngưỡng thì chữ đen tương phản cao hơn, dưới thì chữ trắng.
  return luminance > 0.21 ? '#0f172a' : '#ffffff'
}

/**
 * Bản NHẠT MỘT BẬC của thang xếp loại, dành riêng cho **mảng màu lớn** (treemap, heatmap).
 *
 * <p>`RATING_COLORS` vốn chọn cho chấm và cột nhỏ, nơi màu đậm giúp nhận ra nhanh. Trải cùng màu
 * đó ra một ô treemap chiếm nửa khung thì thành chói mắt, và chữ đen trên `#ef4444` chỉ đạt
 * 4,74:1 — vừa đủ ngưỡng, đọc vẫn mệt. Dải này nâng tương phản thấp nhất lên 6,45:1 mà vẫn giữ
 * đúng sắc để "đỏ = kém" đọc ra tức thì.
 */
export const RATING_SURFACE_COLORS: Record<number, string> = {
  1: '#f87171', 2: '#fb923c', 3: '#fbbf24', 4: '#a3e635', 5: '#34d399',
}

/** Màu nền mảng lớn theo xếp loại, tự lo null và rating ngoài dải. */
export function ratingSurface(rating?: number | null): string {
  if (rating == null) return NEUTRAL_COLOR
  return RATING_SURFACE_COLORS[Math.round(rating)] ?? OUT_OF_RANGE_COLOR
}

/**
 * Màu nền ô theo % đạt được — dùng chung cho mọi treemap.
 *
 * <p>Gom về đây vì trước đó mỗi treemap tự chép một bản; sửa ngưỡng ở một chỗ là chắc chắn sót
 * chỗ kia, và hai biểu đồ cạnh nhau tô khác màu cho cùng một mức thì đọc sai ngay.
 */
export function achievementSurface(v?: number | null): string {
  if (v == null) return NEUTRAL_COLOR
  if (v >= 100) return ratingSurface(5)
  if (v >= 80) return ratingSurface(4)
  if (v >= 60) return ratingSurface(3)
  if (v >= 40) return ratingSurface(2)
  return ratingSurface(1)
}
