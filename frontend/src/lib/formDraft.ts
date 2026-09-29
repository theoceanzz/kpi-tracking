/**
 * Bản nháp của form trong modal: người dùng đang điền dở mà modal bị đóng (bấm nhầm nền, Esc, tải lại
 * trang, hết phiên…) thì mở lại vẫn còn dữ liệu. Dùng qua `useFormDraft` / `useStateDraft`.
 *
 * Lưu ở localStorage, tách theo tài khoản (máy dùng chung không lộ nháp của người khác), hết hạn sau
 * 7 ngày, xoá sạch khi đăng xuất. Không bao giờ lưu mật khẩu hay File: `sanitize` bỏ các khoá có chữ
 * "password" và mọi giá trị không phải JSON thuần.
 */
import { useAuthStore } from '@/store/authStore'

const PREFIX = 'kg-draft:v1:'
const TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface StoredDraft<T = unknown> {
  savedAt: number
  values: T
}

function storageKey(key: string): string | null {
  const userId = useAuthStore.getState().user?.id
  return userId ? `${PREFIX}${userId}:${key}` : null
}

const SECRET_KEY = /password|secret|token/i

/** Chỉ giữ dữ liệu JSON thuần; bỏ File/Blob/hàm và các khoá nhạy cảm. `undefined` = bỏ hẳn khoá này. */
export function sanitize(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(v => sanitize(v)).filter(v => v !== undefined)
  if (typeof value === 'object') {
    if (typeof Blob !== 'undefined' && value instanceof Blob) return undefined
    const proto = Object.getPrototypeOf(value)
    if (proto !== Object.prototype && proto !== null) return undefined
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(k)) continue
      const s = sanitize(v)
      if (s !== undefined) out[k] = s
    }
    return out
  }
  return undefined
}

export function readDraft<T>(key: string): StoredDraft<T> | null {
  const sk = storageKey(key)
  if (!sk) return null
  try {
    const raw = localStorage.getItem(sk)
    if (!raw) return null
    const draft = JSON.parse(raw) as StoredDraft<T>
    if (!draft || typeof draft.savedAt !== 'number' || Date.now() - draft.savedAt > TTL_MS) {
      localStorage.removeItem(sk)
      return null
    }
    return draft
  } catch {
    return null
  }
}

export function writeDraft(key: string, values: unknown): number | null {
  const sk = storageKey(key)
  if (!sk) return null
  const savedAt = Date.now()
  try {
    localStorage.setItem(sk, JSON.stringify({ savedAt, values: sanitize(values) }))
    return savedAt
  } catch {
    return null // đầy bộ nhớ / chế độ riêng tư: mất nháp chứ không làm hỏng form
  }
}

export function removeDraft(key: string): void {
  const sk = storageKey(key)
  if (!sk) return
  try { localStorage.removeItem(sk) } catch { /* bỏ qua */ }
}

/** Xoá mọi bản nháp (mọi tài khoản) — gọi khi đăng xuất. */
export function clearAllDrafts(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k?.startsWith(PREFIX)) localStorage.removeItem(k)
    }
  } catch { /* bỏ qua */ }
}
