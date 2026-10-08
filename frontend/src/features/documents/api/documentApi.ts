import axiosInstance from '@/lib/axios'
import { sendMultipart } from '@/lib/upload'
import { ENV } from '@/config/env'
import type { ApiResponse, PageResponse } from '@/types/api'
import type { RagChunk, RagSearchHit } from '@/features/analytics/api/aiApi'
import type {
  CreateOnlineDocumentInput, DocumentContent,
  DocumentCapabilities, DocumentFolder, DocumentFolderList, DocumentListParams, DocumentScope, DocumentShare,
  DocumentUsage, DocumentVersion, KbDocument, PersonalSummary, ShareTarget, UpdateDocumentInput, UploadDocumentInput,
  DocumentPromotion, DocumentStorageStats, ShareUnit, SharePermission,
} from '../types'

const BASE = '/documents'

/** Đường dẫn tải/xem tệp. Xác thực bằng cookie nên dùng thẳng làm href / src được. */
export function documentFileUrl(id: string, inline = false): string {
  return `${ENV.API_BASE_URL}${BASE}/${id}/download${inline ? '?inline=true' : ''}`
}

/** Tải một phiên bản cũ của tệp. */
export function documentVersionFileUrl(id: string, versionId: string): string {
  return `${ENV.API_BASE_URL}${BASE}/${id}/versions/${versionId}/download`
}

/** Tệp gốc của một đề xuất — người duyệt xem trước khi quyết. */
export function promotionFileUrl(id: string): string {
  return `${ENV.API_BASE_URL}${BASE}/promotions/${id}/file`
}

export const documentApi = {
  capabilities: () =>
    axiosInstance.get<ApiResponse<DocumentCapabilities>>(`${BASE}/capabilities`).then(r => r.data.data),

  list: (params: DocumentListParams) =>
    axiosInstance.get<ApiResponse<PageResponse<KbDocument>>>(BASE, { params }).then(r => r.data.data),

  legacy: () =>
    axiosInstance.get<ApiResponse<KbDocument[]>>(`${BASE}/legacy`).then(r => r.data.data),

  get: (id: string) =>
    axiosInstance.get<ApiResponse<KbDocument>>(`${BASE}/${id}`).then(r => r.data.data),

  usage: () =>
    axiosInstance.get<ApiResponse<DocumentUsage>>(`${BASE}/usage`).then(r => r.data.data),

  upload: (input: UploadDocumentInput) => {
    const form = new FormData()
    form.append('file', input.file)
    form.append('scope', input.scope)
    if (input.unitId) form.append('unitId', input.unitId)
    if (input.title) form.append('title', input.title)
    if (input.description) form.append('description', input.description)
    form.append('category', input.category)
    form.append('aiEnabled', String(input.aiEnabled))
    if (input.folderId) form.append('folderId', input.folderId)
    if (input.reviewDate) form.append('reviewDate', input.reviewDate)
    if (input.expiryDate) form.append('expiryDate', input.expiryDate)
    return sendMultipart<ApiResponse<KbDocument>>(BASE, form)
      .then(r => r.data.data)
  },

  update: (id: string, input: UpdateDocumentInput) =>
    axiosInstance.patch<ApiResponse<KbDocument>>(`${BASE}/${id}`, input).then(r => r.data.data),

  replaceFile: (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return sendMultipart<ApiResponse<KbDocument>>(`${BASE}/${id}/file`, form, { method: 'put' })
      .then(r => r.data.data)
  },

  // ── Soạn trực tuyến ──
  createOnline: (input: CreateOnlineDocumentInput) =>
    axiosInstance.post<ApiResponse<KbDocument>>(`${BASE}/online`, input).then(r => r.data.data),
  content: (id: string) =>
    axiosInstance.get<ApiResponse<DocumentContent>>(`${BASE}/${id}/content`).then(r => r.data.data),
  /** Tệp gốc dạng byte — chuyển .docx thành bản soạn trực tuyến ngay trên trình duyệt. */
  fileBytes: (id: string) =>
    axiosInstance.get<ArrayBuffer>(`${BASE}/${id}/download`, { responseType: 'arraybuffer' }).then(r => r.data),
  /** Chuyển tại chỗ .docx / .md thành tài liệu trực tuyến; tệp cũ vào lịch sử phiên bản. */
  convertOnline: (id: string, content: string, baseHash: string) =>
    axiosInstance.post<ApiResponse<KbDocument>>(`${BASE}/${id}/convert-online`, { content, baseHash }).then(r => r.data.data),
  saveContent: (id: string, content: string, baseHash: string) =>
    axiosInstance.put<ApiResponse<KbDocument>>(`${BASE}/${id}/content`, { content, baseHash }).then(r => r.data.data),

  remove: (id: string) => axiosInstance.delete<ApiResponse<void>>(`${BASE}/${id}`).then(r => r.data),

  reindex: (id: string) =>
    axiosInstance.post<ApiResponse<KbDocument>>(`${BASE}/${id}/reindex`).then(r => r.data.data),

  chunks: (id: string) =>
    axiosInstance.get<ApiResponse<RagChunk[]>>(`${BASE}/${id}/chunks`).then(r => r.data.data),

  removeLegacy: (id: string) =>
    axiosInstance.delete<ApiResponse<void>>(`${BASE}/legacy/${id}`).then(r => r.data),

  replaceLegacy: (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return sendMultipart<ApiResponse<KbDocument>>(`${BASE}/legacy/${id}/replace`, form)
      .then(r => r.data.data)
  },

  /** Admin: số tài liệu + dung lượng kho cá nhân của một người — không tên, không nội dung. */
  personalSummary: (ownerId: string) =>
    axiosInstance.get<ApiResponse<PersonalSummary>>(`${BASE}/personal/summary`, { params: { ownerId } }).then(r => r.data.data),

  /** Admin xoá sớm tài liệu cá nhân của người đang bị vô hiệu hoá. */
  purgePersonal: (ownerId: string) =>
    axiosInstance.delete<ApiResponse<{ deleted: number }>>(`${BASE}/personal`, { params: { ownerId } }).then(r => r.data.data),

  /** Thử tìm trong kho bằng đúng bộ truy hồi (và quyền) của trợ lý. */
  search: (q: string) =>
    axiosInstance.get<ApiResponse<RagSearchHit[]>>('/ai/rag/search', { params: { q } }).then(r => r.data.data),

  // ── Trang chủ ──
  recent: () => axiosInstance.get<ApiResponse<KbDocument[]>>(`${BASE}/recent`).then(r => r.data.data),
  pinned: () => axiosInstance.get<ApiResponse<KbDocument[]>>(`${BASE}/pinned`).then(r => r.data.data),
  setFavorite: (id: string, value: boolean) =>
    axiosInstance.put<ApiResponse<KbDocument>>(`${BASE}/${id}/favorite`, { value }).then(r => r.data.data),
  setPinned: (id: string, value: boolean) =>
    axiosInstance.put<ApiResponse<KbDocument>>(`${BASE}/${id}/pin`, { value }).then(r => r.data.data),
  markOpened: (id: string) => axiosInstance.post<ApiResponse<void>>(`${BASE}/${id}/open`).then(r => r.data),

  // ── Thư mục ──
  folders: (params: { scope?: DocumentScope; unitId?: string; parentId?: string }) =>
    axiosInstance.get<ApiResponse<DocumentFolderList>>(`${BASE}/folders`, { params }).then(r => r.data.data),
  createFolder: (input: { scope?: DocumentScope; orgUnitId?: string | null; parentId?: string | null; name: string }) =>
    axiosInstance.post<ApiResponse<DocumentFolder>>(`${BASE}/folders`, input).then(r => r.data.data),
  renameFolder: (id: string, name: string) =>
    axiosInstance.patch<ApiResponse<DocumentFolder>>(`${BASE}/folders/${id}`, { name }).then(r => r.data.data),
  deleteFolder: (id: string) =>
    axiosInstance.delete<ApiResponse<{ trashed: number }>>(`${BASE}/folders/${id}`).then(r => r.data.data),
  move: (id: string, folderId: string | null) =>
    axiosInstance.post<ApiResponse<KbDocument>>(`${BASE}/${id}/move`, { folderId }).then(r => r.data.data),

  // ── Thùng rác ──
  trash: () => axiosInstance.get<ApiResponse<KbDocument[]>>(`${BASE}/trash`).then(r => r.data.data),
  restore: (id: string) => axiosInstance.post<ApiResponse<KbDocument>>(`${BASE}/${id}/restore`).then(r => r.data.data),
  deletePermanently: (id: string) => axiosInstance.delete<ApiResponse<void>>(`${BASE}/${id}/permanent`).then(r => r.data),
  emptyTrash: () => axiosInstance.delete<ApiResponse<{ deleted: number }>>(`${BASE}/trash`).then(r => r.data.data),

  // ── Đề xuất đưa lên ──
  propose: (id: string, input: { targetScope: DocumentScope; targetUnitId?: string | null; note?: string }) =>
    axiosInstance.post<ApiResponse<DocumentPromotion>>(`${BASE}/${id}/promotions`, input).then(r => r.data.data),
  documentPromotions: (id: string) =>
    axiosInstance.get<ApiResponse<DocumentPromotion[]>>(`${BASE}/${id}/promotions`).then(r => r.data.data),
  promotionInbox: () => axiosInstance.get<ApiResponse<DocumentPromotion[]>>(`${BASE}/promotions/inbox`).then(r => r.data.data),
  myPromotions: () => axiosInstance.get<ApiResponse<DocumentPromotion[]>>(`${BASE}/promotions/mine`).then(r => r.data.data),
  approvePromotion: (id: string, input: { title?: string; note?: string }) =>
    axiosInstance.post<ApiResponse<KbDocument>>(`${BASE}/promotions/${id}/approve`, input).then(r => r.data.data),
  rejectPromotion: (id: string, note?: string) =>
    axiosInstance.post<ApiResponse<DocumentPromotion>>(`${BASE}/promotions/${id}/reject`, { note }).then(r => r.data.data),
  cancelPromotion: (id: string) => axiosInstance.post<ApiResponse<void>>(`${BASE}/promotions/${id}/cancel`).then(r => r.data),

  // ── Dung lượng ──
  storageStats: () => axiosInstance.get<ApiResponse<DocumentStorageStats>>(`${BASE}/storage-stats`).then(r => r.data.data),

  // ── Phiên bản ──
  versions: (id: string) =>
    axiosInstance.get<ApiResponse<DocumentVersion[]>>(`${BASE}/${id}/versions`).then(r => r.data.data),
  restoreVersion: (id: string, versionId: string) =>
    axiosInstance.post<ApiResponse<KbDocument>>(`${BASE}/${id}/versions/${versionId}/restore`).then(r => r.data.data),

  // ── Chia sẻ ──
  shares: (id: string) => axiosInstance.get<ApiResponse<DocumentShare[]>>(`${BASE}/${id}/shares`).then(r => r.data.data),
  share: (id: string, input: { userIds: string[]; unitIds: string[]; permission?: SharePermission }) =>
    axiosInstance.post<ApiResponse<DocumentShare[]>>(`${BASE}/${id}/shares`, input).then(r => r.data.data),
  updateShare: (id: string, shareId: string, permission: SharePermission) =>
    axiosInstance.patch<ApiResponse<DocumentShare[]>>(`${BASE}/${id}/shares/${shareId}`, { permission }).then(r => r.data.data),
  unshare: (id: string, shareId: string) =>
    axiosInstance.delete<ApiResponse<void>>(`${BASE}/${id}/shares/${shareId}`).then(r => r.data),
  shareUnits: () => axiosInstance.get<ApiResponse<ShareUnit[]>>(`${BASE}/share-units`).then(r => r.data.data),
  shareUnitMembers: (unitId: string) =>
    axiosInstance.get<ApiResponse<ShareTarget[]>>(`${BASE}/share-units/${unitId}/members`).then(r => r.data.data),
  shareTargets: (q: string) =>
    axiosInstance.get<ApiResponse<ShareTarget[]>>(`${BASE}/share-targets`, { params: { q } }).then(r => r.data.data),
}
