import axiosInstance from '@/lib/axios'
import { ApiResponse } from '@/types/api'

export interface RoleResponse {
  id: string
  name: string
  parentRoleName?: string
  parentRoleId?: string
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateRoleRequest {
  name: string
  parentRoleId?: string
}

export interface UpdateRoleRequest {
  name?: string
  parentRoleId?: string
}

export const roleApi = {
  listRoles: async () => {
    const response = await axiosInstance.get<ApiResponse<RoleResponse[]>>('/roles')
    return response.data.data
  },

  getRole: async (roleId: string) => {
    const response = await axiosInstance.get<ApiResponse<RoleResponse>>(`/roles/${roleId}`)
    return response.data.data
  },

  createRole: async (payload: CreateRoleRequest) => {
    const response = await axiosInstance.post<ApiResponse<RoleResponse>>('/roles', payload)
    return response.data.data
  },

  updateRole: async (roleId: string, payload: UpdateRoleRequest) => {
    const response = await axiosInstance.put<ApiResponse<RoleResponse>>(`/roles/${roleId}`, payload)
    return response.data.data
  },

  deleteRole: async (roleId: string) => {
    const response = await axiosInstance.delete<ApiResponse<void>>(`/roles/${roleId}`)
    return response.data
  }
}
