import { useCallback, useEffect, useRef, useState } from 'react'
import type { StageEvent } from '../api/aiApi'

/** Thời gian tối thiểu một nhãn được hiện, tính bằng mili-giây. */
const MIN_VISIBLE_MS = 450
/** Nhịp đồng hồ đếm thời gian chờ. */
const TICK_MS = 1000

/** Kết quả tóm tắt của một lượt, để hiện "Đã suy nghĩ N giây" kèm các bước đã chạy. */
export interface TurnSummary {
  seconds: number
  steps: string[]
}

/**
 * Theo dõi một lượt hỏi: nhãn "trợ lý đang làm gì", đồng hồ chờ, và lịch sử các bước đã chạy.
 *
 * <p><b>Chống nhấp nháy.</b> Bốn năm công đoạn đầu lượt chạy xong trong vài trăm mili-giây, nên nếu
 * hiện thẳng thì chúng chớp qua thành một vệt mờ không đọc kịp — tệ hơn là không hiện gì, vì mắt
 * chỉ thấy chữ nhảy loạn. Mỗi nhãn được giữ ít nhất {@link MIN_VISIBLE_MS} rồi mới nhường chỗ.
 *
 * <p><b>Lịch sử ghi theo ĐÚNG thứ người dùng đã thấy</b> (cùng luật bỏ trùng liên tiếp với phần
 * hiển thị), để danh sách mở ra sau đó khớp với những gì vừa lướt qua trước mắt họ.
 *
 * <p>Toàn bộ trạng thái điều phối nằm trong `ref`, chỉ `label` và `elapsedSec` là state: chỗ gọi
 * truyền thẳng `push` vào handler của luồng SSE và giữ nguyên bản chụp đó suốt lượt. Nếu `push` đọc
 * state thì nó chụp giá trị của lần render đầu và mọi phép so thời gian đều sai — tức mất đúng cái
 * nó sinh ra để làm.
 *
 * <p>Dùng chung cho cả widget và trang trợ lý để hai nơi không lệch nhịp.
 */
export function useStageProgress() {
  const [label, setLabel] = useState<string | null>(null)
  /** Số giây đã chờ, cho dòng trạng thái. Chỉ chạy trong lúc lượt đang xử lý. */
  const [elapsedSec, setElapsedSec] = useState(0)

  /** Nhãn chờ tới lượt hiện. */
  const queue = useRef<string[]>([])
  /** Thời điểm nhãn đang hiện bắt đầu hiện; 0 = chưa hiện gì. */
  const shownAt = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Nhãn cuối đã nhận, kể cả khi còn nằm trong hàng đợi — dùng để bỏ trùng liên tiếp. */
  const lastSeen = useRef<string | null>(null)

  /** Mọi nhãn của lượt này, theo thứ tự. */
  const history = useRef<string[]>([])
  const startedAt = useRef(0)
  const clock = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const clearClock = () => {
    if (clock.current) clearInterval(clock.current)
    clock.current = null
  }

  const drain = useCallback(function run() {
    timer.current = null
    const next = queue.current.shift()
    if (next === undefined) return
    shownAt.current = Date.now()
    setLabel(next)
    // Luôn hẹn nhịp kế tiếp: nếu lúc đó hàng đợi rỗng thì lần chạy sau tự dọn timer rồi thoát.
    timer.current = setTimeout(run, MIN_VISIBLE_MS)
  }, [])

  /** Mở một lượt mới: đặt mốc thời gian, chạy đồng hồ, xoá dấu vết lượt trước. */
  const begin = useCallback(() => {
    clearTimer()
    clearClock()
    queue.current = []
    history.current = []
    lastSeen.current = null
    shownAt.current = 0
    startedAt.current = Date.now()
    setLabel(null)
    setElapsedSec(0)
    clock.current = setInterval(
      () => setElapsedSec(Math.floor((Date.now() - startedAt.current) / 1000)),
      TICK_MS,
    )
  }, [])

  /** Nhận một sự kiện công đoạn từ luồng SSE. */
  const push = useCallback((stage: StageEvent) => {
    // Nhiều tool cùng loại chạy liên tiếp (ba lần suggest_*_form chẳng hạn) — hiện lại y hệt chỉ
    // làm người đọc tưởng bị treo.
    if (stage.label === lastSeen.current) return
    lastSeen.current = stage.label
    history.current.push(stage.label)
    queue.current.push(stage.label)

    if (timer.current) return // đang trong nhịp chờ; drain sẽ lấy nhãn này khi tới lượt
    const waited = Date.now() - shownAt.current
    if (shownAt.current === 0 || waited >= MIN_VISIBLE_MS) drain()
    else timer.current = setTimeout(drain, MIN_VISIBLE_MS - waited)
  }, [drain])

  /**
   * Đóng lượt: dừng đồng hồ, bỏ hết nhãn còn tồn (để chúng không hiện sau khi câu trả lời đã tới),
   * và trả về phần tóm tắt.
   *
   * <p>Lượt hỏng cũng phải gọi hàm này — chỉ là bỏ kết quả đi.
   */
  const end = useCallback((): TurnSummary => {
    clearTimer()
    clearClock()
    const seconds = startedAt.current ? (Date.now() - startedAt.current) / 1000 : 0
    const steps = history.current
    queue.current = []
    history.current = []
    lastSeen.current = null
    shownAt.current = 0
    startedAt.current = 0
    setLabel(null)
    setElapsedSec(0)
    return { seconds, steps }
  }, [])

  useEffect(() => () => {
    clearTimer()
    clearClock()
  }, [])

  return { label, elapsedSec, begin, push, end }
}
