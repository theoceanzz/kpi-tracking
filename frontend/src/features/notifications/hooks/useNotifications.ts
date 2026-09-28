import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationApi } from '../api/notificationApi'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

export function useNotifications(size = 20, cursor?: string | null) {
  return useQuery({
    queryKey: ['notifications', 'list', size, cursor ?? null],
    queryFn: () => notificationApi.getAll(size, cursor),
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationApi.getUnreadCount(),
  })
}

export function useMarkAsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationApi.markAsRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    }
  })
}

export function useMarkAllRead() {
  const { t } = useTranslation('notifications')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast.success(t('useNotifications.markedAllNotificationsAsRead'))
    }
  })
}
