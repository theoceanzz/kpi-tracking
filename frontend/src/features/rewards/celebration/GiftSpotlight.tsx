import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Award } from 'lucide-react'
import { useFormat } from '@/i18n/useFormat'
import { SPOTLIGHT_MS, spotlightObject, type CelebrationShow } from './celebrationPlan'
import LottieObject from './LottieObject'
import { useCountUp } from './useCountUp'

const FADE_OUT_MS = 320

interface Props {
  show: CelebrationShow
  /** Bản nhẹ: chỉ mờ vào/ra, tia sáng đứng yên, vật thể ở khung cuối, số hiện ngay. */
  reduced: boolean
  /** Gọi đúng một lần khi lớp phủ đã biến mất; `skipped` = người dùng bấm / Esc để bỏ qua. */
  onDone: (skipped: boolean) => void
}

/**
 * Khoảnh khắc "tặng quà to" kiểu TikTok — thưởng điểm cấp lớn (≥ 500) và lớn nhất (kèm giấy khen):
 * lớp tối + tia sáng xoay sau lưng, vật thể Lottie bật ra, số điểm chạy lên, tên người thưởng + lý do.
 *
 * - Tối đa {@link SPOTLIGHT_MS}; bấm BẤT KỲ ĐÂU hoặc Esc để bỏ qua ngay.
 * - Pháo hoa / mưa xu do host bắn trên canvas riêng (z 1200, nằm TRÊN lớp này, không chặn bấm).
 * - Lớp này z 1150: trên Dialog (1000) / dropdown (1100), dưới bài hướng dẫn (1400) — host không diễn khi
 *   đang có bài hướng dẫn.
 */
export default function GiftSpotlight({ show, reduced, onDone }: Props) {
  const { t } = useTranslation('rewards')
  const fmt = useFormat()
  const [leaving, setLeaving] = useState(false)
  const doneRef = useRef(false)
  const points = useCountUp(show.totalPoints, 1800, !reduced)

  // Đọc qua ref: nơi dùng truyền hàm mới mỗi lần vẽ — để trong deps thì đồng hồ 3 giây bị đặt lại mãi.
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  })

  const finish = useCallback((skipped: boolean) => {
    if (doneRef.current) return
    doneRef.current = true
    setLeaving(true)
    setTimeout(() => onDoneRef.current(skipped), FADE_OUT_MS)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => finish(false), SPOTLIGHT_MS - FADE_OUT_MS)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(true)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
    }
  }, [finish])

  const single = show.events.length === 1 ? show.events[0]! : null
  const grantors = [...new Set(show.events.map((e) => e.grantorName).filter(Boolean))]
  const headline = single
    ? (single.grantorName ? t('Celebration.sentYou', { name: single.grantorName }) : t('Celebration.youHaveBeenRewarded'))
    : t('Celebration.youReceivedRewards', { count: show.events.length })

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      onClick={() => finish(true)}
      className={`celebration-spotlight ${reduced ? 'is-reduced' : ''} ${leaving ? 'is-leaving' : ''}`}
    >
      <div className="celebration-spotlight-rays" aria-hidden="true" />
      <div className="celebration-spotlight-body">
        <LottieObject name={spotlightObject(show)} size={240} still={reduced} />

        <p className="celebration-spotlight-headline">{headline}</p>
        <p className="celebration-spotlight-points">
          +{fmt.number(points)}
          <span>{t('Celebration.pointsUnit')}</span>
        </p>

        {single?.reason && <p className="celebration-spotlight-reason">“{single.reason}”</p>}
        {!single && grantors.length > 0 && (
          <p className="celebration-spotlight-reason">{t('Celebration.fromMany', { names: grantors.slice(0, 3).join(', ') })}</p>
        )}
        {show.certificates.length > 0 && (
          <span className="celebration-spotlight-badge">
            <Award size={14} aria-hidden="true" />
            {t('Celebration.withCertificate')}
          </span>
        )}
      </div>
      <p className="celebration-spotlight-hint">{t('Celebration.tapToSkip')}</p>
    </div>,
    document.body
  )
}
