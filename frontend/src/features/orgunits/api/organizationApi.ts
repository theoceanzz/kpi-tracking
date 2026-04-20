import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'

export interface HierarchyLevel {
  id?: string
  levelOrder: number
  unitTypeName: string
  managerRoleLabel: string
}

export interface OrganizationResponse {
  id: string
  name: string
  code: string
  status: string
  hierarchyLevels: HierarchyLevel[]
  createdAt: string
  updatedAt: string
}

export interface UpdateOrganizationRequest {
  name?: string
  code?: string
  status?: string
  hierarchyLevels?: Omit<HierarchyLevel, 'id' | 'levelOrder'>[]
}

export const organizationApi = {
  getById: (id: string) => 
    axiosInstance.get<ApiResponse<OrganizationResponse>>(`/organizations/${id}`).then(r => r.data.data),
  
  update: (id: string, data: UpdateOrganizationRequest) =>
    axiosInstance.put<ApiResponse<OrganizationResponse>>(`/organizations/${id}`, data).then(r => r.data.data)
}
