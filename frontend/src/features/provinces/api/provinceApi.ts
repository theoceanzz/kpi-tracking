import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'

export interface Province {
  id: string
  name: string
  code: string
}

export interface District {
  id: string
  name: string
  code: string
}

export const provinceApi = {
  getAll: () =>
    axiosInstance.get<ApiResponse<Province[]>>('/provinces').then((r) => r.data.data),

  getDistricts: (provinceId: string) =>
    axiosInstance.get<ApiResponse<District[]>>(`/provinces/${provinceId}/districts`).then((r) => r.data.data),
}
