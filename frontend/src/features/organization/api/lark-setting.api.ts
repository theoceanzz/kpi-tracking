import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import type { LarkAuthorizeUrl } from '@/types/auth'

export type LarkConnectionMode = 'CUSTOM_APP' | 'STORE'

/** Khớp BE: LarkSettingsResponse. Cố tình không có appSecret và tenantKey. */
export interface LarkSettings {
  connectionMode: LarkConnectionMode
  larkEnabled: boolean
  appId: string | null
  hasAppSecret: boolean
  tenantName: string | null
  tenantAvatarUrl: string | null
  verifiedAt: string | null
  defaultOrgUnitId: string | null
  defaultRoleId: string | null
  redirectUri: string
  requiredScopes: string[]
  /** Còn thiếu gì trước khi bật được. Rỗng nghĩa là sẵn sàng. */
  missingRequirements: string[]
}

export interface UpdateLarkSettingsRequest {
  connectionMode?: LarkConnectionMode
  appId?: string
  /** Bỏ trống nghĩa là giữ nguyên secret đang lưu. */
  appSecret?: string
  defaultOrgUnitId?: string
  defaultRoleId?: string
  larkEnabled?: boolean
}

export interface LarkTestResult {
  ok: boolean
  message: string
}

export interface LarkConnectResult {
  tenantName: string | null
  tenantAvatarUrl: string | null
  /** Tên/logo là giá trị đang lưu chứ không phải vừa lấy từ Lark. */
  usingSavedProfile: boolean
  userName: string | null
  userEmail: string | null
  userAvatarUrl: string | null
  pendingToken: string
  alreadyLinked: boolean
  alreadyLinkedOrganizationName: string | null
}

const base = (orgId: string) => `/organizations/${orgId}/lark-settings`

export const larkSettingApi = {
  get: (orgId: string) =>
    axiosInstance.get<ApiResponse<LarkSettings>>(base(orgId)).then((r) => r.data.data),

  update: (orgId: string, data: UpdateLarkSettingsRequest) =>
    axiosInstance.put<ApiResponse<LarkSettings>>(base(orgId), data).then((r) => r.data.data),

  test: (orgId: string) =>
    axiosInstance.post<ApiResponse<LarkTestResult>>(`${base(orgId)}/test`).then((r) => r.data.data),

  getConnectUrl: (orgId: string) =>
    axiosInstance
      .get<ApiResponse<LarkAuthorizeUrl>>(`${base(orgId)}/connect-url`)
      .then((r) => r.data.data),

  connect: (orgId: string, code: string, state: string) =>
    axiosInstance
      .post<ApiResponse<LarkConnectResult>>(`${base(orgId)}/connect`, { code, state })
      .then((r) => r.data.data),

  confirmConnect: (orgId: string, pendingToken: string) =>
    axiosInstance
      .post<ApiResponse<LarkSettings>>(`${base(orgId)}/connect/confirm`, { pendingToken })
      .then((r) => r.data.data),

  disconnect: (orgId: string) =>
    axiosInstance
      .delete<ApiResponse<LarkSettings>>(`${base(orgId)}/connection`)
      .then((r) => r.data.data),
}
