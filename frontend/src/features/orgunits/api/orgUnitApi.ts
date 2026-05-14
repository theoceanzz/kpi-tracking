import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import type {
  OrgUnitResponse,
  OrgUnitTreeResponse,
  OrgHierarchyLevelResponse,
  CreateOrgUnitRequest,
  UpdateOrgUnitRequest,
  MoveOrgUnitRequest
} from '@/types/orgUnit'

export const orgUnitApi = {
  getRoles: () =>
    axiosInstance.get<ApiResponse<any[]>>('/roles').then((r) => r.data.data),

  getOrganization: (organizationId: string) =>
    axiosInstance.get<ApiResponse<any>>(`/organizations/${organizationId}`).then((r) => r.data.data),

  getTree: (organizationId: string) =>
    axiosInstance
      .get<ApiResponse<OrgUnitTreeResponse[]>>(`/organizations/${organizationId}/units/tree`)
      .then((r) => r.data.data),

  getById: (organizationId: string, unitId: string) =>
    axiosInstance
      .get<ApiResponse<OrgUnitResponse>>(`/organizations/${organizationId}/units/${unitId}`)
      .then((r) => r.data.data),

  getSubtree: (organizationId: string, unitId: string) =>
    axiosInstance
      .get<ApiResponse<OrgUnitTreeResponse[]>>(`/organizations/${organizationId}/units/${unitId}/subtree`)
      .then((r) => r.data.data),

  getHierarchyLevels: (organizationId: string) =>
    axiosInstance
      .get<ApiResponse<OrgHierarchyLevelResponse[]>>(`/organizations/${organizationId}/units/hierarchy-levels`)
      .then((r) => r.data.data),

  create: (organizationId: string, data: CreateOrgUnitRequest) =>
    axiosInstance
      .post<ApiResponse<OrgUnitResponse>>(`/organizations/${organizationId}/units`, data)
      .then((r) => r.data.data),

  update: (organizationId: string, unitId: string, data: UpdateOrgUnitRequest) =>
    axiosInstance
      .put<ApiResponse<OrgUnitResponse>>(`/organizations/${organizationId}/units/${unitId}`, data)
      .then((r) => r.data.data),

  delete: (organizationId: string, unitId: string) =>
    axiosInstance
      .delete<ApiResponse<void>>(`/organizations/${organizationId}/units/${unitId}`)
      .then((r) => r.data),

  move: (organizationId: string, unitId: string, data: MoveOrgUnitRequest) =>
    axiosInstance
      .put<ApiResponse<OrgUnitResponse>>(`/organizations/${organizationId}/units/${unitId}/move`, data)
      .then((r) => r.data.data),

  uploadLogo: (organizationId: string, unitId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return axiosInstance
      .post<ApiResponse<OrgUnitResponse>>(`/organizations/${organizationId}/units/${unitId}/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data.data)
  },
}
