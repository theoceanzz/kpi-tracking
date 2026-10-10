import { useEffect, useLayoutEffect, useRef } from 'react'

/**
 * "Tour bus": màn hình đăng ký hành động theo TÊN, bước hướng dẫn gọi theo tên.
 *
 * Bài hướng dẫn không được chạm thẳng vào state của component (nó không có quyền truy cập, và
 * nếu có thì mỗi lần sửa component là gãy bài). Thay vào đó component tự khai:
 *
 *   useTourAction('widgets.library.open', () => setIsAddModalOpen(true))
 *
 * rồi bước chỉ viết `before: () => runTourAction('widgets.library.open')`. Màn hình không vẽ
 * component đó (thiếu quyền, cờ tính năng tắt) thì hành động không có — gọi tới là no-op, và
 * bước neo vào phần tử của nó sẽ tự bị bỏ qua vì không tìm thấy neo.
 *
 * Quy ước: hành động phải LUỸ ĐẲNG ("mở thư viện" khi đã mở thì thôi), vì bước có thể chạy lại
 * khi bấm Quay lại hoặc khi học tiếp từ giữa bài.
 */
type TourActionFn = (...args: unknown[]) => void | Promise<void>

const registry = new Map<string, TourActionFn>()

export function registerTourAction(name: string, fn: TourActionFn): () => void {
  registry.set(name, fn)
  return () => {
    if (registry.get(name) === fn) registry.delete(name)
  }
}

export function hasTourAction(name: string): boolean {
  return registry.has(name)
}

/** Gọi một hành động đã đăng ký; không có thì trả về ngay. Lỗi của hành động không làm vỡ bài. */
export async function runTourAction(name: string, ...args: unknown[]): Promise<void> {
  const fn = registry.get(name)
  if (!fn) return
  try {
    await fn(...args)
  } catch (err) {
    console.warn(`[tours] Hành động "${name}" lỗi:`, err)
  }
}

/** Đăng ký hành động trong vòng đời component. `fn` luôn là bản mới nhất, không cần memo. */
export function useTourAction(name: string, fn: TourActionFn) {
  const ref = useRef(fn)
  useLayoutEffect(() => {
    ref.current = fn
  })
  useEffect(() => registerTourAction(name, (...args) => ref.current(...args)), [name])
}

/**
 * Cặp hành động mở / đóng một modal cho bài hướng dẫn: `<name>.open` và `<name>.close`.
 * `open` phải mở ở chế độ TẠO MỚI (form trống) và đóng mọi modal khác của màn hình trước.
 */
export function useTourModal(name: string, open: () => void, close: () => void) {
  useTourAction(`${name}.open`, open)
  useTourAction(`${name}.close`, close)
}
