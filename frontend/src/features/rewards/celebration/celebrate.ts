import { levelOf, type CelebrationEvent, type CelebrationLevel } from './celebrationPlan'
import type { CelebrationQueue } from './celebrationQueue'
import { isCelebrationEnabled } from './celebrationSettings'

/**
 * Cửa vào duy nhất của tính năng ăn mừng. `CelebrationHost` (gắn một lần trong AppLayout) đăng ký
 * hàng đợi của nó ở đây; mọi nơi khác chỉ gọi {@link celebrate}.
 */
let queue: CelebrationQueue | null = null

export function registerCelebrationQueue(q: CelebrationQueue) {
  queue = q
  return () => {
    if (queue === q) queue = null
  }
}

/**
 * Xếp một sự kiện vào hàng ăn mừng.
 *
 * @returns cấp hiệu ứng sẽ chạy, hoặc `null` khi KHÔNG có hiệu ứng nào (người dùng tắt công tắc,
 *   hoặc chưa có host — ngoài AppLayout). Nơi gọi dựa vào giá trị này để giữ toast cũ: `null` thì
 *   hiện toast như trước khi có tính năng; cấp "vừa" thì host đã hiện toast chúc mừng THAY toast cũ.
 *
 * Điểm danh / đổi quà là việc người dùng vừa tự bấm nên đi ngay; thưởng điểm (đến từ người khác)
 * chờ một nhịp để gộp các lượt về cùng lúc.
 */
export function celebrate(event: CelebrationEvent): CelebrationLevel | null {
  if (!queue || !isCelebrationEnabled()) return null
  queue.push(event, { immediate: event.kind !== 'POINTS' })
  return levelOf(event)
}
