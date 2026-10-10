import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'
import axiosInstance, { refreshSession } from './axios'
import { useAuthStore } from '@/store/authStore'

/**
 * Làm mới phiên dùng chung (interceptor 401 + WebSocket): một request một lúc trong tab, nhường giữa các tab,
 * chỉ đá ra đăng nhập khi phiên hết THẬT. Tầng mạng được thay bằng adapter giả.
 */
type Handler = (config: InternalAxiosRequestConfig) => Promise<{ status: number; data?: unknown }>
let handler: Handler
const calls: string[] = []
const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
  calls.push(`${config.method?.toUpperCase()} ${config.url}`)
  const r = await handler(config)
  if (r.status >= 400) {
    throw Object.assign(new Error(`HTTP ${r.status}`), { config, response: { status: r.status, data: r.data ?? {} }, isAxiosError: true })
  }
  return { data: r.data ?? {}, status: r.status, statusText: 'OK', headers: {}, config }
})
const original = axiosInstance.defaults.adapter

describe('refreshSession / interceptor 401', () => {
  beforeEach(() => {
    calls.length = 0
    adapter.mockClear()
    axiosInstance.defaults.adapter = adapter as never
    localStorage.clear()
    useAuthStore.setState({ user: null, isAuthenticated: false })
  })
  afterEach(() => {
    axiosInstance.defaults.adapter = original
    vi.unstubAllGlobals()
  })

  it('nhiều lời gọi cùng lúc trong một tab ⇒ đúng MỘT request làm mới', async () => {
    handler = async () => ({ status: 200 })
    await Promise.all([refreshSession(), refreshSession(), refreshSession()])
    expect(calls.filter(c => c.includes('refresh-token'))).toHaveLength(1)
  })

  it('tab khác vừa làm mới (vài giây trước) ⇒ tab này KHÔNG gọi nữa, cookie dùng chung đã mới', async () => {
    handler = async () => ({ status: 200 })
    localStorage.setItem('kg-last-session-refresh', String(Date.now() - 1000))
    await refreshSession()
    expect(calls).toEqual([])
  })

  it('401 ⇒ làm mới một lần rồi gửi lại request', async () => {
    let first = true
    handler = async (c) => {
      if (c.url?.includes('refresh-token')) return { status: 200 }
      if (first) { first = false; return { status: 401 } }
      return { status: 200, data: { ok: true } }
    }
    const res = await axiosInstance.get('/notifications/unread-count')
    expect(res.data).toEqual({ ok: true })
    expect(calls).toEqual(['GET /notifications/unread-count', 'POST /auth/refresh-token', 'GET /notifications/unread-count'])
  })

  it('làm mới bị từ chối (422 — token thu hồi) ⇒ dọn phiên và về /login', async () => {
    const location = { href: '/dashboard' }
    vi.stubGlobal('location', location)
    useAuthStore.setState({ user: { id: 'u' } as never, isAuthenticated: true })
    handler = async (c) => (c.url?.includes('refresh-token') ? { status: 422 } : { status: 401 })
    await expect(axiosInstance.get('/notifications/unread-count')).rejects.toBeTruthy()
    expect(location.href).toBe('/login')
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('làm mới hỏng vì MẠNG ⇒ KHÔNG đăng xuất oan', async () => {
    const location = { href: '/dashboard' }
    vi.stubGlobal('location', location)
    useAuthStore.setState({ user: { id: 'u' } as never, isAuthenticated: true })
    handler = async (c) => {
      if (c.url?.includes('refresh-token')) throw new Error('Network Error')
      return { status: 401 }
    }
    await expect(axiosInstance.get('/notifications/unread-count')).rejects.toBeTruthy()
    expect(location.href).toBe('/dashboard')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })
})
