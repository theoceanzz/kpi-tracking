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
  /** Băm nội dung tệp hiện hành — trình soạn gửi lại khi lưu để phát hiện người khác lưu chen. */
  contentHash: string | null
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
  /** Quản lý: sửa thông tin, thay tệp, xoá, di chuyển, chia sẻ. */
  canEdit: boolean
  /** Sửa nội dung trong trình soạn trực tuyến: người quản lý, hoặc được chia sẻ quyền chỉnh sửa. */
  canEditContent: boolean
  /** Tài liệu của đơn vị cha của đơn vị đang lọc — chỉ đọc, hiện "Kế thừa từ …". */
  inherited: boolean
  /** Đơn vị của tài liệu đã bị xoá. */
  orphan: boolean
  /** Tài liệu tri thức cũ, không có tệp gốc. */
  legacy: boolean
  folderId: string | null
  folderName: string | null
  /** Trạng thái riêng của người xem. */
  favorite: boolean
  pinned: boolean
  lastOpenedAt: string | null
  /** Người xem đọc được nhờ được chia sẻ (không phải nhờ phạm vi). */
  sharedWithMe: boolean
  /** Số lượt chia sẻ — chỉ có khi người xem sửa được. */
  shareCount: number | null
  /** Chỉ có ở thùng rác. */
  deletedAt: string | null
  deletedByName: string | null
  /** Ngày rà soát / hết hiệu lực (yyyy-MM-dd). */
  reviewDate: string | null
  expiryDate: string | null
  reviewDue: boolean
  expired: boolean
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
  /** Đơn vị gốc — không chọn làm "Đơn vị" (cả công ty thì dùng phạm vi Công ty). */
  rootUnitIds: string[]
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
  trashRetentionDays: number
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
  folderId?: string
  rootOnly?: boolean
  view?: HomeView
  page?: number
  size?: number
  sort?: 'updatedAt' | 'createdAt' | 'title' | 'fileSize'
  direction?: 'asc' | 'desc'
}

/** Tab của trang chủ lọc qua danh sách; "Gần đây" có API riêng. */
export type HomeView = 'OWNED' | 'SHARED' | 'FAVORITES'

export interface DocumentFolder {
  id: string
  name: string
  scope: DocumentScope
  orgUnitId: string | null
  orgUnitName: string | null
  parentId: string | null
  canEdit: boolean
  createdAt: string
  createdByName: string | null
}

export interface DocumentFolderList {
  /** Thư mục đang mở; null = gốc của phạm vi. */
  current: DocumentFolder | null
  breadcrumb: DocumentFolder[]
  folders: DocumentFolder[]
  canCreate: boolean
}

/** Mức quyền khi chia sẻ: chỉ xem, hoặc sửa nội dung (tài liệu soạn trực tuyến). */
export type SharePermission = 'VIEW' | 'EDIT'

export interface DocumentShare {
  id: string
  type: 'USER' | 'UNIT'
  granteeId: string
  name: string | null
  detail: string | null
  permission: SharePermission
  grantedByName: string | null
  createdAt: string
}

/** Đơn vị trong cây chọn chia sẻ (đơn vị gốc không có — chia sẻ cho cả công ty thì đề xuất lên Công ty). */
export interface ShareUnit {
  id: string
  name: string
  /** null = cấp đầu (con trực tiếp của đơn vị gốc). */
  parentId: string | null
  /** Số người gắn trực tiếp vào đơn vị. */
  memberCount: number
}

export interface ShareTarget {
  type: 'USER' | 'UNIT'
  id: string
  name: string
  detail: string | null
}

export interface DocumentVersion {
  id: string
  version: number
  fileName: string
  fileSize: number
  createdAt: string
  createdByName: string | null
  current: boolean
}

export interface UploadDocumentInput {
  file: File
  scope: DocumentScope
  unitId?: string | null
  title?: string
  description?: string
  category: DocumentCategory
  aiEnabled: boolean
  folderId?: string | null
  reviewDate?: string | null
  expiryDate?: string | null
}

export interface UpdateDocumentInput {
  title?: string
  description?: string
  category?: DocumentCategory
  aiEnabled?: boolean
  scope?: DocumentScope
  orgUnitId?: string | null
  /** true = ghi đè cả hai ngày (null = xoá ngày). */
  datesSet?: boolean
  reviewDate?: string | null
  expiryDate?: string | null
}

/** Định dạng soạn trực tuyến: .kgdoc = khối BlockNote (đủ định dạng), .kgsheet = bảng tính Univer, .md = Markdown, .txt = chữ thuần. */
export type OnlineFormat = 'blocks' | 'sheet' | 'markdown' | 'text'

/** Nội dung chữ của tài liệu .md / .txt mở trong trình soạn. */
export interface DocumentContent {
  content: string
  format: OnlineFormat
  contentHash: string
  version: number
}

export interface CreateOnlineDocumentInput {
  scope?: DocumentScope
  orgUnitId?: string | null
  folderId?: string | null
  title?: string
  /** Tài liệu: mảng khối JSON của BlockNote; bảng tính: snapshot Univer. Rỗng = trống. */
  content?: string
  /** `doc` (mặc định) hay `sheet`. */
  kind?: 'doc' | 'sheet'
  category?: DocumentCategory
  aiEnabled?: boolean
}

export type PromotionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

/** Đề xuất đưa tài liệu lên đơn vị / công ty (§16.2). */
export interface DocumentPromotion {
  id: string
  status: PromotionStatus
  documentId: string
  documentTitle: string | null
  fileName: string | null
  contentType: string | null
  fileSize: number | null
  category: DocumentCategory | null
  sourceScope: DocumentScope | null
  targetScope: DocumentScope
  targetUnitId: string | null
  targetUnitName: string | null
  note: string | null
  requestedBy: string
  requestedByName: string | null
  createdAt: string
  decidedByName: string | null
  decidedAt: string | null
  decisionNote: string | null
  resultDocumentId: string | null
  canDecide: boolean
  canCancel: boolean
}

export interface StorageUsage { count: number; bytes: number }

/** Thống kê dung lượng cho quản trị (§16.5). */
export interface DocumentStorageStats {
  scopes: { scope: DocumentScope; count: number; bytes: number; chunks: number; quota: number | null }[]
  trash: StorageUsage
  versions: StorageUsage
  topUnits: { unitId: string; name: string | null; path: string | null; count: number; bytes: number; chunks: number }[]
  topOwners: { userId: string; name: string | null; email: string | null; deactivated: boolean; count: number; bytes: number; chunks: number }[]
  orgChunks: number
  orgChunkQuota: number
  unitQuota: number
  personalQuota: number
  trashRetentionDays: number
}
