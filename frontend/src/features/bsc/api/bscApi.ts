import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import {
  PerspectiveResponse, PerspectiveRequest, ImportBscResponse, FixedPerspectiveResponse, FixedPerspectiveUpdateRequest,
  ScorecardResponse, ScorecardRequest, BscScoringMode,
  ScorecardTreeNodeResponse, ScorecardCoverageResponse, CascadeRequest,
  UnitResultResponse, CascadePolicyResponse, CascadePolicyRequest,
  BscWaterfallResponse, BscOverrideRequest, LinkedWeightCheck,
} from '../types'

export const bscApi = {
  getFixedPerspectives: (organizationId: string) =>
    axiosInstance
      .get<ApiResponse<FixedPerspectiveResponse[]>>(`/bsc/organization/${organizationId}/fixed-perspectives`)
      .then(r => r.data.data),

  updateFixedPerspective: (organizationId: string, code: string, data: FixedPerspectiveUpdateRequest) =>
    axiosInstance
      .put<ApiResponse<FixedPerspectiveResponse>>(`/bsc/organization/${organizationId}/fixed-perspectives/${code}`, data)
      .then(r => r.data.data),

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

  // ── Cây BSC phân cấp (docs/bsc-cascade-design.md) ──────────
  getScorecardTree: (organizationId: string, kpiPeriodId?: string) =>
    axiosInstance
      .get<ApiResponse<ScorecardTreeNodeResponse[]>>(`/bsc/organization/${organizationId}/scorecards/tree`, {
        params: kpiPeriodId ? { kpiPeriodId } : undefined,
      })
      .then(r => r.data.data),

  getCoverage: (scorecardId: string) =>
    axiosInstance
      .get<ApiResponse<ScorecardCoverageResponse>>(`/bsc/scorecards/${scorecardId}/coverage`)
      .then(r => r.data.data),

  cascade: (scorecardId: string, data: CascadeRequest) =>
    axiosInstance
      .post<ApiResponse<ScorecardCoverageResponse>>(`/bsc/scorecards/${scorecardId}/cascade`, data)
      .then(r => r.data.data),

  // ── Vòng đời trình – duyệt ─────────────────────────────────
  submitScorecard: (scorecardId: string) =>
    axiosInstance.post<ApiResponse<ScorecardResponse>>(`/bsc/scorecards/${scorecardId}/submit`).then(r => r.data.data),

  approveScorecard: (scorecardId: string) =>
    axiosInstance.post<ApiResponse<ScorecardResponse>>(`/bsc/scorecards/${scorecardId}/approve`).then(r => r.data.data),

  rejectScorecard: (scorecardId: string, reason: string) =>
    axiosInstance
      .post<ApiResponse<ScorecardResponse>>(`/bsc/scorecards/${scorecardId}/reject`, { reason })
      .then(r => r.data.data),

  activateScorecard: (scorecardId: string) =>
    axiosInstance.post<ApiResponse<ScorecardResponse>>(`/bsc/scorecards/${scorecardId}/activate`).then(r => r.data.data),

  lockScorecard: (scorecardId: string) =>
    axiosInstance.post<ApiResponse<ScorecardResponse>>(`/bsc/scorecards/${scorecardId}/lock`).then(r => r.data.data),

  reopenScorecard: (scorecardId: string) =>
    axiosInstance.post<ApiResponse<ScorecardResponse>>(`/bsc/scorecards/${scorecardId}/reopen`).then(r => r.data.data),

  // ── Kết quả BSC đơn vị ─────────────────────────────────────
  getUnitResult: (scorecardId: string, kpiPeriodId: string) =>
    axiosInstance
      .get<ApiResponse<UnitResultResponse | null>>(`/bsc/scorecards/${scorecardId}/results`, { params: { kpiPeriodId } })
      .then(r => r.data.data),

  recomputeUnitResult: (scorecardId: string, kpiPeriodId: string) =>
    axiosInstance
      .post<ApiResponse<UnitResultResponse>>(`/bsc/scorecards/${scorecardId}/results/recompute`, null, { params: { kpiPeriodId } })
      .then(r => r.data.data),

  finalizeUnitResult: (scorecardId: string, kpiPeriodId: string) =>
    axiosInstance
      .post<ApiResponse<UnitResultResponse>>(`/bsc/scorecards/${scorecardId}/results/finalize`, null, { params: { kpiPeriodId } })
      .then(r => r.data.data),

  reopenUnitResult: (scorecardId: string, kpiPeriodId: string) =>
    axiosInstance
      .post<ApiResponse<UnitResultResponse>>(`/bsc/scorecards/${scorecardId}/results/reopen`, null, { params: { kpiPeriodId } })
      .then(r => r.data.data),

  setManualActual: (scorecardId: string, itemId: string, kpiPeriodId: string, actualValue: number | null) =>
    axiosInstance
      .put<ApiResponse<UnitResultResponse>>(`/bsc/scorecards/${scorecardId}/results/items/${itemId}`, null, {
        params: actualValue == null ? { kpiPeriodId } : { kpiPeriodId, actualValue },
      })
      .then(r => r.data.data),

  // ── Chính sách hệ số ───────────────────────────────────────
  getCascadePolicies: (organizationId: string) =>
    axiosInstance
      .get<ApiResponse<CascadePolicyResponse[]>>(`/bsc/organization/${organizationId}/cascade-policies`)
      .then(r => r.data.data),

  createCascadePolicy: (organizationId: string, data: CascadePolicyRequest) =>
    axiosInstance
      .post<ApiResponse<CascadePolicyResponse>>(`/bsc/organization/${organizationId}/cascade-policies`, data)
      .then(r => r.data.data),

  updateCascadePolicy: (policyId: string, data: CascadePolicyRequest) =>
    axiosInstance
      .put<ApiResponse<CascadePolicyResponse>>(`/bsc/cascade-policies/${policyId}`, data)
      .then(r => r.data.data),

  deleteCascadePolicy: (policyId: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/bsc/cascade-policies/${policyId}`).then(r => r.data.data),

  // ── Diễn giải điểm cá nhân ─────────────────────────────────
  getWaterfall: (evaluationId: string) =>
    axiosInstance
      .get<ApiResponse<BscWaterfallResponse>>(`/bsc/evaluations/${evaluationId}/waterfall`)
      .then(r => r.data.data),

  overrideScore: (evaluationId: string, data: BscOverrideRequest) =>
    axiosInstance
      .post<ApiResponse<BscWaterfallResponse>>(`/bsc/evaluations/${evaluationId}/override`, data)
      .then(r => r.data.data),

  getLinkedWeight: (userId: string, kpiPeriodId: string, organizationId: string) =>
    axiosInstance
      .get<ApiResponse<LinkedWeightCheck>>(`/bsc/users/${userId}/linked-weight`, {
        params: { kpiPeriodId, organizationId },
      })
      .then(r => r.data.data),

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
