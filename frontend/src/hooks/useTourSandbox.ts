import { useEffect, useLayoutEffect, useRef } from 'react'
import { useTourStore } from '@/store/tourStore'

/**
 * Hộp cát cho bài hướng dẫn: chụp trạng thái lúc bài BẮT ĐẦU, trả lại đúng như thế lúc bài KẾT
 * THÚC — vì bất kỳ lý do gì (xong, Bỏ qua, Esc, đóng, chuyển màn hình làm `TourHost` dừng bài).
 *
 * Đi cặp với việc tự kiểm `isTourRunning()` ở chỗ ghi dữ liệu: trong lúc bài chạy, thao tác vẫn
 * thấy trên màn hình (người học kéo thử một ô thì ô vẫn chạy theo tay) nhưng không có gì được
 * ghi xuống server, và hết bài thì màn hình về y như cũ.
 *
 * Đóng hẳn tab giữa bài thì không cần trả lại: chưa có gì được ghi.
 */
export function useTourSandbox<T>(snapshot: () => T, restore: (saved: T) => void) {
  const snapshotRef = useRef(snapshot)
  const restoreRef = useRef(restore)
  useLayoutEffect(() => {
    snapshotRef.current = snapshot
    restoreRef.current = restore
  })

  useEffect(() => {
    // Gắn vào lúc bài đã chạy sẵn (bài mở một màn hình con): mốc là trạng thái lúc gắn.
    let saved: { value: T } | null = useTourStore.getState().activeTour ? { value: snapshotRef.current() } : null
    return useTourStore.subscribe((state, prev) => {
      const wasRunning = prev.activeTour !== null
      const running = state.activeTour !== null
      if (!wasRunning && running) {
        saved = { value: snapshotRef.current() }
      } else if (wasRunning && !running && saved) {
        const value = saved.value
        saved = null
        restoreRef.current(value)
      }
    })
  }, [])
}
