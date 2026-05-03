import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import type { 
  OrgUnitTreeResponse, 
  HierarchyLevelResponse, 
  CreateOrgUnitRequest, 
  UpdateOrgUnitRequest,
  OrgUnitResponse,
  ProvinceResponse,
  DistrictResponse
} from '../types/org-unit'

export const orgUnitApi = {
  getOrganization: (orgId: string) =>
    axiosInstance.get<ApiResponse<any>>(`/organizations/${orgId}`).then((r) => r.data.data),

  getTree: (orgId: string) =>
    axiosInstance.get<ApiResponse<OrgUnitTreeResponse[]>>(`/organizations/${orgId}/units/tree`).then((r) => r.data.data),

  getHierarchyLevels: (orgId: string) =>
    axiosInstance.get<ApiResponse<HierarchyLevelResponse[]>>(`/organizations/${orgId}/hierarchy-levels`).then((r) => r.data.data),

  getById: (orgId: string, unitId: string) =>
    axiosInstance.get<ApiResponse<OrgUnitResponse>>(`/organizations/${orgId}/units/${unitId}`).then((r) => r.data.data),

  createNode: (orgId: string, payload: CreateOrgUnitRequest) =>
    axiosInstance.post<ApiResponse<OrgUnitResponse>>(`/organizations/${orgId}/units`, payload).then((r) => r.data.data),

  updateNode: (orgId: string, unitId: string, payload: UpdateOrgUnitRequest) =>
    axiosInstance.put<ApiResponse<OrgUnitResponse>>(`/organizations/${orgId}/units/${unitId}`, payload).then((r) => r.data.data),

  deleteNode: (orgId: string, unitId: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/organizations/${orgId}/units/${unitId}`).then((r) => r.data),

  uploadLogo: (orgId: string, unitId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return axiosInstance.post<ApiResponse<OrgUnitResponse>>(`/organizations/${orgId}/units/${unitId}/logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then((r) => r.data.data)
  },

  getProvinces: () =>
    axiosInstance.get<ApiResponse<ProvinceResponse[]>>('/provinces').then((r) => r.data.data),

  getDistricts: (provinceId: string) =>
    axiosInstance.get<ApiResponse<DistrictResponse[]>>(`/provinces/${provinceId}/districts`).then((r) => r.data.data),

  getSubtree: (orgId: string, unitId: string) =>
    axiosInstance.get<ApiResponse<OrgUnitTreeResponse[]>>(`/organizations/${orgId}/units/${unitId}/subtree`).then((r) => r.data.data),
}
