import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import type { CycleUserEvaluation, CycleUnitEvaluation } from '@/types/kpi'

export const kpiCycleEvaluationApi = {
  getUserEval: (cycleId: string, userId: string) =>
    axiosInstance
      .get<ApiResponse<CycleUserEvaluation>>(`/kpi-cycles/${cycleId}/evaluation/users/${userId}`)
      .then((r) => r.data.data),

  saveUserScore: (
    cycleId: string,
    userId: string,
    data: { finalScore: number | null; qualScore: number | null; comment: string },
  ) =>
    axiosInstance
      .put<ApiResponse<CycleUserEvaluation>>(`/kpi-cycles/${cycleId}/evaluation/users/${userId}`, data)
      .then((r) => r.data.data),

  getUnitSummary: (cycleId: string, orgUnitId: string) =>
    axiosInstance
      .get<ApiResponse<CycleUnitEvaluation>>(`/kpi-cycles/${cycleId}/evaluation/units/${orgUnitId}`)
      .then((r) => r.data.data),

  finalizeUnit: (cycleId: string, orgUnitId: string, comment: string) =>
    axiosInstance
      .post<ApiResponse<CycleUnitEvaluation>>(`/kpi-cycles/${cycleId}/evaluation/units/${orgUnitId}/finalize`, { comment })
      .then((r) => r.data.data),

  reopenUnit: (cycleId: string, orgUnitId: string) =>
    axiosInstance
      .post<ApiResponse<CycleUnitEvaluation>>(`/kpi-cycles/${cycleId}/evaluation/units/${orgUnitId}/reopen`)
      .then((r) => r.data.data),
}
