import { useEffect, useState } from 'react'

/** Thời điểm hiện tại (ms), tự cập nhật theo chu kỳ — cho nhãn đếm ngược "còn 2 giờ". */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const h = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(h)
  }, [intervalMs])
  return now
}
