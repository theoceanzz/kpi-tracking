import axiosInstance from '@/lib/axios'
import type { ApiResponse, CursorPageResponse } from '@/types/api'
import type { Notification } from '@/types/notification'

export interface NotificationConfigItem {
  eventCode: string
  emailEnabled: boolean
  systemEnabled: boolean
}

export interface SendKpiReminderRequest {
  userId: string
  subject: string
  body: string
}

export const notificationApi = {
  sendKpiReminder: (data: SendKpiReminderRequest) =>
    axiosInstance.post<ApiResponse<void>>('/notifications/kpi-reminder', data).then((r) => r.data),

  // Keyset pagination: trang đầu không có cursor; trang kế gửi lại nextCursor của trang trước.
  getAll: (size = 20, cursor?: string | null) =>
    axiosInstance
      .get<ApiResponse<CursorPageResponse<Notification>>>('/notifications', { params: { size, cursor: cursor ?? undefined } })
      .then((r) => r.data.data),

  markAsRead: (id: string) =>
    axiosInstance.patch<ApiResponse<Notification>>(`/notifications/${id}/read`).then((r) => r.data.data),

  getUnreadCount: () =>
    axiosInstance.get<ApiResponse<number>>('/notifications/unread-count').then((r) => r.data.data),

  markAllAsRead: () =>
    axiosInstance.patch<ApiResponse<void>>('/notifications/read-all').then((r) => r.data),

  getNotificationConfig: () =>
    axiosInstance.get<ApiResponse<NotificationConfigItem[]>>('/notifications/config').then((r) => r.data.data),

  saveNotificationConfig: (configs: NotificationConfigItem[]) =>
    axiosInstance.put<ApiResponse<NotificationConfigItem[]>>('/notifications/config', { configs }).then((r) => r.data.data),
}
