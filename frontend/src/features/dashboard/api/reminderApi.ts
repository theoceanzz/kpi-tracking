import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'

export const reminderApi = {
  sendReminder: (assignedKpiId: string, userId: string) =>
    axiosInstance.post<ApiResponse<void>>(`/reminders/assigned-kpi/${assignedKpiId}/user/${userId}`).then((r) => r.data.data),
}
