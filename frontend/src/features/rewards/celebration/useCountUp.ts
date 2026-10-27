import { useEffect, useState } from 'react'

/**
 * Đếm từ 0 lên `to` trong `durationMs` (easeOutExpo). `animate = false` (bản nhẹ khi máy giảm chuyển động)
 * thì hiện số cuối ngay.
 */
export function useCountUp(to: number, durationMs = 1400, animate = true) {
  const [value, setValue] = useState(animate ? 0 : to)

  useEffect(() => {
    if (!animate) return
    let raf = 0
    let start = 0
    const tick = (now: number) => {
      if (!start) start = now
      const t = Math.min(1, (now - start) / durationMs)
      setValue(t === 1 ? to : to * (1 - Math.pow(2, -10 * t)))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, durationMs, animate])

  return animate ? Math.round(value) : to
}
