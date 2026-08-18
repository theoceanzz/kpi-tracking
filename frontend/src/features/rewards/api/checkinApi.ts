import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import type { CheckinConfig, CheckinConfigRequest, CheckinStatus } from '../types'

export const checkinApi = {
  /** Trạng thái điểm danh của chính mình — đủ để vẽ cả thẻ, không cần gọi thêm cấu hình. */
  getMyStatus: () =>
    axiosInstance
      .get<ApiResponse<CheckinStatus>>('/reward-checkins/me')
      .then((r) => r.data.data),

  checkin: () =>
    axiosInstance
      .post<ApiResponse<CheckinStatus>>('/reward-checkins/me')
      .then((r) => r.data.data),

  getConfig: () =>
    axiosInstance
      .get<ApiResponse<CheckinConfig>>('/reward-checkins/config')
      .then((r) => r.data.data),

  /** Toàn bộ form là MỘT bản ghi nên chỉ có PUT — backend tự tạo nếu chưa có. */
  saveConfig: (data: CheckinConfigRequest) =>
    axiosInstance
      .put<ApiResponse<CheckinConfig>>('/reward-checkins/config', data)
      .then((r) => r.data.data),
}
