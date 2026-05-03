import axiosInstance from '@/lib/axios'
import { ApiResponse } from '@/types/api'

export interface UserRoleOrgUnitResponse {
  userId: string
  userFullName: string
  userEmail: string
  roleId: string
  roleName: string
  orgUnitId: string
  orgUnitName: string
  assignedAt: string
}

export interface AssignRoleRequest {
  userId: string
  roleId: string
  orgUnitId: string
  expiresAt?: string
}

export interface BulkAssignRoleRequest {
  userIds: string[]
  roleId: string
  orgUnitId: string
  expiresAt?: string
}

export const userRoleApi = {
  getByOrgUnit: async (orgUnitId: string) => {
    const response = await axiosInstance.get<ApiResponse<UserRoleOrgUnitResponse[]>>(`/user-roles/org-unit/${orgUnitId}`)
    return response.data.data
  },

  getUserRoles: async (userId: string) => {
    const response = await axiosInstance.get<ApiResponse<UserRoleOrgUnitResponse[]>>(`/user-roles/user/${userId}`)
    return response.data.data
  },

  assignRole: async (request: AssignRoleRequest) => {
    const response = await axiosInstance.post<ApiResponse<UserRoleOrgUnitResponse>>('/user-roles/assign', request)
    return response.data.data
  },

  bulkAssignRole: async (request: BulkAssignRoleRequest) => {
    const response = await axiosInstance.post<ApiResponse<UserRoleOrgUnitResponse[]>>('/user-roles/assign/bulk', request)
    return response.data.data
  },

  revokeRole: async (userId: string, roleId: string, orgUnitId: string) => {
    await axiosInstance.delete('/user-roles/revoke', {
      params: { userId, roleId, orgUnitId }
    })
  }
}
