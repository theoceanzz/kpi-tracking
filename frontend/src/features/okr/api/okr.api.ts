import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import { ObjectiveResponse, ObjectiveRequest, KeyResultResponse, KeyResultRequest } from '../types'

export const okrApi = {
  getObjectivesByOrganization: (organizationId: string) =>
    axiosInstance.get<ApiResponse<ObjectiveResponse[]>>(`/okr/organization/${organizationId}/objectives`).then(r => r.data.data),

  getObjectivesByOrgUnit: (orgUnitId: string) =>
    axiosInstance.get<ApiResponse<ObjectiveResponse[]>>(`/okr/org-unit/${orgUnitId}/objectives`).then(r => r.data.data),

  createObjective: (organizationId: string, data: ObjectiveRequest) =>
    axiosInstance.post<ApiResponse<ObjectiveResponse>>(`/okr/organization/${organizationId}/objectives`, data).then(r => r.data.data),

  updateObjective: (objectiveId: string, data: ObjectiveRequest) =>
    axiosInstance.put<ApiResponse<ObjectiveResponse>>(`/okr/objectives/${objectiveId}`, data).then(r => r.data.data),

  deleteObjective: (objectiveId: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/okr/objectives/${objectiveId}`).then(r => r.data.data),

  createKeyResult: (data: KeyResultRequest) =>
    axiosInstance.post<ApiResponse<KeyResultResponse>>('/okr/key-results', data).then(r => r.data.data),

  updateKeyResult: (keyResultId: string, data: KeyResultRequest) =>
    axiosInstance.put<ApiResponse<KeyResultResponse>>(`/okr/key-results/${keyResultId}`, data).then(r => r.data.data),

  deleteKeyResult: (keyResultId: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/okr/key-results/${keyResultId}`).then(r => r.data.data),

  importOkrs: (organizationId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return axiosInstance.post<ApiResponse<any>>(`/okr/organization/${organizationId}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data.data)
  }
}
