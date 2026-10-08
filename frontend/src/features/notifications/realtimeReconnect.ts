/**
 * Chính sách kết nối lại WebSocket (STOMP) của chuông thông báo.
 *
 * <p>Log prod 2026-10-06: một tab để yên ~30 phút CONNECT lại mỗi 5–6 giây (1640 CONNECT / 90 CONNECTED),
 * server đều từ chối {@code ws_connect_rejected reason=no_credentials}. Cookie phiên đã hết hạn nhưng STOMP cứ
 * kết nối lại với khoảng chờ cố định, không ai làm mới phiên — chỉ khi người dùng bấm gì đó, request HTTP mới
 * gặp 401 và làm mới.
 *
 * <p>Ở đây: sau một lần kết nối hỏng, TRƯỚC lần thử kế tiếp thì làm mới phiên (dùng chung đường làm mới một
 * request/lần của axios). Làm mới bị từ chối (4xx = phiên đã hết thật) ⇒ ngắt hẳn và về đăng nhập. Lỗi mạng ⇒
 * cứ thử lại, khoảng chờ tăng dần 5s → 10s → 30s → 60s, tối đa {@link MAX_RECONNECT_ATTEMPTS} lần.
 */
export const RECONNECT_DELAYS_MS = [5_000, 10_000, 30_000, 60_000] as const
export const MAX_RECONNECT_ATTEMPTS = 10

/** Khoảng chờ trước lần thử thứ `failures` (1 = lần đầu sau khi hỏng). */
export function nextReconnectDelay(failures: number): number {
  const i = Math.min(Math.max(failures, 1), RECONNECT_DELAYS_MS.length) - 1
  return RECONNECT_DELAYS_MS[i]!
}

/** Lỗi làm mới phiên do PHIÊN đã hết (server trả 4xx) — khác lỗi mạng / server sập (thử lại được). */
export function isSessionOverError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | null)?.response?.status
  return status != null && status >= 400 && status < 500
}

/** Phần của STOMP Client mà chính sách cần — để test được không cần socket thật. */
export interface ReconnectableClient {
  reconnectDelay: number
  active: boolean
  deactivate: () => Promise<void> | void
}

export function createReconnectPolicy(deps: {
  refresh: () => Promise<void>
  onSessionOver: () => void
}) {
  let failures = 0
  let stopped = false

  return {
    get failures() { return failures },

    /** Kết nối thành công: xoá đếm, về khoảng chờ ngắn nhất. */
    onConnected(client: ReconnectableClient) {
      failures = 0
      client.reconnectDelay = RECONNECT_DELAYS_MS[0]
    },

    /** Socket đóng (kể cả bị server từ chối CONNECT): đặt khoảng chờ cho lần thử kế; quá số lần thì dừng. */
    onClosed(client: ReconnectableClient) {
      if (stopped || !client.active) return
      failures++
      if (failures > MAX_RECONNECT_ATTEMPTS) {
        stopped = true
        client.reconnectDelay = 0 // tắt tự kết nối lại; tải lại trang sẽ thử từ đầu
        void client.deactivate()
        return
      }
      client.reconnectDelay = nextReconnectDelay(failures)
    },

    /** Gọi ở `beforeConnect`: lần thử lại (đã hỏng ít nhất một lần) thì làm mới phiên trước. */
    async beforeConnect(client: ReconnectableClient) {
      if (failures === 0 || stopped) return
      try {
        await deps.refresh()
      } catch (error) {
        if (isSessionOverError(error)) {
          stopped = true
          client.reconnectDelay = 0
          await client.deactivate()
          deps.onSessionOver()
        }
        // Lỗi mạng: cứ để STOMP thử kết nối; hỏng nữa thì onClosed tăng khoảng chờ.
      }
    },
  }
}
