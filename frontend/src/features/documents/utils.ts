import { formatNumber } from '@/i18n/format'
import type { DocumentCapabilities, DocumentScope } from './types'

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
