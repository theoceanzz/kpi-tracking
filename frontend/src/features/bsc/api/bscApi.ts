import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import { PerspectiveResponse, PerspectiveRequest, ImportBscResponse } from '../types'

export const bscApi = {
  getPerspectives: (organizationId: string) =>
    axiosInstance
      .get<ApiResponse<PerspectiveResponse[]>>(`/bsc/organization/${organizationId}/perspectives`)
      .then(r => r.data.data),

  createPerspective: (organizationId: string, data: PerspectiveRequest) =>
    axiosInstance
      .post<ApiResponse<PerspectiveResponse>>(`/bsc/organization/${organizationId}/perspectives`, data)
      .then(r => r.data.data),

  updatePerspective: (perspectiveId: string, data: PerspectiveRequest) =>
    axiosInstance
      .put<ApiResponse<PerspectiveResponse>>(`/bsc/perspectives/${perspectiveId}`, data)
      .then(r => r.data.data),

  deletePerspective: (perspectiveId: string) =>
    axiosInstance
      .delete<ApiResponse<void>>(`/bsc/perspectives/${perspectiveId}`)
      .then(r => r.data.data),

  importPerspectives: (organizationId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return axiosInstance
      .post<ApiResponse<ImportBscResponse>>(`/bsc/organization/${organizationId}/perspectives/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data.data)
  },
}
