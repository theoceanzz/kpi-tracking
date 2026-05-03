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
  evaluationMaxScore: number
  excellentThreshold: number
  goodThreshold: number
  fairThreshold: number
  averageThreshold: number
  kpiReminderPercentage: number
  createdAt: string
  updatedAt: string
}

export interface UpdateOrganizationRequest {
  name?: string
  code?: string
  status?: string
  hierarchyLevels?: Omit<HierarchyLevel, 'id' | 'levelOrder'>[]
  evaluationMaxScore?: number
  excellentThreshold?: number
  goodThreshold?: number
  fairThreshold?: number
  averageThreshold?: number
  kpiReminderPercentage?: number
}

export const organizationApi = {
  getById: (id: string) => 
    axiosInstance.get<ApiResponse<OrganizationResponse>>(`/organizations/${id}`).then(r => r.data.data),
  
  update: (id: string, data: UpdateOrganizationRequest) =>
    axiosInstance.put<ApiResponse<OrganizationResponse>>(`/organizations/${id}`, data).then(r => r.data.data)
}
