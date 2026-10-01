import axiosInstance from '@/lib/axios'
import { ENV } from '@/config/env'
import type { ApiResponse, PageResponse } from '@/types/api'
import type { RagChunk, RagSearchHit } from '@/features/analytics/api/aiApi'
import type {
  DocumentCapabilities, DocumentListParams, DocumentUsage, KbDocument, PersonalSummary, UpdateDocumentInput,
  UploadDocumentInput,
} from '../types'

const BASE = '/documents'

/** Đường dẫn tải/xem tệp. Xác thực bằng cookie nên dùng thẳng làm href / src được. */
export function documentFileUrl(id: string, inline = false): string {
  return `${ENV.API_BASE_URL}${BASE}/${id}/download${inline ? '?inline=true' : ''}`
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
    return axiosInstance
      .post<ApiResponse<KbDocument>>(BASE, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(r => r.data.data)
  },

  update: (id: string, input: UpdateDocumentInput) =>
    axiosInstance.patch<ApiResponse<KbDocument>>(`${BASE}/${id}`, input).then(r => r.data.data),

  replaceFile: (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return axiosInstance
      .put<ApiResponse<KbDocument>>(`${BASE}/${id}/file`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(r => r.data.data)
  },

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
    return axiosInstance
      .post<ApiResponse<KbDocument>>(`${BASE}/legacy/${id}/replace`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
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
}
