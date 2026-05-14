import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import type { KpiPeriod } from '@/types/kpi'

export const kpiPeriodApi = {
  getAll: (params: { 
    page?: number; 
    size?: number; 
    sortBy?: string; 
    direction?: string; 
    keyword?: string; 
    periodType?: string; 
    startDate?: string;
    endDate?: string;
    organizationId?: string 
  }) =>
    axiosInstance.get<ApiResponse<PageResponse<KpiPeriod>>>('/kpi-periods', { params }).then((r) => r.data.data),
  
  create: (data: Partial<KpiPeriod>) =>
    axiosInstance.post<ApiResponse<KpiPeriod>>('/kpi-periods', data).then((r) => r.data.data),
    
  update: (id: string, data: Partial<KpiPeriod>) =>
    axiosInstance.put<ApiResponse<KpiPeriod>>(`/kpi-periods/${id}`, data).then((r) => r.data.data),
    
  delete: (id: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/kpi-periods/${id}`).then((r) => r.data.data),
}
