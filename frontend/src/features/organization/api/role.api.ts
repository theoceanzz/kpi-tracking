import axiosInstance from '@/lib/axios'
import { ApiResponse } from '@/types/api'

export interface RoleResponse {
  id: string
  name: string
  isSystem: boolean
  level?: number
  rank?: number
  createdAt: string
  updatedAt: string
}

export interface CreateRoleRequest {
  name: string
  level: number
  rank: number
}

export interface UpdateRoleRequest {
  name?: string
  level?: number
  rank?: number
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
