import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import type {
  CertificateCatalog,
  CertificateTemplate,
  CertificateTemplateRequest,
  RewardGrant,
} from '../types'

const BASE = '/reward-certificate-templates'

export const certificateApi = {
  /** Mẫu đang bật + nhận diện tổ chức. Ai có ví điểm đều gọi được. */
  getCatalog: () =>
    axiosInstance.get<ApiResponse<CertificateCatalog>>(BASE).then((r) => r.data.data),

  /** Màn hình quản trị: lấy cả mẫu đang tắt. */
  getCatalogForManage: () =>
    axiosInstance.get<ApiResponse<CertificateCatalog>>(`${BASE}/manage`).then((r) => r.data.data),

  create: (data: CertificateTemplateRequest) =>
    axiosInstance.post<ApiResponse<CertificateTemplate>>(BASE, data).then((r) => r.data.data),

  update: (id: string, data: CertificateTemplateRequest) =>
    axiosInstance
      .put<ApiResponse<CertificateTemplate>>(`${BASE}/${id}`, data)
      .then((r) => r.data.data),

  delete: (id: string) =>
    axiosInstance.delete<ApiResponse<void>>(`${BASE}/${id}`).then((r) => r.data),

  /** Chữ ký scan, con dấu, ảnh nền — trả về URL công khai để nhúng vào mẫu. */
  uploadImage: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return axiosInstance
      .post<ApiResponse<{ url: string }>>(`${BASE}/images`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data.data.url)
  },

  /**
   * Các lần chính mình được thưởng (chỉ những lần đã duyệt), để tự in chứng nhận.
   * Backend chỉ trả về phần của người gọi, không kèm người nhận khác.
   */
  getMyAwards: (page = 0, size = 20) =>
    axiosInstance
      .get<ApiResponse<PageResponse<RewardGrant>>>('/reward-grants/my-awards', {
        params: { page, size },
      })
      .then((r) => r.data.data),
}
