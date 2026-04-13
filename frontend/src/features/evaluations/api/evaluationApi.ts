import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import type { Evaluation, CreateEvaluationRequest } from '@/types/evaluation'

export const evaluationApi = {
  getAll: (params: { page?: number; size?: number; userId?: string; kpiCriteriaId?: string }) =>
    axiosInstance.get<ApiResponse<PageResponse<Evaluation>>>('/evaluations', { params }).then((r) => r.data.data),

  getById: (id: string) =>
    axiosInstance.get<ApiResponse<Evaluation>>(`/evaluations/${id}`).then((r) => r.data.data),

  create: (data: CreateEvaluationRequest) =>
    axiosInstance.post<ApiResponse<Evaluation>>('/evaluations', data).then((r) => r.data.data),
}
