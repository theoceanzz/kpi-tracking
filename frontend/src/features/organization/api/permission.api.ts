import axiosInstance from '@/lib/axios'
import { ApiResponse } from '@/types/api'

export interface PermissionResponse {
  id: string
  code: string
  resource: string
  action: string
}

export interface AssignPermissionRequest {
  permissionIds: string[]
}

export const permissionApi = {
  listAllPermissions: async () => {
    const response = await axiosInstance.get<ApiResponse<PermissionResponse[]>>('/permissions')
    return response.data.data
  },

  getRolePermissions: async (roleId: string) => {
    const response = await axiosInstance.get<ApiResponse<PermissionResponse[]>>(`/permissions/role/${roleId}`)
    return response.data.data
  },

  assignPermissionsToRole: async (roleId: string, permissionIds: string[]) => {
    const response = await axiosInstance.post<ApiResponse<void>>(`/permissions/role/${roleId}`, {
      permissionIds
    })
    return response.data
  },

  removePermissionFromRole: async (roleId: string, permissionId: string) => {
    const response = await axiosInstance.delete<ApiResponse<void>>(`/permissions/role/${roleId}/${permissionId}`)
    return response.data
  }
}
