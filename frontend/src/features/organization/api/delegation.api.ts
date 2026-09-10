import axiosInstance from '@/lib/axios'
import { ApiResponse } from '@/types/api'

/**
 * Uỷ quyền quản lý CHÉO đơn vị.
 *
 * Quyền trong hệ thống chỉ chảy xuống theo cây tổ chức, nên trưởng đơn vị A không với sang
 * được đơn vị B cùng cấp. Bản ghi ở đây nới PHẠM VI của bộ quyền người đó đang có sang đơn
 * vị đích — không cấp quyền mới.
 */
export interface DelegationResponse {
  id: string
  delegateUserId: string
  delegateUserName: string
  delegateUserEmail: string
  delegateUserAvatarUrl?: string | null
  /** Vai trò của người này ở đơn vị gốc — để biết ai đang kiêm nhiệm. */
  delegateRoleName?: string | null
  orgUnitId: string
  orgUnitName: string
  fromOrgUnitId?: string | null
  fromOrgUnitName?: string | null
  includeSubtree: boolean
  /** Được ký thay vai trò trưởng đơn vị đích (chấm hạnh kiểm). */
  canActAsLeader: boolean
  reason?: string | null
  startsAt?: string | null
  expiresAt?: string | null
  /** Server tính sẵn để UI khỏi tự so ngày. */
  active: boolean
  scheduled: boolean
  expired: boolean
  createdByName?: string | null
  createdAt?: string | null
}

export interface DelegationRequest {
  delegateUserId: string
  /** Giao nhiều đơn vị trong MỘT lần gọi — server tạo cả lô trong một giao dịch. */
  orgUnitIds: string[]
  fromOrgUnitId?: string | null
  includeSubtree?: boolean
  canActAsLeader?: boolean
  reason?: string | null
  startsAt?: string | null
  expiresAt?: string | null
}

export const delegationApi = {
  list: async (organizationId: string) => {
    const res = await axiosInstance.get<ApiResponse<DelegationResponse[]>>(`/delegations/${organizationId}`)
    return res.data.data
  },

  create: async (organizationId: string, request: DelegationRequest) => {
    const res = await axiosInstance.post<ApiResponse<DelegationResponse[]>>(`/delegations/${organizationId}`, request)
    return res.data.data
  },

  revoke: async (id: string) => {
    await axiosInstance.delete(`/delegations/${id}`)
  },
}
