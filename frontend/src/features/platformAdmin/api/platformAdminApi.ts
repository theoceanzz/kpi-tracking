import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import { AI_TIMEOUT, type RagChunk, type RagDocument, type RagSearchHit } from '@/features/analytics/api/aiApi'

export interface PlatformAdminStats {
  totalOrgs: number
  orgsByStatus: Record<string, number>
  totalUsers: number
  newUsersThisMonth: number
  totalKpiCriteria: number
  totalSubmissionsThisMonth: number
  orgsWithAiEnabled: number
  totalAiConversations: number
  totalAiMessages: number
}

export interface OrganizationAdminItem {
  id: string
  name: string
  code: string
  status: string
  enableAi: boolean
  enableOkr: boolean
  enableWaterfall: boolean
  enableQualitative: boolean
  enableBsc: boolean
  enableReward: boolean
  enableCashWallet: boolean
  userCount: number
  createdAt: string
  updatedAt: string
}

export interface UpdateOrgFeaturesRequest {
  enableAi?: boolean
  enableOkr?: boolean
  enableWaterfall?: boolean
}

export interface OrgAiUsage {
  organizationId: string
  organizationName: string
  organizationCode: string
  monthlyLimit: number
  usedTokens: number
  callCount: number
  usagePercent: number | null
}

export interface UpdateOrgStatusRequest {
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'
}

export const platformAdminApi = {
  getStats: () =>
    axiosInstance.get<ApiResponse<PlatformAdminStats>>('/admin/stats'),

  getOrganizations: (page = 0, size = 20) =>
    axiosInstance.get<ApiResponse<PageResponse<OrganizationAdminItem>>>('/admin/organizations', {
      params: { page, size },
    }),

  updateFeatures: (orgId: string, data: UpdateOrgFeaturesRequest) =>
    axiosInstance.patch<ApiResponse<OrganizationAdminItem>>(`/admin/organizations/${orgId}/features`, data),

  updateStatus: (orgId: string, data: UpdateOrgStatusRequest) =>
    axiosInstance.patch<ApiResponse<OrganizationAdminItem>>(`/admin/organizations/${orgId}/status`, data),
  updateAiBudget: (orgId: string, aiMonthlyTokenLimit: number) =>
    axiosInstance.patch<ApiResponse<OrganizationAdminItem>>(
      `/admin/organizations/${orgId}/ai-budget`, { aiMonthlyTokenLimit }),

  getAiUsage: (month?: string) =>
    axiosInstance.get<ApiResponse<OrgAiUsage[]>>('/admin/ai-usage', { params: { month } })
      .then((r) => r.data.data),

  // ── Bộ hướng dẫn KeyGo trong kho tri thức của trợ lý (tài liệu chung, mọi công ty dùng) ──
  listGuideDocuments: () =>
    axiosInstance.get<ApiResponse<RagDocument[]>>('/admin/rag/documents').then((r) => r.data.data),

  /** Nạp đồng bộ (đọc mục, cất ảnh, embedding tại chỗ) — bộ hướng dẫn 16 MB mất vài giây. */
  uploadGuideDocument: (file: File, title?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (title) form.append('title', title)
    return axiosInstance
      .post<ApiResponse<RagDocument>>('/admin/rag/documents', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: AI_TIMEOUT,
      })
      .then((r) => r.data.data)
  },

  deleteGuideDocument: (id: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/admin/rag/documents/${id}`).then((r) => r.data),

  listGuideChunks: (id: string) =>
    axiosInstance.get<ApiResponse<RagChunk[]>>(`/admin/rag/documents/${id}/chunks`).then((r) => r.data.data),

  searchGuide: (q: string) =>
    axiosInstance.get<ApiResponse<RagSearchHit[]>>('/admin/rag/search', { params: { q } }).then((r) => r.data.data),
}
