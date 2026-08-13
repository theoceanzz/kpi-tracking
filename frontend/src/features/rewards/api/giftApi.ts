import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import type {
  CreateRedemptionRequest,
  GiftItem,
  GiftItemRequest,
  Redemption,
  RedemptionStatus,
} from '../types'

export const giftApi = {
  // ── Danh mục quà ───────────────────────────────────────────────
  /** Cửa hàng cho nhân viên: chỉ quà đang bật, kèm cờ đủ điểm. */
  getShop: () =>
    axiosInstance.get<ApiResponse<GiftItem[]>>('/reward-gifts').then((r) => r.data.data),

  /** Màn hình quản trị: lấy cả quà đang tắt. */
  getForManage: () =>
    axiosInstance.get<ApiResponse<GiftItem[]>>('/reward-gifts/manage').then((r) => r.data.data),

  create: (data: GiftItemRequest) =>
    axiosInstance.post<ApiResponse<GiftItem>>('/reward-gifts', data).then((r) => r.data.data),

  update: (id: string, data: GiftItemRequest) =>
    axiosInstance.put<ApiResponse<GiftItem>>(`/reward-gifts/${id}`, data).then((r) => r.data.data),

  delete: (id: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/reward-gifts/${id}`).then((r) => r.data),

  uploadImage: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return axiosInstance
      .post<ApiResponse<{ url: string }>>('/reward-gifts/images', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data.data.url)
  },

  // ── Yêu cầu đổi quà ────────────────────────────────────────────
  getMyRedemptions: (page = 0, size = 20) =>
    axiosInstance
      .get<ApiResponse<PageResponse<Redemption>>>('/reward-redemptions/me', {
        params: { page, size },
      })
      .then((r) => r.data.data),

  redeem: (data: CreateRedemptionRequest) =>
    axiosInstance
      .post<ApiResponse<Redemption>>('/reward-redemptions', data)
      .then((r) => r.data.data),

  cancelRedemption: (id: string) =>
    axiosInstance
      .post<ApiResponse<Redemption>>(`/reward-redemptions/${id}/cancel`)
      .then((r) => r.data.data),

  getRedemptions: (params: { status?: RedemptionStatus; page?: number; size?: number }) =>
    axiosInstance
      .get<ApiResponse<PageResponse<Redemption>>>('/reward-redemptions', { params })
      .then((r) => r.data.data),

  approveRedemption: (id: string, note?: string) =>
    axiosInstance
      .post<ApiResponse<Redemption>>(`/reward-redemptions/${id}/approve`, { note })
      .then((r) => r.data.data),

  rejectRedemption: (id: string, note?: string) =>
    axiosInstance
      .post<ApiResponse<Redemption>>(`/reward-redemptions/${id}/reject`, { note })
      .then((r) => r.data.data),

  deliverRedemption: (id: string, note?: string) =>
    axiosInstance
      .post<ApiResponse<Redemption>>(`/reward-redemptions/${id}/deliver`, { note })
      .then((r) => r.data.data),
}
