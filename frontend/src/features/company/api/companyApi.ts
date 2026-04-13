import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import type { Company, UpdateCompanyRequest } from '@/types/company'

export const companyApi = {
  getMy: () =>
    axiosInstance.get<ApiResponse<Company>>('/company').then((r) => r.data.data),

  update: (data: UpdateCompanyRequest) =>
    axiosInstance.put<ApiResponse<Company>>('/company', data).then((r) => r.data.data),
}
