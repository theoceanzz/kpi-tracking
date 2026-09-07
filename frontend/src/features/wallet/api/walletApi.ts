import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import type {
  CashTransaction,
  CashWallet,
  CashWalletSummary,
  ConversionQuote,
  ConvertToPointsRequest,
  CreateTopupRequest,
  ResolveSepayEventRequest,
  SepayEvent,
  TopupOrder,
  WalletConfig,
  WalletConfigRequest,
  WalletReconcile,
} from '../types'

export const walletApi = {
  // ── Ví của tôi ─────────────────────────────────────────────────
  getMyWallet: () =>
    axiosInstance.get<ApiResponse<CashWallet>>('/cash/me').then((r) => r.data.data),

  getMyTransactions: (page = 0, size = 20) =>
    axiosInstance
      .get<ApiResponse<PageResponse<CashTransaction>>>('/cash/me/transactions', {
        params: { page, size },
      })
      .then((r) => r.data.data),

  // ── Nạp tiền ───────────────────────────────────────────────────
  createTopup: (data: CreateTopupRequest) =>
    axiosInstance.post<ApiResponse<TopupOrder>>('/cash/topups', data).then((r) => r.data.data),

  getMyTopups: (page = 0, size = 20) =>
    axiosInstance
      .get<ApiResponse<PageResponse<TopupOrder>>>('/cash/topups/me', { params: { page, size } })
      .then((r) => r.data.data),

  getTopup: (id: string) =>
    axiosInstance.get<ApiResponse<TopupOrder>>(`/cash/topups/${id}`).then((r) => r.data.data),

  cancelTopup: (id: string) =>
    axiosInstance
      .post<ApiResponse<TopupOrder>>(`/cash/topups/${id}/cancel`)
      .then((r) => r.data.data),

  // ── Quy đổi ────────────────────────────────────────────────────
  quote: (points: number) =>
    axiosInstance
      .get<ApiResponse<ConversionQuote>>('/cash/convert/quote', { params: { points } })
      .then((r) => r.data.data),

  convert: (data: ConvertToPointsRequest) =>
    axiosInstance.post<ApiResponse<ConversionQuote>>('/cash/convert', data).then((r) => r.data.data),

  // ── Ví nhân sự ─────────────────────────────────────────────────
  searchWallets: (params: {
    keyword?: string
    /** Bao trọn cả cây con — backend lọc theo tiền tố path nên chỉ cần gửi một id. */
    orgUnitId?: string
    onlyInconsistent?: boolean
    page?: number
    size?: number
  }) =>
    axiosInstance
      .get<ApiResponse<PageResponse<CashWallet>>>('/cash/wallets', { params })
      .then((r) => r.data.data),

  getWalletSummary: () =>
    axiosInstance
      .get<ApiResponse<CashWalletSummary>>('/cash/wallets/summary')
      .then((r) => r.data.data),

  getUserTransactions: (userId: string, page = 0, size = 20) =>
    axiosInstance
      .get<ApiResponse<PageResponse<CashTransaction>>>(`/cash/users/${userId}/transactions`, {
        params: { page, size },
      })
      .then((r) => r.data.data),

  // ── Cấu hình ───────────────────────────────────────────────────
  getConfig: () =>
    axiosInstance.get<ApiResponse<WalletConfig>>('/cash/config').then((r) => r.data.data),

  updateConfig: (data: WalletConfigRequest) =>
    axiosInstance.put<ApiResponse<WalletConfig>>('/cash/config', data).then((r) => r.data.data),

  // ── Đối soát ───────────────────────────────────────────────────
  getSepayEvents: (params: { scope?: 'queue' | 'all'; page?: number; size?: number }) =>
    axiosInstance
      .get<ApiResponse<PageResponse<SepayEvent>>>('/cash/sepay-events', { params })
      .then((r) => r.data.data),

  resolveSepayEvent: (id: string, data: ResolveSepayEventRequest) =>
    axiosInstance
      .post<ApiResponse<SepayEvent>>(`/cash/sepay-events/${id}/resolve`, data)
      .then((r) => r.data.data),

  reconcile: () =>
    axiosInstance.get<ApiResponse<WalletReconcile>>('/cash/reconcile').then((r) => r.data.data),
}
