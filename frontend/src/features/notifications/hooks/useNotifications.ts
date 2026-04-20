import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationApi } from '../api/notificationApi'
import { toast } from 'sonner'

export function useNotifications(page = 0, size = 20) {
  return useQuery({
    queryKey: ['notifications', page, size],
    queryFn: () => notificationApi.getAll(page, size),
    refetchInterval: 30000,
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationApi.getUnreadCount(),
    refetchInterval: 15000,
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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('Đã đánh dấu tất cả thông báo là đã đọc')
    }
  })
}
