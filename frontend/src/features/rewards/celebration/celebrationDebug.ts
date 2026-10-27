import { useAuthStore } from '@/store/authStore'
import { RewardApprovalMode, RewardGrantStatus, type RewardGrant } from '../types'
import { celebrate } from './celebrate'
import type { CelebrationEvent } from './celebrationPlan'

/**
 * CHỈ môi trường dev: xem thử từng cấp hiệu ứng mà không cần dữ liệu thật. Mở DevTools rồi gọi
 *
 *   __keygoCelebrate('small')     // điểm danh thường
 *   __keygoCelebrate('medium')    // điểm danh chạm mốc chuỗi (toast + rương)
 *   __keygoCelebrate('gift')      // đổi quà xong ngay (toast + hộp quà)
 *   __keygoCelebrate('banner')    // thưởng 20 điểm: chỉ banner
 *   __keygoCelebrate('object')    // thưởng 120 điểm: banner + hộp quà nhỏ
 *   __keygoCelebrate('combo')     // 3 lượt × 20 điểm về cùng lúc: banner "x3", tổng 60 ⇒ cấp vừa
 *   __keygoCelebrate('large')     // thưởng 1.000 điểm: cả màn hình (cúp)
 *   __keygoCelebrate('chest')     // 3 lượt × 300 điểm: cả màn hình (rương)
 *   __keygoCelebrate('grand')     // thưởng kèm giấy khen: cả màn hình (huy chương) rồi hộp giấy khen
 *   __keygoCelebrate('batch')     // 3 lượt, một có giấy khen ⇒ gộp, lên cấp giấy khen
 *
 * Đi qua đúng `celebrate()` nên công tắc, tab ẩn, bài hướng dẫn đều áp dụng.
 * Không gọi API, không đổi dữ liệu. Chữ mẫu cố ý không dịch (chỉ dev nhìn thấy).
 */
export type DebugCelebration = 'small' | 'medium' | 'gift' | 'banner' | 'object' | 'combo' | 'large' | 'chest' | 'grand' | 'batch'

function fakeGrant(points: number, reason: string): RewardGrant {
  const user = useAuthStore.getState().user
  return {
    id: `debug-${Math.random().toString(36).slice(2)}`,
    grantorUserId: 'debug-grantor',
    grantorName: 'Demo Manager',
    totalPoints: points,
    reason,
    status: RewardGrantStatus.APPROVED,
    approvalMode: RewardApprovalMode.AUTO,
    certificateEnabled: true,
    certificateTemplateId: null,
    orgUnitName: 'KeyPerson',
    recipients: [
      {
        userId: user?.id ?? 'debug-user',
        fullName: user?.fullName ?? 'Demo Employee',
        email: user?.email ?? '',
        points,
      },
    ],
    createdAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
  }
}

const checkinButton = () => document.querySelector<HTMLElement>('[data-celebrate="checkin-button"]')

const SAMPLES: Record<DebugCelebration, () => CelebrationEvent[]> = {
  small: () => [{ kind: 'CHECKIN', points: 5, streakLength: 3, bonusPoints: 0, origin: checkinButton() }],
  medium: () => [{ kind: 'CHECKIN', points: 55, streakLength: 30, bonusPoints: 50, origin: checkinButton() }],
  gift: () => [{ kind: 'GIFT', points: 200, title: 'Redeemed: Demo gift', description: '-200 points (demo)' }],
  banner: () => [{ kind: 'POINTS', points: 20, grantorName: 'Demo Manager', reason: 'Quick thanks (demo)' }],
  object: () => [{ kind: 'POINTS', points: 120, grantorName: 'Demo Manager', reason: 'Great teamwork (demo)' }],
  combo: () => [1, 2, 3].map((i) => ({ kind: 'POINTS' as const, points: 20, grantorName: 'Demo Manager', reason: `Bonus ${i} (demo)`, refId: `debug-c${i}` })),
  large: () => [{ kind: 'POINTS', points: 1000, grantorName: 'Demo Manager', reason: 'Q3 project delivered (demo)' }],
  chest: () => [1, 2, 3].map((i) => ({ kind: 'POINTS' as const, points: 300, grantorName: i === 3 ? 'Program: Top KPI (demo)' : 'Demo Manager', reason: `Big bonus ${i} (demo)`, refId: `debug-h${i}` })),
  grand: () => {
    const grant = fakeGrant(500, 'Employee of the month (demo)')
    return [{ kind: 'POINTS', points: 500, grantorName: grant.grantorName, reason: grant.reason, certificate: grant, refId: grant.id }]
  },
  batch: () => {
    const grant = fakeGrant(100, 'Monthly bonus (demo)')
    return [
      { kind: 'POINTS', points: 10, grantorName: 'Demo Manager', reason: 'Monthly bonus Aug (demo)', refId: 'debug-1' },
      { kind: 'POINTS', points: 100, grantorName: grant.grantorName, reason: grant.reason, certificate: grant, refId: grant.id },
      { kind: 'POINTS', points: 10, grantorName: 'Program: Top KPI (demo)', reason: 'Rank #1, Sep period (demo)', refId: 'debug-3' },
    ]
  },
}

export function registerCelebrationDebug() {
  const w = window as unknown as { __keygoCelebrate?: (which: DebugCelebration) => void }
  w.__keygoCelebrate = (which) => {
    const events = SAMPLES[which]?.()
    if (!events) {
      console.warn('[celebration] Dùng một trong:', Object.keys(SAMPLES).join(', '))
      return
    }
    for (const event of events) {
      if (celebrate(event) === null) {
        console.warn('[celebration] Không chạy: công tắc "Hiệu ứng & âm thanh chúc mừng" đang tắt.')
        return
      }
    }
  }
  return () => {
    delete w.__keygoCelebrate
  }
}
