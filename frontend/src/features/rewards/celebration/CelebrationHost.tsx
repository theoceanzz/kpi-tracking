import { createElement, useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useApiAllowed } from '@/hooks/useApiAllowed'
import { subscribeTopic } from '@/lib/realtime'
import { isTourRunning, useTourStore } from '@/store/tourStore'
import { formatNumber } from '@/i18n/format'
import { playCue } from '@/features/notifications/notificationAlert'
import CertificateModal from '../components/certificate/CertificateModal'
import type { RewardGrant } from '../types'
import { celebrationApi } from '../api/celebrationApi'
import { celebrate, registerCelebrationQueue } from './celebrate'
import { createCelebrationSync, toCelebrationEvent, withCelebrationLock } from './celebrationSync'
import { createCelebrationQueue } from './celebrationQueue'
import type { CelebrationShow } from './celebrationPlan'
import { applyModeAttribute, isCelebrationEnabled, isGentleMode } from './celebrationSettings'
import { burstAt, burstCorners, burstFrom, coinRain, fireworks, resetConfetti } from './confettiEffects'
import { FLAME_MARKER, flyPoints, replayClass } from './pointsFly'
import CelebrationDialog from './CelebrationDialog'
import CelebrationToast from './CelebrationToast'
import GiftBanner from './GiftBanner'
import GiftSpotlight from './GiftSpotlight'
import './celebration.css'

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Toast chúc mừng giữ lâu hơn toast thường (4s): người dùng đang xem pháo. */
const TOAST_MS = 6000
/** Banner sống lâu hơn thế này; hàng đợi chỉ chờ nhịp này rồi cho hộp kế tiếp chạy (banner xếp chồng). */
const BANNER_GAP_MS = 1200
/** Khoảng cách dọc giữa hai banner xếp chồng. */
const BANNER_STACK_PX = 64

interface BannerItem {
  id: number
  show: CelebrationShow
  withObject: boolean
  reduced: boolean
}

/**
 * Bộ chạy hiệu ứng ăn mừng — gắn MỘT lần trong AppLayout; mọi nơi khác chỉ gọi `celebrate()`.
 *
 * Hàng đợi ({@link createCelebrationQueue}) lo gộp / chờ / lần lượt; host chỉ biết cách DIỄN một hộp:
 * - Điểm danh nhỏ: nút nảy, lửa lắc, chùm confetti tại nút, "+N" bay, tiếng ting. Điểm danh vừa: thêm confetti
 *   hai góc, kèn ngắn, toast có rương Lottie (thay toast cũ).
 * - Đổi quà: confetti hai góc, kèn, toast có hộp quà Lottie (quà có mã: hộp mã quà tự hiện hộp quà).
 * - Thưởng điểm kiểu TikTok: nhỏ (< 50) chỉ banner; vừa (50–499) banner + hộp quà nhỏ; lớn (≥ 500) lớp cả
 *   màn hình ≤ 5 giây (cúp, hoặc rương nếu gộp nhiều lượt) + pháo hoa + mưa xu; lớn nhất (giấy khen) lớp cả
 *   màn hình với huy chương rồi tới hộp giấy khen. Bấm bất kỳ đâu để bỏ qua lớp cả màn hình.
 * Cổng chặn: tab đang ẩn hoặc bài hướng dẫn đang chạy ⇒ giữ lại, diễn khi người dùng quay lại.
 *
 * Mức hiệu ứng do người dùng chọn trong hộp chuông (Đầy đủ — mặc định / Nhẹ / Tắt, xem `celebrationSettings.ts`),
 * KHÔNG theo cài đặt giảm chuyển động của hệ điều hành. Nhẹ ⇒ giữ lớp phủ / vật thể / banner / toast / tiếng nhưng
 * chỉ mờ vào–ra, không pháo, confetti, mưa xu, "+N" bay.
 */
export default function CelebrationHost() {
  const { t } = useTranslation('rewards')
  const userId = useAuthStore((s) => s.user?.id)
  const [dialog, setDialog] = useState<{ show: CelebrationShow; done: () => void } | null>(null)
  const [spotlight, setSpotlight] = useState<{ show: CelebrationShow; reduced: boolean; done: () => void } | null>(null)
  const [banners, setBanners] = useState<BannerItem[]>([])
  const [certificateGrant, setCertificateGrant] = useState<RewardGrant | null>(null)
  const bannerSeq = useRef(0)

  // Hàm diễn đọc `t` mới nhất qua ref: hàng đợi tạo một lần, không tạo lại khi đổi ngôn ngữ.
  const tRef = useRef(t)
  useEffect(() => {
    tRef.current = t
  }, [t])

  useEffect(() => {
    // Gắn cờ mức hiệu ứng cho CSS ngay khi vào app (người dùng có thể đã chọn "Nhẹ" ở phiên trước).
    applyModeAttribute()
    const toastWith = (variant: 'streak' | 'gift', title: string, description?: string) =>
      toast.custom(
        (id) => createElement(CelebrationToast, { variant, title, description, onDismiss: () => toast.dismiss(id) }),
        { duration: TOAST_MS, closeButton: false }
      )

    const perform = (show: CelebrationShow): Promise<void> => {
      const tr = tRef.current
      const reduced = isGentleMode()
      const event = show.events[0]!

      if (show.kind === 'CHECKIN') {
        if (!reduced) {
          replayClass(event.origin, 'celebrate-pop')
          replayClass(document.querySelector(`[data-celebrate="${FLAME_MARKER}"]`), 'celebrate-wiggle')
          flyPoints(`+${formatNumber(event.points)}`, event.origin)
          void burstFrom(event.origin)
        }
        if (show.level === 'small') {
          playCue('chime')
          return wait(1000)
        }
        playCue('fanfare')
        if (!reduced) void burstCorners()
        const days = event.streakLength ?? 0
        toastWith(
          'streak',
          (event.bonusPoints ?? 0) > 0
            ? tr('Celebration.streakBonus', { days, bonus: formatNumber(event.bonusPoints) })
            : tr('Celebration.streakMilestone', { days }),
          tr('useCheckin.checkedInSuccessfullyPoints', { todayPoints: event.points })
        )
        return wait(1600)
      }

      if (show.kind === 'GIFT') {
        playCue('fanfare')
        if (!reduced) void burstCorners()
        // Quà có mã: hộp mã quà (`VoucherModal`) tự hiện kèm hộp quà — ở đây chỉ pháo + kèn.
        if (!event.hasVoucher && event.title) toastWith('gift', event.title, event.description)
        return wait(1600)
      }

      // ── Thưởng điểm ──
      if (show.level === 'small' || show.level === 'medium') {
        const withObject = show.level === 'medium'
        setBanners((list) => [...list, { id: ++bannerSeq.current, show, withObject, reduced }])
        if (withObject) {
          playCue('fanfare')
          // Chùm confetti nhỏ bung cạnh banner (góc trên trái, dưới header).
          if (!reduced) void burstAt(0.2, 0.14)
        } else {
          playCue('chime')
        }
        return wait(BANNER_GAP_MS)
      }

      // Lớn / lớn nhất: lớp cả màn hình; giấy khen thì tiếp theo là hộp giấy khen. Hàng đợi chờ tới hết.
      return new Promise<void>((resolve) => {
        const afterSpotlight = () => {
          setSpotlight(null)
          if (show.level === 'grand') setDialog({ show, done: resolve })
          else resolve()
        }
        setSpotlight({ show, reduced, done: afterSpotlight })
        playCue('fanfareLong')
        setTimeout(() => playCue('fireworks'), 700)
        setTimeout(() => playCue('fireworks'), 2600)
        if (!reduced) {
          void fireworks(4000)
          void coinRain(3200)
        }
      })
    }

    const queue = createCelebrationQueue({
      isBlocked: () => document.visibilityState !== 'visible' || isTourRunning(),
      onShow: perform,
    })
    const unregister = registerCelebrationQueue(queue)
    const resume = () => queue.resume()
    document.addEventListener('visibilitychange', resume)
    const unsubscribeTour = useTourStore.subscribe((s) => {
      if (s.activeTour === null) resume()
    })
    // Công cụ xem thử chỉ có ở dev, nạp động để không lọt vào bundle production.
    let unregisterDebug: (() => void) | undefined
    let disposed = false
    if (import.meta.env.DEV) {
      void import('./celebrationDebug').then((m) => {
        if (!disposed) unregisterDebug = m.registerCelebrationDebug()
      })
    }

    return () => {
      disposed = true
      unregister()
      unregisterDebug?.()
      document.removeEventListener('visibilitychange', resume)
      unsubscribeTour()
      queue.dispose()
    }
  }, [])

  // Giai đoạn 2: lượt được thưởng / đổi quà do NGƯỜI KHÁC xử lý — lấy từ máy chủ lúc mở app, khi có tín
  // hiệu WebSocket, và khi tab hiện lại sau một tín hiệu lúc ẩn. Đặt SAU effect đăng ký hàng đợi để
  // celebrate() đã có chỗ nhận. Không có quyền xem điểm của mình thì không gọi (tránh 403).
  const canSync = useApiAllowed('GET', '/rewards/me/celebrations')
  useEffect(() => {
    if (!canSync || !userId) return
    const sync = createCelebrationSync({
      fetchMine: celebrationApi.getMine,
      ack: celebrationApi.ack,
      celebrate,
      toEvent: (item) => toCelebrationEvent(item, (key, options) => String(tRef.current(key, options))),
      isEnabled: isCelebrationEnabled,
      isVisible: () => document.visibilityState === 'visible',
      withLock: withCelebrationLock,
    })
    void sync.sync()
    const unsubscribe = subscribeTopic('/user/queue/celebrations', () => void sync.sync())
    const onVisibility = () => {
      if (document.visibilityState === 'visible') sync.onVisible()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [canSync, userId])

  const closeDialog = () => {
    void resetConfetti()
    dialog?.done()
    setDialog(null)
  }

  const removeBanner = useCallback((id: number) => setBanners((list) => list.filter((b) => b.id !== id)), [])

  return (
    <>
      {spotlight && (
        <GiftSpotlight
          show={spotlight.show}
          reduced={spotlight.reduced}
          onDone={(skipped) => {
            // Bỏ qua thì dọn luôn pháo đang bay; hết giờ tự nhiên thì để pháo rơi nốt.
            if (skipped) void resetConfetti()
            spotlight.done()
          }}
        />
      )}
      {/* Banner xếp chồng: cái mới nằm dưới cái cũ. */}
      {banners.map((b, i) => (
        <GiftBanner
          key={b.id}
          show={b.show}
          withObject={b.withObject}
          reduced={b.reduced}
          offsetY={i * BANNER_STACK_PX}
          onClose={() => removeBanner(b.id)}
        />
      ))}
      {dialog && (
        <CelebrationDialog
          show={dialog.show}
          onClose={closeDialog}
          onOpenCertificate={(grant) => {
            closeDialog()
            setCertificateGrant(grant)
          }}
        />
      )}
      <CertificateModal
        grant={certificateGrant}
        onClose={() => setCertificateGrant(null)}
        lockedRecipientId={userId}
      />
    </>
  )
}
