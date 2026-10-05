import { formatNumber } from '@/i18n/format'
import type { DocumentCapabilities, DocumentScope, KbDocument, OnlineFormat } from './types'

/** Dung lượng tệp — số qua `formatNumber` để đúng dấu thập phân theo ngôn ngữ. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${formatNumber(bytes)} B`
  if (bytes < 1024 * 1024) return `${formatNumber(Math.round(bytes / 1024))} KB`
  if (bytes < 1024 * 1024 * 1024) return `${formatNumber(bytes / (1024 * 1024), { maximumFractionDigits: 1 })} MB`
  return `${formatNumber(bytes / (1024 * 1024 * 1024), { maximumFractionDigits: 1 })} GB`
}

/** Các phạm vi người dùng tạo được — cùng luật với backend (`DocumentAccess.canCreate`). */
export function creatableScopes(caps: DocumentCapabilities): DocumentScope[] {
  const out: DocumentScope[] = []
  if (caps.canUploadPersonal) out.push('PERSONAL')
  if (caps.manageableUnits.length > 0) out.push('UNIT')
  if (caps.canManageCompany) out.push('COMPANY')
  return out
}

/** Lưu một tệp sinh ngay trên trình duyệt (xuất Excel…). */
export function saveBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.replace(/[\\/:*?"<>|]/g, '-')
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Tải một tệp qua link (cookie xác thực đi kèm) — dùng từ menu, nơi không đặt được thẻ <a download>. */
export function downloadUrl(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = ''
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Số ngày (làm tròn lên) còn khôi phục được một tài liệu trong thùng rác; 0 = sắp bị xoá hẳn. */
export function trashDaysLeft(deletedAt: string | null, retentionDays: number, now = Date.now()): number {
  if (!deletedAt) return retentionDays
  const expires = new Date(deletedAt).getTime() + retentionDays * 86_400_000
  return Math.max(0, Math.ceil((expires - now) / 86_400_000))
}

/** Loại tệp thư viện nhận — khớp `DocumentPolicy.ALLOWED` phía máy chủ (máy chủ vẫn kiểm nội dung tệp). */
export const DOCUMENT_ACCEPT = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
  'text/csv': ['.csv'],
}

/** Chuỗi `accept` cho thẻ <input type="file"> (thay tệp). */
export const DOCUMENT_ACCEPT_ATTR = Object.values(DOCUMENT_ACCEPT).flat().join(',')

/** Một chỗ có thể đề xuất đưa tài liệu lên (§16.2). */
export interface PromotionTarget { scope: DocumentScope; unitId: string | null; name: string }

/**
 * Nơi người dùng ĐỀ XUẤT được (không tự tạo được) — cùng luật với backend: đơn vị mình xem được (đơn vị mình và cấp
 * trên) mà mình không quản lý, hoặc công ty khi mình không quản lý tài liệu công ty. Trừ chỗ tài liệu đang ở.
 */
export function promotionTargets(doc: KbDocument, caps: DocumentCapabilities): PromotionTarget[] {
  const out: PromotionTarget[] = []
  const manageable = new Set(caps.manageableUnits.map(u => u.id))
  const roots = new Set(caps.rootUnitIds ?? [])
  for (const u of [...caps.visibleUnits].sort((a, b) => a.path.localeCompare(b.path))) {
    if (manageable.has(u.id) || roots.has(u.id)) continue
    if (doc.scope === 'UNIT' && doc.orgUnitId === u.id) continue
    out.push({ scope: 'UNIT', unitId: u.id, name: u.name })
  }
  if (!caps.canManageCompany && doc.scope !== 'COMPANY') out.push({ scope: 'COMPANY', unitId: null, name: '' })
  return out
}

/** Đơn vị để LIỆT KÊ trong giao diện (Drive "Đơn vị"…): bỏ đơn vị gốc — tài liệu cho cả công ty nằm ở Drive "Công ty". */
export function listableUnits(caps: DocumentCapabilities) {
  const roots = new Set(caps.rootUnitIds ?? [])
  return caps.visibleUnits.filter(u => !roots.has(u.id))
}

/** Định dạng soạn trực tuyến của tài liệu (.kgdoc / .kgsheet / .md / .txt), hoặc null nếu chỉ xem / thay tệp được — khớp `DocumentEditService.formatOf`. */
export function onlineFormat(doc: Pick<KbDocument, 'fileName' | 'legacy'>): OnlineFormat | null {
  if (doc.legacy || !doc.fileName) return null
  const name = doc.fileName.toLowerCase()
  if (name.endsWith('.kgdoc')) return 'blocks'
  if (name.endsWith('.kgsheet')) return 'sheet'
  if (name.endsWith('.md')) return 'markdown'
  if (name.endsWith('.txt')) return 'text'
  return null
}


/** Đường dẫn trang soạn / đọc trực tuyến của một tài liệu. */
export function editorPath(id: string): string {
  return `/documents/${id}/edit`
}
