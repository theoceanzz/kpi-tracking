/** Khớp backend: docs/DOCUMENTS_DESIGN.md §7. */
export type DocumentScope = 'PERSONAL' | 'UNIT' | 'COMPANY'
export type DocumentCategory = 'REGULATION' | 'JOB_DESCRIPTION' | 'STRATEGY' | 'PROCESS' | 'TEMPLATE' | 'REFERENCE' | 'OTHER'
export type DocumentAiStatus = 'NONE' | 'PENDING' | 'INDEXING' | 'READY' | 'FAILED' | 'UNSUPPORTED'

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'REGULATION', 'PROCESS', 'JOB_DESCRIPTION', 'STRATEGY', 'TEMPLATE', 'REFERENCE', 'OTHER',
]

export interface KbDocument {
  id: string
  scope: DocumentScope
  orgUnitId: string | null
  orgUnitName: string | null
  ownerId: string | null
  title: string
  description: string | null
  category: DocumentCategory
  fileName: string | null
  contentType: string | null
  fileSize: number | null
  version: number
  aiEnabled: boolean
  aiStatus: DocumentAiStatus
  aiChunkCount: number
  /** Lý do nạp hỏng, backend đã dịch. */
  aiError: string | null
  aiIndexedAt: string | null
  createdBy: string | null
  createdByName: string | null
  createdAt: string
  updatedAt: string
  canEdit: boolean
  /** Tài liệu của đơn vị cha của đơn vị đang lọc — chỉ đọc, hiện "Kế thừa từ …". */
  inherited: boolean
  /** Đơn vị của tài liệu đã bị xoá. */
  orphan: boolean
  /** Tài liệu tri thức cũ, không có tệp gốc. */
  legacy: boolean
}

export interface UnitOption {
  id: string
  name: string
  path: string
}

export interface DocumentCapabilities {
  member: boolean
  canUploadPersonal: boolean
  canManageCompany: boolean
  manageableUnits: UnitOption[]
  visibleUnits: UnitOption[]
  allowedExtensions: string[]
}

export interface DocumentUsage {
  personalUsed: number
  personalQuota: number
  companyUsed: number
  companyQuota: number
  unitQuota: number
  orgChunks: number
  orgChunkQuota: number
  maxFileBytes: number
}

export interface PersonalSummary {
  count: number
  bytes: number
  deactivated: boolean
}

export interface DocumentListParams {
  scope?: DocumentScope
  unitId?: string
  includeDescendants?: boolean
  category?: DocumentCategory
  aiStatus?: DocumentAiStatus
  q?: string
  page?: number
  size?: number
}

export interface UploadDocumentInput {
  file: File
  scope: DocumentScope
  unitId?: string | null
  title?: string
  description?: string
  category: DocumentCategory
  aiEnabled: boolean
}

export interface UpdateDocumentInput {
  title?: string
  description?: string
  category?: DocumentCategory
  aiEnabled?: boolean
  scope?: DocumentScope
  orgUnitId?: string | null
}
