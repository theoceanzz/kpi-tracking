import { formatNumber } from '@/i18n/format'
import { RedemptionStatus, type RewardCelebration } from '../types'
import type { CelebrationEvent, CelebrationLevel } from './celebrationPlan'

/**
 * Đồng bộ lượt ăn mừng với máy chủ (giai đoạn 2): máy chủ là nguồn sự thật, WebSocket
 * (`/user/queue/celebrations`) chỉ là cú hích. Mỗi lần đồng bộ:
 *
 *   giữ Web Lock → GET /rewards/me/celebrations → celebrate() từng lượt → POST ack → nhả lock
 *
 * ACK PHẢI XONG BÊN TRONG LOCK rồi mới nhả: tab khác chờ lock, tới lượt nó GET thì máy chủ đã đánh dấu
 * xong nên không có lượt nào bị bắn hai lần. Chỉ tab ĐANG HIỆN mới đồng bộ — tab ẩn chỉ ghi nhớ "có việc"
 * và đồng bộ khi người dùng quay lại, nên hiệu ứng luôn nổ ở tab người dùng đang nhìn. Ack ngay khi đã xếp
 * vào hàng (tab đang hiện ⇒ hộp chúc mừng sẽ hiện), không đợi hộp đóng: đợi thì phải giữ lock suốt lúc
 * người dùng xem pháo.
 *
 * Người dùng TẮT hiệu ứng ở máy này: không lấy, không ack — để lượt đó còn được ăn mừng ở máy khác (hoặc
 * khi họ bật lại, trong cửa sổ 30 ngày của máy chủ).
 */
export interface CelebrationSyncDeps {
  fetchMine: () => Promise<RewardCelebration[]>
  ack: (refIds: string[]) => Promise<unknown>
  celebrate: (event: CelebrationEvent) => CelebrationLevel | null
  toEvent: (item: RewardCelebration) => CelebrationEvent
  isEnabled: () => boolean
  isVisible: () => boolean
  withLock: (run: () => Promise<void>) => Promise<void>
}

export interface CelebrationSync {
  /** Đồng bộ ngay (mở app, nhận tín hiệu). Đang chạy thì hẹn thêm đúng MỘT lượt sau đó. */
  sync: () => Promise<void>
  /** Gọi khi tab hiện lại: chỉ đồng bộ nếu có tín hiệu đến lúc tab đang ẩn. */
  onVisible: () => void
}

export const CELEBRATION_LOCK = 'kg-reward-celebrations'

/** Web Lock dùng chung giữa các tab; trình duyệt không hỗ trợ thì chạy thẳng (một tab vẫn đúng). */
export function withCelebrationLock(run: () => Promise<void>): Promise<void> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks?.request) return run()
  return locks.request(CELEBRATION_LOCK, run)
}

export function createCelebrationSync(deps: CelebrationSyncDeps): CelebrationSync {
  let pendingWhileHidden = false
  let running: Promise<void> | null = null
  let again = false

  const runOnce = () =>
    deps.withLock(async () => {
      const items = await deps.fetchMine()
      // Chỉ ack lượt THẬT SỰ đã vào hàng hiệu ứng (null = công tắc vừa bị tắt / chưa có host).
      const queued = items.filter((item) => deps.celebrate(deps.toEvent(item)) !== null).map((i) => i.refId)
      if (queued.length) await deps.ack(queued)
    })

  const sync = (): Promise<void> => {
    if (!deps.isEnabled()) return Promise.resolve()
    if (!deps.isVisible()) {
      pendingWhileHidden = true
      return Promise.resolve()
    }
    pendingWhileHidden = false
    if (running) {
      // Nhiều tín hiệu dồn dập (phát thưởng hàng loạt): gộp thành một lượt chạy thêm.
      again = true
      return running
    }
    running = runOnce()
      .catch(() => {
        // Lỗi mạng / máy chủ: im lặng — lượt chưa ack vẫn nằm đó, lần sau lấy lại.
      })
      .finally(() => {
        running = null
        if (again) {
          again = false
          void sync()
        }
      })
    return running
  }

  return {
    sync,
    onVisible: () => {
      if (pendingWhileHidden) void sync()
    },
  }
}

type Translate = (key: string, options?: Record<string, unknown>) => string

/**
 * Lượt từ máy chủ → sự kiện ăn mừng. Thưởng tay và chương trình tự động đều là "được thưởng điểm" (gộp
 * chung một hộp); đổi quà được người khác duyệt / giao là cấp "vừa" như đổi quà xong ngay.
 */
export function toCelebrationEvent(item: RewardCelebration, t: Translate): CelebrationEvent {
  switch (item.source) {
    case 'GRANT':
      return {
        kind: 'POINTS',
        points: item.points,
        grantorName: item.grantorName,
        reason: item.reason,
        certificate: item.certificate ? (item.grant ?? null) : null,
        refId: item.refId,
      }
    case 'PROGRAM_RUN':
      return {
        kind: 'POINTS',
        points: item.points,
        grantorName: item.programName,
        reason: item.rank != null ? t('Celebration.programRank', { rank: item.rank }) : null,
        refId: item.refId,
      }
    case 'REDEMPTION': {
      const gift = item.giftName ?? ''
      return {
        kind: 'GIFT',
        points: item.points,
        title: item.redemptionStatus === RedemptionStatus.DELIVERED
          ? t('Celebration.giftDelivered', { gift })
          : t('Celebration.giftApproved', { gift }),
        description: t('Celebration.giftPoints', { points: formatNumber(item.points) }),
        refId: item.refId,
      }
    }
  }
}
