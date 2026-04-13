import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import type { Department, CreateDepartmentRequest, UpdateDepartmentRequest, DepartmentMember, AddMemberRequest } from '@/types/department'

export const departmentApi = {
  getAll: (page = 0, size = 20) =>
    axiosInstance.get<ApiResponse<PageResponse<Department>>>('/departments', { params: { page, size } }).then((r) => r.data.data),

  getById: (id: string) =>
    axiosInstance.get<ApiResponse<Department>>(`/departments/${id}`).then((r) => r.data.data),

  create: (data: CreateDepartmentRequest) =>
    axiosInstance.post<ApiResponse<Department>>('/departments', data).then((r) => r.data.data),

  update: (id: string, data: UpdateDepartmentRequest) =>
    axiosInstance.put<ApiResponse<Department>>(`/departments/${id}`, data).then((r) => r.data.data),

  delete: (id: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/departments/${id}`).then((r) => r.data),

  getMembers: (id: string) =>
    axiosInstance.get<ApiResponse<DepartmentMember[]>>(`/departments/${id}/members`).then((r) => r.data.data),

  addMember: (id: string, data: AddMemberRequest) =>
    axiosInstance.post<ApiResponse<DepartmentMember>>(`/departments/${id}/members`, data).then((r) => r.data.data),

  removeMember: (departmentId: string, userId: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/departments/${departmentId}/members/${userId}`).then((r) => r.data),
}
