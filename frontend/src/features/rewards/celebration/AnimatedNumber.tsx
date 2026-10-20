import { useEffect, useState } from 'react'
import { isGentleMode } from './celebrationSettings'

interface AnimatedNumberProps {
  value: number
  format: (n: number) => string
  /** Chờ bao lâu trước khi bắt đầu chạy số khi giá trị TĂNG — để "+N" kịp bay tới. */
  delayMs?: number
  durationMs?: number
  className?: string
  /** Đánh dấu đích bay của "+N" (`data-celebrate-target`). */
  celebrateTarget?: string
}

/** Đang hiện số nào, đang chạy tới số nào, và chạy từ số nào (chốt lúc đích đổi). */
interface Run {
  shown: number
  from: number
  target: number
}

/**
 * Số chạy từ giá trị cũ lên giá trị mới khi tăng (số dư sau điểm danh / được thưởng).
 *
 * Thay cho việc hoãn làm mới dữ liệu: dữ liệu vẫn làm mới ngay như cũ, chỉ phần HIỂN THỊ đợi "+N"
 * bay tới rồi mới chạy. Giảm (đổi quà, bị thu hồi) thì nhảy thẳng — không "diễn" khi bị trừ điểm.
 * Lần hiện đầu tiên và bản nhẹ (người dùng chọn mức "Nhẹ"): hiện số thật ngay.
 */
export default function AnimatedNumber({
  value,
  format,
  delayMs = 650,
  durationMs = 700,
  className,
  celebrateTarget,
}: AnimatedNumberProps) {
  const [run, setRun] = useState<Run>({ shown: value, from: value, target: value })

  // Đích đổi: chỉnh state ngay trong lúc render (mẫu "adjusting state when a prop changes").
  // Đang chạy dở mà đích tăng tiếp thì chạy tiếp từ số đang hiện, không giật lùi.
  if (value !== run.target) {
    const jump = value < run.shown || isGentleMode()
    setRun(jump ? { shown: value, from: value, target: value } : { shown: run.shown, from: run.shown, target: value })
  }

  const { from, target } = run
  useEffect(() => {
    if (target <= from) return
    let raf = 0
    let start = 0
    const tick = (now: number) => {
      if (!start) start = now
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      const shown = Math.round(from + (target - from) * eased)
      setRun((r) => (r.target === target ? { ...r, shown } : r))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    const timer = setTimeout(() => {
      raf = requestAnimationFrame(tick)
    }, delayMs)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf)
    }
  }, [from, target, delayMs, durationMs])

  return (
    <span className={className} data-celebrate-target={celebrateTarget}>
      {format(run.shown)}
    </span>
  )
}
