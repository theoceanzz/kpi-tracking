/**
 * Mức hiệu ứng chúc mừng — tuỳ chọn riêng từng máy (localStorage), chọn ở hàng "Hiệu ứng chúc mừng" trong hộp
 * chuông, cạnh công tắc tiếng thông báo:
 * - `full` (MẶC ĐỊNH): pháo hoa, lớp cả màn hình, banner trượt, "+N" bay — mọi chuyển động.
 * - `gentle`: bản nhẹ — vẫn lớp phủ / vật thể / banner / toast / tiếng nhưng chỉ mờ vào–ra, không pháo, confetti,
 *   mưa xu, "+N" bay; vật thể Lottie đứng yên ở một khung đẹp.
 * - `off`: không hiệu ứng nào, người dùng nhận toast như trước khi có tính năng.
 *
 * CỐ Ý không đọc `prefers-reduced-motion` của hệ điều hành (quyết định 2026-10-19, thay quyết định cũ "máy giảm
 * chuyển động ⇒ bản nhẹ"): rất nhiều máy Windows tắt Animation effects vì hiệu năng — Chrome báo thành
 * reduced-motion — nên đọc nó thì phần lớn người dùng không bao giờ thấy bản đầy đủ. Người thật sự cần giảm
 * chuyển động tự chọn "Nhẹ" hoặc "Tắt"; lớp cả màn hình vẫn bấm đâu cũng bỏ qua được.
 *
 * Tiếng còn phụ thuộc công tắc tiếng thông báo (`playCue` tự kiểm): tắt "ting" là tắt luôn kèn.
 */
export type CelebrationMode = 'full' | 'gentle' | 'off'

export const CELEBRATION_MODES: readonly CelebrationMode[] = ['full', 'gentle', 'off']

const KEY = 'keygo.celebrations'

/** Đọc mức đã lưu. Giá trị cũ của công tắc bật/tắt (`on` / `off`) vẫn hiểu đúng: `on` ⇒ đầy đủ. */
export function parseCelebrationMode(raw: string | null): CelebrationMode {
  if (raw === 'off') return 'off'
  if (raw === 'gentle') return 'gentle'
  return 'full'
}

export function getCelebrationMode(): CelebrationMode {
  try {
    return parseCelebrationMode(localStorage.getItem(KEY))
  } catch {
    return 'full'
  }
}

export function setCelebrationMode(mode: CelebrationMode) {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    // Chế độ ẩn danh / chặn lưu trữ: chỉ mất tuỳ chọn.
  }
  applyModeAttribute(mode)
}

export const isCelebrationEnabled = () => getCelebrationMode() !== 'off'

/** Bản nhẹ? Mọi phần của hiệu ứng (JS lẫn CSS) theo đúng một luật này. */
export const isGentleMode = () => getCelebrationMode() === 'gentle'

/**
 * CSS của hiệu ứng (`celebration.css`) đọc `html[data-celebration-mode="gentle"]` để thay chuyển động bằng mờ
 * vào–ra cho các phần dựng bằng class (toast, hộp giấy khen, hộp mã quà).
 */
export function applyModeAttribute(mode: CelebrationMode = getCelebrationMode()) {
  if (typeof document !== 'undefined') document.documentElement.dataset.celebrationMode = mode
}
