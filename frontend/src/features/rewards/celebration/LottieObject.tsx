import { useEffect, useRef } from 'react'
import type { AnimationItem } from 'lottie-web'

/** Vật thể chính của hiệu ứng — mỗi tên là một file trong `public/celebrations/lottie/` (xem LICENSES.md ở đó). */
export type CelebrationObject = 'trophy' | 'gift' | 'chest' | 'medal'

type LottiePlayer = typeof import('lottie-web/build/player/lottie_light').default

let player: Promise<LottiePlayer> | null = null

/**
 * Nạp `lottie_light` (chỉ SVG renderer, KHÔNG có expression ⇒ không cần `eval`, hợp CSP `script-src 'self'`)
 * bằng import động ở lần ăn mừng đầu tiên — không nằm trong bundle chính. Hỏng mạng thì lần sau thử lại.
 */
function loadPlayer(): Promise<LottiePlayer> {
  player ??= import('lottie-web/build/player/lottie_light')
    .then((m) => m.default)
    .catch((e) => {
      player = null
      throw e
    })
  return player
}

/**
 * Cách hiển thị riêng của từng file (không sửa file gốc — xem public/celebrations/LICENSES.md):
 * - `scale`: thu nhỏ trong khung khi file vẽ kín mép (rương dDara đè lên dòng chữ bên dưới nếu để 100%).
 * - `endAt`: bản đầy đủ chạy từ đầu tới tỉ lệ này (0..1) rồi ĐỨNG YÊN — rương dDara mở ra rồi tự đóng lại,
 *   nên chỉ chạy tới khung đang mở.
 * - `stillAt`: bản nhẹ (mức "Nhẹ") đứng yên ở khung này.
 */
const SPEC: Record<CelebrationObject, { scale: number; endAt: number; stillAt: number }> = {
  trophy: { scale: 1, endAt: 1, stillAt: 1 },
  gift: { scale: 1, endAt: 1, stillAt: 1 },
  // Khung 49/89: nắp mở hẳn, thấy rõ xu và kim cương (từ ~85% rương đóng lại).
  chest: { scale: 0.75, endAt: 0.55, stillAt: 0.55 },
  // Huy chương nảy to ở ~85% rồi thu nhỏ, biến mất ở cuối (~5s) — lớp phủ dài 5 giây nên dừng ở khung 119/149 (4,0s).
  medal: { scale: 1, endAt: 0.8, stillAt: 0.5 },
}

const frameAt = (anim: AnimationItem, frac: number) => Math.max(0, Math.round((anim.totalFrames - 1) * frac))

/** File tự host, không tải từ CDN LottieFiles. */
const fileOf = (name: CelebrationObject) => `${import.meta.env.BASE_URL}celebrations/lottie/${name}.json`

interface Props {
  name: CelebrationObject
  size: number
  /** Bản nhẹ (mức "Nhẹ"): đứng yên ở một khung đẹp (`SPEC.stillAt`), không chạy. */
  still?: boolean
  className?: string
}

/** Một vật thể Lottie chạy MỘT lần (không lặp). Nạp hỏng thì để trống — hiệu ứng khác vẫn chạy. */
export default function LottieObject({ name, size, still = false, className }: Props) {
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let item: AnimationItem | null = null
    let cancelled = false
    loadPlayer()
      .then((lottie) => {
        if (cancelled || !box.current) return
        const spec = SPEC[name]
        const anim = lottie.loadAnimation({
          container: box.current,
          renderer: 'svg',
          loop: false,
          autoplay: false,
          path: fileOf(name),
          rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
        })
        item = anim
        anim.addEventListener('DOMLoaded', () => {
          if (still) anim.goToAndStop(frameAt(anim, spec.stillAt), true)
          else if (spec.endAt < 1) anim.playSegments([0, frameAt(anim, spec.endAt)], true)
          else anim.play()
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
      item?.destroy()
    }
  }, [name, still])

  const inner = Math.round(size * SPEC[name].scale)
  return (
    <div aria-hidden="true" className={className} style={{ width: size, height: size, display: 'grid', placeItems: 'center' }}>
      <div ref={box} style={{ width: inner, height: inner }} />
    </div>
  )
}
