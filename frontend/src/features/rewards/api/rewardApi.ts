import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import type {
  CreateRewardGrantRequest,
  GrantDecisionRequest,
  RewardActivity,
  RewardBudget,
  RewardBudgetRequest,
  RewardGrant,
  RewardGrantStatus,
  RewardTransaction,
  RewardWallet,
  RevokePreview,
} from '../types'

export const rewardApi = {
  // ── Ví & sổ cái ────────────────────────────────────────────────
  getMyWallet: () =>
    axiosInstance.get<ApiResponse<RewardWallet>>('/rewards/me').then((r) => r.data.data),

  getMyTransactions: (page = 0, size = 20) =>
    axiosInstance
      .get<ApiResponse<PageResponse<RewardTransaction>>>('/rewards/me/transactions', {
        params: { page, size },
      })
      .then((r) => r.data.data),

  searchWallets: (params: { keyword?: string; page?: number; size?: number }) =>
    axiosInstance
      .get<ApiResponse<PageResponse<RewardWallet>>>('/rewards/wallets', { params })
      .then((r) => r.data.data),

  getUserTransactions: (userId: string, page = 0, size = 20) =>
    axiosInstance
      .get<ApiResponse<PageResponse<RewardTransaction>>>(`/rewards/users/${userId}/transactions`, {
        params: { page, size },
      })
      .then((r) => r.data.data),

  /** Bảng tin cả tổ chức: ai được thưởng, ai được cấp hạn mức, ai đổi quà. */
  /**
   * Nhận thưởng nhiều nhất trong khoảng. Khác `getActivityFeed` — bảng tin bị chặn ở 50
   * bản ghi gần nhất nên không cộng dồn được; endpoint này tổng hợp ngay tại DB.
   */
  getLeaderboard: (params: { from?: string; to?: string; limit?: number } = {}) =>
    axiosInstance
      .get<ApiResponse<RewardLeaderboardEntry[]>>('/rewards/leaderboard', { params })
      .then((r) => r.data.data),

  /** Điểm phát ra / tiêu đi theo từng tháng, gồm cả tháng không có giao dịch. */
  getMonthlySummary: (months = 6) =>
    axiosInstance
      .get<ApiResponse<RewardMonthlySummary[]>>('/rewards/monthly-summary', { params: { months } })
      .then((r) => r.data.data),

  getActivityFeed: (limit = 30) =>
    axiosInstance
      .get<ApiResponse<RewardActivity[]>>('/rewards/activity', { params: { limit } })
      .then((r) => r.data.data),

  // ── Đề nghị thưởng ─────────────────────────────────────────────
  getGrants: (params: {
    status?: RewardGrantStatus
    grantorId?: string
    page?: number
    size?: number
  }) =>
    axiosInstance
      .get<ApiResponse<PageResponse<RewardGrant>>>('/reward-grants', { params })
      .then((r) => r.data.data),

  getGrant: (id: string) =>
    axiosInstance.get<ApiResponse<RewardGrant>>(`/reward-grants/${id}`).then((r) => r.data.data),

  createGrant: (data: CreateRewardGrantRequest) =>
    axiosInstance.post<ApiResponse<RewardGrant>>('/reward-grants', data).then((r) => r.data.data),

  approveGrant: (id: string, data?: GrantDecisionRequest) =>
    axiosInstance
      .post<ApiResponse<RewardGrant>>(`/reward-grants/${id}/approve`, data ?? {})
      .then((r) => r.data.data),

  rejectGrant: (id: string, data?: GrantDecisionRequest) =>
    axiosInstance
      .post<ApiResponse<RewardGrant>>(`/reward-grants/${id}/reject`, data ?? {})
      .then((r) => r.data.data),

  cancelGrant: (id: string) =>
    axiosInstance
      .post<ApiResponse<RewardGrant>>(`/reward-grants/${id}/cancel`)
      .then((r) => r.data.data),

  /** Xem trước ai bị trừ bao nhiêu, ai sẽ âm số dư — gọi trước khi thu hồi. */
  previewRevoke: (id: string) =>
    axiosInstance
      .get<ApiResponse<RevokePreview>>(`/reward-grants/${id}/revoke-preview`)
      .then((r) => r.data.data),

  revokeGrant: (id: string, data?: GrantDecisionRequest) =>
    axiosInstance
      .post<ApiResponse<RewardGrant>>(`/reward-grants/${id}/revoke`, data ?? {})
      .then((r) => r.data.data),

  // ── Ngân sách ──────────────────────────────────────────────────
  /** Trả về null khi người dùng chưa được cấp hạn mức. */
  getMyBudget: () =>
    axiosInstance
      .get<ApiResponse<RewardBudget | null>>('/reward-budgets/me')
      .then((r) => r.data.data),

  getBudgets: () =>
    axiosInstance.get<ApiResponse<RewardBudget[]>>('/reward-budgets').then((r) => r.data.data),

  createBudget: (data: RewardBudgetRequest) =>
    axiosInstance.post<ApiResponse<RewardBudget>>('/reward-budgets', data).then((r) => r.data.data),

  updateBudget: (id: string, data: RewardBudgetRequest) =>
    axiosInstance
      .put<ApiResponse<RewardBudget>>(`/reward-budgets/${id}`, data)
      .then((r) => r.data.data),

  deleteBudget: (id: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/reward-budgets/${id}`).then((r) => r.data),
}

/** Khớp BE: RewardLeaderboardEntryResponse. */
export interface RewardLeaderboardEntry {
  userId: string
  userName: string
  userAvatarUrl: string | null
  totalPoints: number
}

/** Khớp BE: RewardMonthlySummaryResponse. Tháng dạng `yyyy-MM`. */
export interface RewardMonthlySummary {
  month: string
  earned: number
  spent: number
}
