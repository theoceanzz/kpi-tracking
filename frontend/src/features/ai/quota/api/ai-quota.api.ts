import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'

/** Hạn mức của chính mình — hiện ở widget chat và trang trợ lý AI. */
export interface AiQuotaStatus {
  monthlyLimit: number
  /** Phần đã chia cho cấp dưới, không tự tiêu được nữa. */
  allocatedToOthers: number
  /** Phần thực sự tiêu được = monthlyLimit - allocatedToOthers. */
  spendable: number
  used: number
  remaining: number
}

export interface AiQuotaOverview {
  canAllocate: boolean
  isTopManager: boolean
  subDelegationEnabled: boolean
  /** Ngân sách công ty do quản trị nền tảng cấp. */
  companyMonthlyLimit: number
  /** Túi mà người này được chia: ngân sách công ty, hoặc hạn mức riêng. */
  allocatablePool: number
  allocated: number
  remainingToAllocate: number
  /** Vai trò có mặt trong phạm vi, để đổ vào ô lọc. */
  availableRoles: string[]
}

export interface AiQuotaAllocation {
  userId: string
  fullName: string
  email: string
  /** Vai trò cao nhất (rank nhỏ nhất) của người này. */
  roleName: string | null
  orgUnitName: string | null
  monthlyLimit: number
  usedThisMonth: number
  /** Sửa được khi: chưa ai cấp, mình cấp, hoặc do một người dưới quyền mình cấp. */
  editable: boolean
  /** Tên người đã cấp; null nghĩa là cấp thẳng từ ngân sách công ty. */
  allocatedByName: string | null
  /**
   * Sửa dòng này là giành quyền cấp từ người khác — hạn mức mới bị trừ TRỌN VẸN vào túi mình
   * chứ không phải phần chênh lệch, nên phép kiểm "vượt hạn mức" ở giao diện phải tính khác.
   */
  takeover: boolean
}

/** Bỏ trống là lấy tất cả. */
export type AiQuotaStatusFilter = '' | 'UNALLOCATED' | 'ALLOCATED' | 'NEAR_LIMIT'

export interface AiQuotaAllocationParams {
  keyword?: string
  roleName?: string
  status?: AiQuotaStatusFilter
  page?: number
  size?: number
}

export const aiQuotaApi = {
  getMyQuota: () =>
    axiosInstance.get<ApiResponse<AiQuotaStatus>>('/ai/quota/me').then((r) => r.data.data),

  getOverview: () =>
    axiosInstance.get<ApiResponse<AiQuotaOverview>>('/ai/quota/overview').then((r) => r.data.data),

  getAllocations: (params: AiQuotaAllocationParams = {}) =>
    axiosInstance
      .get<ApiResponse<PageResponse<AiQuotaAllocation>>>('/ai/quota/allocations', {
        params: {
          keyword: params.keyword || undefined,
          roleName: params.roleName || undefined,
          status: params.status || undefined,
          page: params.page ?? 0,
          size: params.size ?? 10,
        },
      })
      .then((r) => r.data.data),

  setUserLimit: (userId: string, monthlyLimit: number) =>
    axiosInstance.put<ApiResponse<void>>(`/ai/quota/allocations/${userId}`, { monthlyLimit })
      .then((r) => r.data),

  setDelegation: (enabled: boolean) =>
    axiosInstance.put<ApiResponse<void>>('/ai/quota/delegation', { enabled }).then((r) => r.data),
}
