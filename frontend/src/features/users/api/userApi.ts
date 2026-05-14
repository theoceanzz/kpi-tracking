import { ApiResponse, PageParams, PageResponse } from '@/types/api'
import type { User, ImportUserResult, CreateUserRequest, UpdateUserRequest } from '@/types/user'
import axiosInstance from '@/lib/axios'

export const userApi = {
  getAll: (params: PageParams & { keyword?: string; orgUnitId?: string; organizationId?: string; role?: string; sortBy?: string; direction?: string }) =>
    axiosInstance.get<ApiResponse<PageResponse<User>>>('/users', { params }).then((r) => r.data.data),

  getUser: (id: string) =>
    axiosInstance.get<ApiResponse<User>>(`/users/${id}`).then((r) => r.data.data),

  create: (data: CreateUserRequest) =>
    axiosInstance.post<ApiResponse<User>>('/users', data).then((r) => r.data.data),

  update: (id: string, data: UpdateUserRequest) =>
    axiosInstance.put<ApiResponse<User>>(`/users/${id}`, data).then((r) => r.data.data),

  delete: (id: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/users/${id}`).then((r) => r.data),

  importFile: (file: File, orgUnitId?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    return axiosInstance.post<ApiResponse<ImportUserResult>>('/users/import', formData, {
      params: { orgUnitId },
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data.data)
  },
}
