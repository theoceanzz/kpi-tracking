import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'

export interface HierarchyLevel {
  id?: string
  levelOrder: number
  unitTypeName: string
  managerRoleLabel: string
  roleLevel: number
}

export interface EvaluationLevel {
  id?: string
  name: string
  threshold: number
  color?: string
}

export interface QualitativeLevel {
  id?: string
  name: string
  value: number
  position: number
  color?: string
}

export interface PerformanceMatrix {
  rowHeader?: string
  colHeader?: string
  rows: string[]
  cols: string[]
  cells: number[][]
}

export interface OrganizationResponse {
  id: string
  name: string
  code: string
  status: string
  hierarchyLevels: HierarchyLevel[]
  evaluationMaxScore: number
  evaluationLevels?: EvaluationLevel[]
  qualitativeLevels?: QualitativeLevel[]
  performanceMatrix?: string
  kpiReminderPercentage: number
  enableOkr: boolean
  enableWaterfall: boolean
  enableAi: boolean
  enableQualitative: boolean
  enableBsc: boolean
  createdAt: string
  updatedAt: string
}

export interface UpdateOrganizationRequest {
  name?: string
  code?: string
  status?: string
  hierarchyLevels?: Omit<HierarchyLevel, 'id' | 'levelOrder'>[]
  evaluationMaxScore?: number
  evaluationLevels?: EvaluationLevel[]
  qualitativeLevels?: QualitativeLevel[]
  performanceMatrix?: string
  kpiReminderPercentage?: number
  enableOkr?: boolean
  enableWaterfall?: boolean
  enableQualitative?: boolean
  enableBsc?: boolean
}

export const organizationApi = {
  getById: (id: string) => 
    axiosInstance.get<ApiResponse<OrganizationResponse>>(`/organizations/${id}`).then(r => r.data.data),
  
  update: (id: string, data: UpdateOrganizationRequest) =>
    axiosInstance.put<ApiResponse<OrganizationResponse>>(`/organizations/${id}`, data).then(r => r.data.data)
}
