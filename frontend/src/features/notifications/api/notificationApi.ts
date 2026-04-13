import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import type { Notification } from '@/types/notification'

export const notificationApi = {
  getAll: (page = 0, size = 20) =>
    axiosInstance.get<ApiResponse<PageResponse<Notification>>>('/notifications', { params: { page, size } }).then((r) => r.data.data),

  markAsRead: (id: string) =>
    axiosInstance.patch<ApiResponse<Notification>>(`/notifications/${id}/read`).then((r) => r.data.data),

  getUnreadCount: () =>
    axiosInstance.get<ApiResponse<number>>('/notifications/unread-count').then((r) => r.data.data),
}
