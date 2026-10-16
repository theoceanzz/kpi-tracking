import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import type { Evaluation, CreateEvaluationRequest, EvaluationScorePreview, ScoringReadiness } from '@/types/evaluation'

export const evaluationApi = {
  getAll: (params: { 
    page?: number; 
    size?: number; 
    userId?: string; 
    kpiPeriodId?: string;
    orgUnitId?: string;
    organizationId?: string;
    sortBy?: string;
    sortDir?: string;
  } = {}) =>
    axiosInstance.get<ApiResponse<PageResponse<Evaluation>>>('/evaluations', { params }).then((r) => r.data.data),

  getById: (id: string) =>
    axiosInstance.get<ApiResponse<Evaluation>>(`/evaluations/${id}`).then((r) => r.data.data),

  create: (data: CreateEvaluationRequest) =>
    axiosInstance.post<ApiResponse<Evaluation>>('/evaluations', data).then((r) => r.data.data),

  getSystemScore: (kpiPeriodId: string, userId?: string) =>
    axiosInstance.get<ApiResponse<number>>('/evaluations/system-score', { params: { kpiPeriodId, userId } }).then((r) => r.data.data),

  getScorePreview: (kpiPeriodId: string, userId?: string) =>
    axiosInstance.get<ApiResponse<EvaluationScorePreview>>('/evaluations/score-preview', { params: { kpiPeriodId, userId } }).then((r) => r.data.data),

  /** Ai trong đơn vị (cả nhánh dưới) đã đủ điều kiện để mình chấm đợt — nộp đủ KPI + tự đánh giá, hoặc đợt đã hết. */
  getScoringReadiness: (kpiPeriodId: string, orgUnitId?: string) =>
    axiosInstance.get<ApiResponse<ScoringReadiness[]>>('/evaluations/scoring-readiness', { params: { kpiPeriodId, orgUnitId } }).then((r) => r.data.data),
}
