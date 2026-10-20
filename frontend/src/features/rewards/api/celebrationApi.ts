import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import type { RewardCelebration } from '../types'

export const celebrationApi = {
  /** Lượt thưởng / đổi quà của tôi chưa được ăn mừng — máy chủ là nguồn sự thật. */
  getMine: () =>
    axiosInstance
      .get<ApiResponse<RewardCelebration[]>>('/rewards/me/celebrations')
      .then((r) => r.data.data),

  /** Đánh dấu đã ăn mừng. Idempotent: gọi lại cùng id không đổi gì. */
  ack: (refIds: string[]) =>
    axiosInstance
      .post<ApiResponse<number>>('/rewards/me/celebrations/ack', { refIds })
      .then((r) => r.data.data),
}
