// Matches BE: NotificationResponse
export interface Notification {
  id: string
  title: string
  message: string
  type: string
  referenceId: string | null
  isRead: boolean
  readAt: string | null
  createdAt: string
}
