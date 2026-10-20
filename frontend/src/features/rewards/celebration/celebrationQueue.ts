import { planBatch, type CelebrationEvent, type CelebrationShow } from './celebrationPlan'

/**
 * Hàng đợi ăn mừng: gom sự kiện, chờ đúng lúc, phát lần lượt từng hộp.
 *
 * - Sự kiện "đến từ người khác" (được thưởng) chờ {@link debounceMs} sau sự kiện cuối để gộp một
 *   đợt phát thưởng hàng loạt thành một hộp; có trần {@link maxWaitMs} để luồng sự kiện liên tục
 *   không giữ mãi.
 * - Sự kiện người dùng VỪA tự bấm (điểm danh, đổi quà) đi ngay (`immediate`): chậm 1,5s sau cú bấm
 *   thì hiệu ứng thành ra trễ, không còn là phản hồi của cú bấm nữa.
 * - `isBlocked()` đúng (tab đang ẩn, bài hướng dẫn đang chạy) thì giữ nguyên trong hàng, chờ
 *   `resume()` — người dùng phải thực sự nhìn thấy.
 * - Mỗi lần chỉ một hộp: `onShow` trả Promise xong khi hộp đóng / hiệu ứng hết, rồi mới tới hộp sau.
 *
 * Không biết gì về DOM — nơi dùng tiêm cổng chặn và hàm hiển thị vào, nên test được bằng fake timer.
 */
export interface CelebrationQueueOptions {
  isBlocked: () => boolean
  onShow: (show: CelebrationShow) => Promise<void> | void
  debounceMs?: number
  maxWaitMs?: number
}

export interface CelebrationQueue {
  push: (event: CelebrationEvent, opts?: { immediate?: boolean }) => void
  /** Gọi khi cổng chặn có thể vừa mở (tab hiện lại, bài hướng dẫn xong). */
  resume: () => void
  dispose: () => void
}

export const DEFAULT_DEBOUNCE_MS = 1800
export const DEFAULT_MAX_WAIT_MS = 5000

export function createCelebrationQueue({
  isBlocked,
  onShow,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  maxWaitMs = DEFAULT_MAX_WAIT_MS,
}: CelebrationQueueOptions): CelebrationQueue {
  /** Sự kiện chưa được gộp thành hộp. */
  let pending: CelebrationEvent[] = []
  /** Hộp đã gộp xong, chờ tới lượt hiện (hoặc chờ cổng mở). */
  let ready: CelebrationShow[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  let firstPendingAt = 0
  let showing = false
  let disposed = false

  const clearTimer = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  const pump = () => {
    if (disposed || showing || ready.length === 0 || isBlocked()) return
    const show = ready.shift()!
    showing = true
    const done = () => {
      showing = false
      pump()
    }
    try {
      Promise.resolve(onShow(show)).then(done, done)
    } catch {
      done()
    }
  }

  const flush = () => {
    clearTimer()
    if (pending.length === 0) return
    ready.push(...planBatch(pending))
    pending = []
    pump()
  }

  return {
    push(event, opts) {
      if (disposed) return
      if (pending.length === 0) firstPendingAt = Date.now()
      pending.push(event)
      if (opts?.immediate) {
        flush()
        return
      }
      clearTimer()
      const waited = Date.now() - firstPendingAt
      timer = setTimeout(flush, Math.max(0, Math.min(debounceMs, maxWaitMs - waited)))
    },
    resume() {
      pump()
    },
    dispose() {
      disposed = true
      clearTimer()
      pending = []
      ready = []
    },
  }
}
