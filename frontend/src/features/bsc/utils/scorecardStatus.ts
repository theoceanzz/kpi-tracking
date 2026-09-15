import { BscScorecardStatus } from '../types'

/**
 * Nhãn và màu của vòng đời bộ tiêu chí — NGUỒN DUY NHẤT cho mọi màn hình.
 *
 * <p>Trước đây mỗi nơi tự viết một chuỗi ternary riêng, và khi vòng đời mở rộng từ 3 lên 7 trạng
 * thái thì chỉ có tab Cây phân rã được cập nhật: danh sách bộ tiêu chí vẫn dùng nhánh mặc định
 * "Nháp" cho mọi trạng thái lạ, nên thẻ đang CHỜ DUYỆT hiện ra là NHÁP. Lỗi kiểu đó không có tín
 * hiệu nào báo — chỉ lộ ra khi có người mở hai màn hình cạnh nhau.
 *
 * <p>Thêm trạng thái mới thì `Record` bắt buộc khai đủ, trình biên dịch sẽ chỉ ra chỗ còn thiếu.
 */
export const SCORECARD_STATUS_META: Record<
  BscScorecardStatus,
  { label: string; badgeClass: string; textClass: string }
> = {
  [BscScorecardStatus.DRAFT]: {
    label: 'Nháp',
    badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    textClass: 'text-slate-500',
  },
  [BscScorecardStatus.SUBMITTED]: {
    label: 'Chờ duyệt',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    textClass: 'text-amber-600',
  },
  // Luồng hiện tại KHÔNG dừng ở đây nữa (duyệt là áp dụng luôn) — nhãn chỉ còn gặp ở thẻ cũ.
  [BscScorecardStatus.APPROVED]: {
    label: 'Đã duyệt · chờ áp dụng',
    badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    textClass: 'text-sky-600',
  },
  [BscScorecardStatus.ACTIVE]: {
    label: 'Đang áp dụng',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    textClass: 'text-emerald-600',
  },
  [BscScorecardStatus.CLOSED]: {
    label: 'Đã đóng',
    badgeClass: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    textClass: 'text-slate-500',
  },
  [BscScorecardStatus.LOCKED]: {
    label: 'Đã khoá',
    badgeClass: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    textClass: 'text-slate-600',
  },
  [BscScorecardStatus.ARCHIVED]: {
    label: 'Lưu trữ',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    textClass: 'text-amber-600',
  },
}

/** Tra an toàn cho dữ liệu cũ mang trạng thái ngoài enum. */
export const scorecardStatusMeta = (status?: BscScorecardStatus | null) =>
  (status && SCORECARD_STATUS_META[status]) || SCORECARD_STATUS_META[BscScorecardStatus.DRAFT]

/**
 * Ba trạng thái người duyệt CHỌN TAY được trong form.
 * Bốn trạng thái còn lại do luồng trình–duyệt đặt, không ai chọn trực tiếp.
 */
export const SCORECARD_STATUS_CHOICES: BscScorecardStatus[] = [
  BscScorecardStatus.DRAFT,
  BscScorecardStatus.ACTIVE,
  BscScorecardStatus.ARCHIVED,
]
