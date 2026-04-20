import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse, PageParams } from '@/types/api'
import type { User, CreateUserRequest, UpdateUserRequest, ImportUserResult } from '@/types/user'

export const userApi = {
  getAll: (params: PageParams & { keyword?: string; orgUnitId?: string }) =>
    axiosInstance.get<ApiResponse<PageResponse<User>>>('/users', { params }).then((r) => r.data.data),

  getById: (id: string) =>
    axiosInstance.get<ApiResponse<User>>(`/users/${id}`).then((r) => r.data.data),

  create: (data: CreateUserRequest) =>
    axiosInstance.post<ApiResponse<User>>('/users', data).then((r) => r.data.data),

  update: (id: string, data: UpdateUserRequest) =>
    axiosInstance.put<ApiResponse<User>>(`/users/${id}`, data).then((r) => r.data.data),

  delete: (id: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/users/${id}`).then((r) => r.data),

  importFile: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return axiosInstance.post<ApiResponse<ImportUserResult>>('/users/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data.data)
  },
}
