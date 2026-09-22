import { useEffect, useState } from 'react'

/** Đếm từ 0 lên `to` trong `duration` ms, chỉ chạy khi `active` bật. */
export function useCountUp(to: number, active: boolean, duration = 1600) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!active) return
    // Người dùng tắt chuyển động: nhảy thẳng tới đích ở khung hình đầu tiên
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = reduced ? 1 : Math.min(1, (now - start) / duration)
      // easeOutExpo: chạy nhanh lúc đầu, chậm dần khi gần đích
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
      setValue(to * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, active, duration])

  return value
}
