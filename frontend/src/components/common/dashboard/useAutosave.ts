import { useCallback, useEffect, useRef, useState } from 'react'

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface Options<T> {
  /** Ghi xuống server. Phải idempotent theo toàn văn: lần ghi sau đè hẳn lần trước. */
  save: (payload: T) => Promise<unknown>
  /** Gom các thao tác liên tiếp. */
  delay?: number
  /** Nghịch liên tục vẫn phải có điểm chốt, không thì mất trắng nếu tab chết. */
  maxWait?: number
}

/**
 * Tự lưu có gom nhịp, dùng cho lưới widget: kéo/dãn xong là lưu, nhưng một chuỗi thao tác chỉ tốn
 * một request.
 *
 * Vì sao không dùng `useMutation` của TanStack Query:
 *
 * 1. Bố cục không phải server state để đọc lại — nạp đúng một lần lúc mount, sau đó client là
 *    nguồn sự thật. Cache và invalidate không giúp được gì.
 * 2. `useMutation` không có gom nhịp, nên vẫn phải tự viết ref + timeout, rồi lại phải dập
 *    `isPending` nhấp nháy giữa các lần gom.
 * 3. Cần xả hàng đợi SỐNG SÓT qua unmount — điều `useMutation` chủ động cản vì nó dọn state khi
 *    component biến mất.
 *
 * Bất biến quan trọng: KHÔNG bao giờ nạp lại state từ phản hồi. Người dùng có thể đã kéo tiếp
 * trong lúc request đang bay; ghi đè bằng phản hồi cũ là giật lưới về vị trí cũ ngay dưới tay họ.
 */
export function useAutosave<T>({ save, delay = 800, maxWait = 4000 }: Options<T>) {
  const [status, setStatus] = useState<AutosaveStatus>('idle')

  // `save` vào ref để `flush` giữ nguyên định danh — không thì mỗi lần render lại gỡ và gắn lại
  // listener `pagehide`, và cleanup của lần trước sẽ bắn một lần lưu thừa.
  const saveRef = useRef(save)
  saveRef.current = save

  const latest = useRef<T | null>(null)
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef(false)
  const queued = useRef(false)
  const seq = useRef(0)

  const clearTimers = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (maxTimer.current) { clearTimeout(maxTimer.current); maxTimer.current = null }
  }

  const flush = useCallback(async () => {
    clearTimers()
    if (!dirty.current || latest.current === null) return
    // Đang có request bay: xếp hàng thay vì chạy song song. Hai PUT toàn văn chồng nhau thì thứ tự
    // về không đảm bảo, và cái về sau có thể là cái cũ hơn.
    if (inFlight.current) { queued.current = true; return }

    const mine = ++seq.current
    const payload = latest.current
    inFlight.current = true
    dirty.current = false
    setStatus('saving')
    try {
      await saveRef.current(payload)
      if (mine === seq.current) setStatus('saved')
    } catch {
      // Giữ nguyên state cục bộ: người dùng đang nhìn bố cục mới, giật về bố cục cũ vì lỗi mạng
      // còn khó hiểu hơn là báo chưa lưu được.
      dirty.current = true
      if (mine === seq.current) setStatus('error')
    } finally {
      inFlight.current = false
      if (queued.current) {
        queued.current = false
        void flush()
      }
    }
  }, [])

  const schedule = useCallback((payload: T, opts?: { immediate?: boolean }) => {
    latest.current = payload
    dirty.current = true
    if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null }

    if (opts?.immediate) { void flush(); return }

    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void flush() }, delay)
    // Mốc chốt chỉ đặt một lần cho cả chuỗi, không gia hạn theo từng thao tác.
    if (!maxTimer.current) {
      maxTimer.current = setTimeout(() => { void flush() }, maxWait)
    }
  }, [delay, maxWait, flush])

  const retry = useCallback(() => { void flush() }, [flush])

  // Thử lại một lần sau lỗi. Một lần thôi: lỗi dai (hết phiên, mất quyền) mà cứ thử lại thì chỉ
  // sinh ra một vòng lặp request im lặng.
  useEffect(() => {
    if (status !== 'error') return
    retryTimer.current = setTimeout(() => { void flush() }, 3000)
    return () => { if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null } }
  }, [status, flush])

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flush() }
    const onPageHide = () => { void flush() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
      // Đổi mục trong SettingsSectionLayout hoặc đổi route đều unmount tab này. Không `await`:
      // request đã phát đi vẫn chạy tiếp sau khi component biến mất.
      void flush()
    }
  }, [flush])

  return { status, schedule, flush, retry }
}
