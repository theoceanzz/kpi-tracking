import { describe, expect, it, vi } from 'vitest'
import {
  createReconnectPolicy, isSessionOverError, MAX_RECONNECT_ATTEMPTS, nextReconnectDelay, type ReconnectableClient,
} from './realtimeReconnect'

const fakeClient = (): ReconnectableClient & { deactivate: ReturnType<typeof vi.fn> } => {
  const c = { reconnectDelay: 5000, active: true, deactivate: vi.fn(async () => { c.active = false }) }
  return c
}
const httpError = (status: number) => ({ response: { status } })

describe('kết nối lại WebSocket — không còn CONNECT mỗi 5s vô hạn khi phiên đã hết (log prod 2026-10-06)', () => {
  it('khoảng chờ tăng dần 5s → 10s → 30s → 60s rồi giữ 60s', () => {
    expect([1, 2, 3, 4, 5, 9].map(nextReconnectDelay)).toEqual([5000, 10000, 30000, 60000, 60000, 60000])
  })

  it('mỗi lần socket đóng thì tăng khoảng chờ; kết nối lại được thì về 5s', () => {
    const c = fakeClient()
    const p = createReconnectPolicy({ refresh: vi.fn(), onSessionOver: vi.fn() })
    p.onClosed(c); expect(c.reconnectDelay).toBe(5000)
    p.onClosed(c); expect(c.reconnectDelay).toBe(10000)
    p.onClosed(c); expect(c.reconnectDelay).toBe(30000)
    p.onConnected(c)
    expect(c.reconnectDelay).toBe(5000)
    expect(p.failures).toBe(0)
  })

  it(`quá ${MAX_RECONNECT_ATTEMPTS} lần thì dừng hẳn`, () => {
    const c = fakeClient()
    const p = createReconnectPolicy({ refresh: vi.fn(), onSessionOver: vi.fn() })
    for (let i = 0; i <= MAX_RECONNECT_ATTEMPTS; i++) p.onClosed(c)
    expect(c.deactivate).toHaveBeenCalledTimes(1)
    expect(c.reconnectDelay).toBe(0)
  })

  it('lần kết nối đầu: không làm mới phiên', async () => {
    const refresh = vi.fn(async () => {})
    const p = createReconnectPolicy({ refresh, onSessionOver: vi.fn() })
    await p.beforeConnect(fakeClient())
    expect(refresh).not.toHaveBeenCalled()
  })

  it('kết nối lại sau khi hỏng: làm mới phiên TRƯỚC khi CONNECT', async () => {
    const refresh = vi.fn(async () => {})
    const c = fakeClient()
    const p = createReconnectPolicy({ refresh, onSessionOver: vi.fn() })
    p.onClosed(c)
    await p.beforeConnect(c)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(c.deactivate).not.toHaveBeenCalled()
  })

  it('làm mới bị từ chối (phiên hết thật, 422/401): ngắt hẳn và về đăng nhập', async () => {
    const onSessionOver = vi.fn()
    const c = fakeClient()
    const p = createReconnectPolicy({ refresh: vi.fn(async () => { throw httpError(422) }), onSessionOver })
    p.onClosed(c)
    await p.beforeConnect(c)
    expect(c.deactivate).toHaveBeenCalled()
    expect(c.reconnectDelay).toBe(0)
    expect(onSessionOver).toHaveBeenCalledTimes(1)
  })

  it('làm mới hỏng vì MẠNG: không đá ra, cứ thử lại', async () => {
    const onSessionOver = vi.fn()
    const c = fakeClient()
    const p = createReconnectPolicy({ refresh: vi.fn(async () => { throw new Error('Network Error') }), onSessionOver })
    p.onClosed(c)
    await p.beforeConnect(c)
    expect(onSessionOver).not.toHaveBeenCalled()
    expect(c.deactivate).not.toHaveBeenCalled()
  })

  it('isSessionOverError: 4xx là phiên hết, còn lại thì không', () => {
    expect(isSessionOverError(httpError(401))).toBe(true)
    expect(isSessionOverError(httpError(422))).toBe(true)
    expect(isSessionOverError(httpError(503))).toBe(false)
    expect(isSessionOverError(new Error('x'))).toBe(false)
  })
})
