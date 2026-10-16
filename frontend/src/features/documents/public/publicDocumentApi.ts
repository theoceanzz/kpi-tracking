import i18n from 'i18next'
import { ENV } from '@/config/env'
import type { PublicDocument } from '../types'

/**
 * Link công khai trong email: người mở KHÔNG đăng nhập. Gọi bằng `fetch` thô, không qua axios của ứng dụng — interceptor
 * ở đó làm mới phiên, kiểm bảng quyền API và đá về /login, toàn những thứ vô nghĩa với người ngoài hệ thống.
 */
const base = (token: string) => `${ENV.API_BASE_URL}/public/documents/${encodeURIComponent(token)}`

async function getData<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'omit', headers: { 'Accept-Language': i18n.language || 'vi' } })
  const body = (await res.json().catch(() => null)) as { data?: T; message?: string } | null
  if (!res.ok) throw new PublicDocumentError(body?.message ?? res.statusText, res.status)
  return body?.data as T
}

export class PublicDocumentError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export const publicDocumentApi = {
  get: (token: string) => getData<PublicDocument>(base(token)),
  content: (token: string) => getData<{ content: string; format: string }>(`${base(token)}/content`),
  fileUrl: (token: string, inline = false) => `${base(token)}/file${inline ? '?inline=true' : ''}`,
}
