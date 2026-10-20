import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Coins } from 'lucide-react'
import { useFormat } from '@/i18n/useFormat'
import type { CelebrationShow } from './celebrationPlan'
import LottieObject from './LottieObject'

/** Banner ở lại bao lâu (gồm lúc trượt vào / ra). */
const BANNER_MS = 4200
const LEAVE_MS = 350

interface Props {
  show: CelebrationShow
  /** Cấp vừa (50–499 điểm): có vật thể nhỏ (hộp quà Lottie) đè lên mép phải. */
  withObject: boolean
  reduced: boolean
  /** Lệch xuống bao nhiêu px khi nhiều banner xếp chồng. */
  offsetY?: number
  onClose: () => void
}

/**
 * Banner tặng quà kiểu TikTok cho thưởng điểm cấp nhỏ (< 50: chỉ banner) và vừa (50–499: banner + vật thể).
 * Trượt vào từ mép trái dưới header; nhiều lượt gộp hiện combo "x3" với TỔNG điểm. Bấm vào để đóng sớm.
 * Bản nhẹ (máy giảm chuyển động): chỉ mờ vào/ra, vật thể đứng ở khung cuối.
 */
export default function GiftBanner({ show, withObject, reduced, offsetY = 0, onClose }: Props) {
  const { t } = useTranslation('rewards')
  const fmt = useFormat()
  const [leaving, setLeaving] = useState(false)
  // Đọc qua ref: nơi dùng truyền hàm mới mỗi lần vẽ, để trong deps thì đồng hồ bị đặt lại mãi, banner không tắt.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const leave = setTimeout(() => setLeaving(true), BANNER_MS - LEAVE_MS)
    const close = setTimeout(() => onCloseRef.current(), BANNER_MS)
    return () => {
      clearTimeout(leave)
      clearTimeout(close)
    }
  }, [])

  const count = show.events.length
  const grantors = [...new Set(show.events.map((e) => e.grantorName).filter(Boolean))] as string[]
  const name = grantors.length === 1 ? grantors[0]! : count > 1 ? t('Celebration.manyPeople') : (grantors[0] ?? t('Celebration.reward'))
  const reason = count === 1 ? show.events[0]!.reason : null

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={() => onCloseRef.current()}
      className={`celebration-banner ${reduced ? 'is-reduced' : ''} ${leaving ? 'is-leaving' : ''}`}
      style={{ marginTop: offsetY }}
    >
      <div className="celebration-banner-avatar" aria-hidden="true">
        {name.trim().charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold leading-tight">{name}</p>
        <p className="truncate text-xs leading-tight text-white/90">
          {t('Celebration.bannerSent', { points: fmt.number(show.totalPoints) })}
        </p>
        {reason && <p className="truncate text-[11px] italic leading-tight text-white/75">“{reason}”</p>}
      </div>
      <div className="celebration-banner-object" aria-hidden="true">
        {withObject ? (
          <LottieObject name="gift" size={76} still={reduced} />
        ) : (
          <Coins size={28} className="text-[#FFD95E]" />
        )}
      </div>
      {count > 1 && (
        <span key={count} className="celebration-banner-combo" aria-label={t('Celebration.comboLabel', { count })}>
          x{count}
        </span>
      )}
    </div>
  )
}
