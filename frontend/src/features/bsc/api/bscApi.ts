import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import {
  PerspectiveResponse, PerspectiveRequest, ImportBscResponse,
  ScorecardResponse, ScorecardRequest, BscDashboardResponse, BscScoringMode,
} from '../types'

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

  // ── Scorecards ──────────────────────────────────────────────
  getScorecards: (organizationId: string) =>
    axiosInstance.get<ApiResponse<ScorecardResponse[]>>(`/bsc/organization/${organizationId}/scorecards`).then(r => r.data.data),

  getScorecard: (scorecardId: string) =>
    axiosInstance.get<ApiResponse<ScorecardResponse>>(`/bsc/scorecards/${scorecardId}`).then(r => r.data.data),

  createScorecard: (organizationId: string, data: ScorecardRequest) =>
    axiosInstance.post<ApiResponse<ScorecardResponse>>(`/bsc/organization/${organizationId}/scorecards`, data).then(r => r.data.data),

  updateScorecard: (scorecardId: string, data: ScorecardRequest) =>
    axiosInstance.put<ApiResponse<ScorecardResponse>>(`/bsc/scorecards/${scorecardId}`, data).then(r => r.data.data),

  deleteScorecard: (scorecardId: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/bsc/scorecards/${scorecardId}`).then(r => r.data.data),

  updateScoringMode: (scorecardId: string, mode: BscScoringMode) =>
    axiosInstance.patch<ApiResponse<ScorecardResponse>>(`/bsc/scorecards/${scorecardId}/scoring-mode`, null, { params: { mode } }).then(r => r.data.data),

  getDashboard: (scorecardId: string) =>
    axiosInstance.get<ApiResponse<BscDashboardResponse>>(`/bsc/scorecards/${scorecardId}/dashboard`).then(r => r.data.data),

  importScorecards: (organizationId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return axiosInstance
      .post<ApiResponse<ImportBscResponse>>(`/bsc/organization/${organizationId}/scorecards/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data.data)
  },
}
