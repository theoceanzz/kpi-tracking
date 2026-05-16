import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import type { 
  KpiAdjustmentRequest, 
  CreateAdjustmentRequest, 
  ReviewAdjustmentRequest,
  AdjustmentStatus
} from '@/types/adjustment'

export const adjustmentApi = {
  create: (data: CreateAdjustmentRequest) =>
    axiosInstance.post<ApiResponse<KpiAdjustmentRequest>>('/kpi-adjustments', data).then((r) => r.data.data),

  review: (id: string, data: ReviewAdjustmentRequest) =>
    axiosInstance.post<ApiResponse<KpiAdjustmentRequest>>(`/kpi-adjustments/${id}/review`, data).then((r) => r.data.data),

  getMy: (params: { page?: number; size?: number } = {}) =>
    axiosInstance.get<ApiResponse<PageResponse<KpiAdjustmentRequest>>>('/kpi-adjustments/my', { params }).then((r) => r.data.data),

  getAll: (params: { 
    page?: number; 
    size?: number; 
    status?: AdjustmentStatus; 
    orgUnitId?: string;
    kpiPeriodId?: string;
    objectiveId?: string;
    keyResultId?: string;
  }) =>
    axiosInstance.get<ApiResponse<PageResponse<KpiAdjustmentRequest>>>('/kpi-adjustments', { params }).then((r) => r.data.data),

  bulkReview: (data: { ids: string[]; status: AdjustmentStatus; reviewerNote?: string }) =>
    axiosInstance.post<ApiResponse<void>>('/kpi-adjustments/bulk-review', data).then((r) => r.data.data),
}
