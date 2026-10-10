import type { Client, StompSubscription } from '@stomp/stompjs'

/**
 * Đăng ký kênh STOMP dùng chung MỘT kết nối — kết nối do `useWebSocketNotifications` (chuông thông báo, luôn có
 * mặt trong AppLayout) mở và gắn vào đây. Màn nào cần nghe thêm kênh (vd. khung thảo luận của một KPI) gọi
 * `subscribeTopic` thay vì tự mở kết nối thứ hai.
 *
 * Kênh đăng ký trước khi kết nối xong, hoặc đang đăng ký lúc mất kết nối, được đăng ký lại khi (tái) kết nối.
 */
type Handler = (body: unknown) => void

const handlers = new Map<string, Set<Handler>>()
const active = new Map<string, StompSubscription>()
let client: Client | null = null

function open(destination: string) {
  if (!client?.connected || active.has(destination)) return
  const sub = client.subscribe(destination, (frame) => {
    let body: unknown = frame.body
    try {
      body = JSON.parse(frame.body)
    } catch {
      // giữ nguyên chuỗi
    }
    handlers.get(destination)?.forEach((h) => h(body))
  })
  active.set(destination, sub)
}

/** Gọi trong `onConnect` (cả lần tái kết nối): mọi đăng ký cũ đã chết theo phiên trước. */
export function attachRealtimeClient(c: Client) {
  client = c
  active.clear()
  handlers.forEach((_, destination) => open(destination))
}

export function detachRealtimeClient() {
  client = null
  active.clear()
}

/** Nghe một kênh; trả hàm huỷ. */
export function subscribeTopic(destination: string, handler: Handler): () => void {
  let set = handlers.get(destination)
  if (!set) {
    set = new Set()
    handlers.set(destination, set)
  }
  set.add(handler)
  open(destination)
  return () => {
    const s = handlers.get(destination)
    if (!s) return
    s.delete(handler)
    if (s.size === 0) {
      handlers.delete(destination)
      try {
        active.get(destination)?.unsubscribe()
      } catch {
        // kết nối đã đóng
      }
      active.delete(destination)
    }
  }
}
