import { useCallback, useEffect, useRef, useState } from 'react'

/** Nhịp gõ. Chậm hơn thì "người" hơn nhưng bắt người đọc chờ; 10ms là ngưỡng dễ chịu. */
const MS_PER_FRAME = 16
/** Trần thời gian gõ hết một câu trả lời. Câu dài thì tự gõ nhanh hơn chứ không kéo dài mãi. */
const MAX_DURATION_MS = 1200

/**
 * Hiện dần một đoạn chữ ĐÃ HOÀN CHỈNH.
 *
 * <p><b>Vì sao gõ ở client chứ không stream từ model.</b> Đã thử `.stream()` và đo được hai lỗi,
 * đều im lặng: (1) không gộp nổi lời gọi tool song song nên câu trả lời mỏng đi — chữa được bằng
 * `parallel_tool_calls=false`; (2) số vòng tự sửa lỗi ít hơn `.call()`, khiến bộ 21 ca điền form
 * tụt từ 21/21 xuống 17/21, trong đó có một ca NGƯỢC sinh đề xuất điền bừa vào form người dùng.
 * Xem `app.ai.streaming.enabled` trong `application.yaml`.
 *
 * <p>Gõ ở đây cho cảm giác mượt tương đương mà không đụng gì tới vòng gọi tool và không tốn thêm
 * token. Đổi lại: chữ chỉ bắt đầu hiện khi đã có trọn câu trả lời — nhưng quãng chờ đó vốn đã được
 * lấp bằng nhãn tiến độ (xem `useStageProgress`).
 *
 * <p>Người dùng LUÔN được ưu tiên hơn hiệu ứng: gọi {@link finish} là hiện trọn ngay.
 */
export function useTypewriter() {
  const [text, setText] = useState('')
  // Là STATE chứ không suy ra từ ref: chỗ gọi dùng `isTyping` làm dependency của useEffect, mà giá
  // trị đọc từ ref trong lúc render thì React không bảo đảm render lại khi nó đổi.
  const [isTyping, setIsTyping] = useState(false)
  const full = useRef('')
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = () => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
  }

  /** Hiện trọn ngay, bỏ phần còn lại của hiệu ứng. */
  const finish = useCallback(() => {
    stop()
    setText(full.current)
    setIsTyping(false)
  }, [])

  /** Bắt đầu gõ một đoạn chữ mới. Chuỗi rỗng thì xoá sạch. */
  const start = useCallback((value: string) => {
    stop()
    full.current = value ?? ''
    setText('')
    setIsTyping(!!full.current)
    if (!full.current) return

    // Số ký tự mỗi nhịp tính từ trần thời gian: câu 200 chữ gõ ~1,2 giây, câu 2000 chữ cũng vậy.
    const frames = Math.max(1, Math.ceil(MAX_DURATION_MS / MS_PER_FRAME))
    const step = Math.max(1, Math.ceil(full.current.length / frames))
    let shown = 0
    timer.current = setInterval(() => {
      shown += step
      if (shown >= full.current.length) {
        stop()
        setText(full.current)
        setIsTyping(false)
        return
      }
      setText(full.current.slice(0, shown))
    }, MS_PER_FRAME)
  }, [])

  /** Xoá hẳn, dùng khi mở hội thoại khác hoặc bắt đầu lượt mới. */
  const reset = useCallback(() => {
    stop()
    full.current = ''
    setText('')
    setIsTyping(false)
  }, [])

  useEffect(() => stop, [])

  return { text, start, finish, reset, isTyping }
}
