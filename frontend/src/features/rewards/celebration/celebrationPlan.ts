import type { CheckinStatus, RewardGrant } from '../types'
import type { CelebrationObject } from './LottieObject'

/**
 * Logic thuần của tính năng "ăn mừng": chọn cấp hiệu ứng và gộp một loạt sự kiện thành những
 * lần hiển thị. Không chạm DOM, không phát tiếng — để test được và để mọi nơi gọi chung một luật.
 *
 * Bảng cấp (xem CLAUDE.md / thiết kế 2026-10-19):
 * - Điểm danh thường → nhỏ; chạm mốc thưởng chuỗi hoặc chuỗi tròn 7/30/100 ngày → vừa.
 * - Đổi quà xong ngay (DELIVERED / có mã / APPROVED) → vừa.
 * - Được thưởng điểm (theo SỐ ĐIỂM, nhóm gộp thì theo TỔNG):
 *     < {@link POINTS_OBJECT_MIN} → nhỏ (chỉ banner kiểu TikTok);
 *     {@link POINTS_OBJECT_MIN}–{@link POINTS_FULLSCREEN_MIN} − 1 → vừa (banner + vật thể nhỏ);
 *     ≥ {@link POINTS_FULLSCREEN_MIN} → lớn (cả màn hình).
 * - Kèm giấy khen → LUÔN lớn nhất (cả màn hình + giấy khen), bất kể số điểm.
 * Điểm danh tối đa cấp vừa. Ngưỡng là hằng số — chưa cấu hình theo tổ chức.
 * Không có cấp nào cho điểm bị trừ / thu hồi: nơi gọi không bao giờ gửi những sự kiện đó vào.
 */

export type CelebrationKind = 'CHECKIN' | 'POINTS' | 'GIFT'

export type CelebrationLevel = 'small' | 'medium' | 'large' | 'grand'

export interface CelebrationEvent {
  kind: CelebrationKind
  points: number
  /** Tiêu đề hiển thị sẵn (vd. tên quà); bỏ trống thì hộp tự dựng theo loại. */
  title?: string
  /** Dòng mô tả dưới tiêu đề (toast đổi quà giữ đúng câu của toast cũ). */
  description?: string
  grantorName?: string | null
  reason?: string | null
  /**
   * Lượt thưởng có giấy khen thì truyền chính đề nghị thưởng để vẽ giấy khen (`CertificateCanvas`
   * cần mẫu + người nhận + lý do). Null/undefined = không có giấy khen.
   */
  certificate?: RewardGrant | null
  /** Id nguồn (đề nghị thưởng, lần chạy chương trình, đơn đổi quà) — dùng để ack ở giai đoạn 2. */
  refId?: string
  /** Điểm danh: chuỗi ĐÃ đạt sau lần bấm này. */
  streakLength?: number
  /** Điểm danh: điểm thưởng mốc chuỗi rơi vào lần bấm này (0 = không chạm mốc). */
  bonusPoints?: number
  /** Đổi quà: đã có hộp mã quà (`VoucherModal`) tự hiện — host chỉ bắn confetti + tiếng, không toast. */
  hasVoucher?: boolean
  /** Phần tử để "+N" bay ra (nút điểm danh). Không có thì bay từ giữa màn hình. */
  origin?: HTMLElement | null
}

/** Thưởng điểm từ mức này trở lên thì có vật thể (banner + vật thể nhỏ). */
export const POINTS_OBJECT_MIN = 50
/** Thưởng điểm từ mức này trở lên thì hiệu ứng cả màn hình. */
export const POINTS_FULLSCREEN_MIN = 500

/** Chuỗi tròn được ăn mừng to dù tổ chức không cấu hình mốc thưởng ở ngày đó. */
export const STREAK_MILESTONES = [7, 30, 100] as const

export const isStreakMilestone = (streakLength?: number) =>
  streakLength != null && (STREAK_MILESTONES as readonly number[]).includes(streakLength)

/**
 * Điểm thưởng mốc chuỗi rơi vào lần điểm danh VỪA xong.
 *
 * Ưu tiên con số máy chủ báo TRƯỚC lần bấm (`nextBonusPoints` của trạng thái cũ — đúng nghĩa "lần
 * bấm này chạm mốc"). Không có trạng thái cũ (cache trống) thì suy từ trạng thái mới: hôm nay đã
 * điểm danh và có mốc đúng bằng vị trí trong chu kỳ.
 */
export function checkinBonusPoints(prev: CheckinStatus | undefined, next: CheckinStatus): number {
  if (prev && prev.canCheckin) return prev.nextBonusPoints ?? 0
  if (!next.checkedInToday) return 0
  return next.streakBonuses.find((b) => b.day === next.streakDay)?.points ?? 0
}

/** Cấp hiệu ứng của MỘT sự kiện. Nơi gọi không tự chọn cấp — luôn đi qua đây. */
export function levelOf(event: CelebrationEvent): CelebrationLevel {
  switch (event.kind) {
    case 'CHECKIN':
      return (event.bonusPoints ?? 0) > 0 || isStreakMilestone(event.streakLength) ? 'medium' : 'small'
    case 'GIFT':
      return 'medium'
    case 'POINTS':
      return pointsLevel(event.points, !!event.certificate)
  }
}

/** Cấp của thưởng điểm theo số điểm (lượt lẻ hoặc TỔNG của nhóm gộp). */
export function pointsLevel(points: number, hasCertificate: boolean): CelebrationLevel {
  if (hasCertificate) return 'grand'
  if (points >= POINTS_FULLSCREEN_MIN) return 'large'
  if (points >= POINTS_OBJECT_MIN) return 'medium'
  return 'small'
}

/** Một lần hiển thị: một sự kiện lẻ, hoặc nhiều lượt thưởng điểm gộp lại thành một hộp. */
export interface CelebrationShow {
  kind: CelebrationKind
  level: CelebrationLevel
  /** Các sự kiện gốc theo thứ tự đến. Lượt thưởng gộp có nhiều phần tử; còn lại đúng một. */
  events: CelebrationEvent[]
  totalPoints: number
  /** Các lượt có giấy khen trong nhóm — gộp nhóm KHÔNG được làm mất giấy khen. */
  certificates: CelebrationEvent[]
}

/**
 * Gộp một loạt sự kiện đến trong cùng một cửa sổ chờ.
 *
 * - Mọi lượt THƯỞNG ĐIỂM gộp thành một hộp duy nhất ("Bạn nhận 3 phần thưởng, tổng +120 điểm" — banner
 *   hiện combo "x3"), đứng ở vị trí của lượt đầu tiên; cấp tính theo TỔNG điểm của nhóm (ba lượt 20 điểm =
 *   60 ⇒ vừa), và có một giấy khen là cả nhóm lên "lớn nhất" — giấy khen vẫn được hiện.
 * - Điểm danh và đổi quà là việc người dùng vừa tự bấm: giữ riêng từng cái, đúng thứ tự.
 */
export function planBatch(events: CelebrationEvent[]): CelebrationShow[] {
  const shows: CelebrationShow[] = []
  let pointsShow: CelebrationShow | null = null

  for (const event of events) {
    const level = levelOf(event)
    if (event.kind === 'POINTS') {
      if (!pointsShow) {
        pointsShow = { kind: 'POINTS', level, events: [], totalPoints: 0, certificates: [] }
        shows.push(pointsShow)
      }
      pointsShow.events.push(event)
      pointsShow.totalPoints += event.points
      if (event.certificate) pointsShow.certificates.push(event)
      pointsShow.level = pointsLevel(pointsShow.totalPoints, pointsShow.certificates.length > 0)
      continue
    }
    shows.push({
      kind: event.kind,
      level,
      events: [event],
      totalPoints: event.points,
      certificates: [],
    })
  }
  return shows
}

/** Tổng thời lượng tối đa của lớp cả màn hình kiểu TikTok (gồm lúc mờ ra). Bấm bất kỳ đâu để bỏ qua sớm. */
export const SPOTLIGHT_MS = 5000

/** Vật thể của lớp cả màn hình: giấy khen → huy chương; nhiều lượt gộp → rương xu; một lượt lớn → cúp. */
export function spotlightObject(show: CelebrationShow): CelebrationObject {
  if (show.level === 'grand') return 'medal'
  return show.events.length > 1 ? 'chest' : 'trophy'
}
