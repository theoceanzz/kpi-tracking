import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'

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
  userCount: number
  createdAt: string
  updatedAt: string
}

export interface UpdateOrgFeaturesRequest {
  enableAi?: boolean
  enableOkr?: boolean
  enableWaterfall?: boolean
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
}
