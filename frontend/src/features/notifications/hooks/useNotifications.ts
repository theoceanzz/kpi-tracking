import { useInfiniteQuery, useQuery, useMutation, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query'
import { notificationApi } from '../api/notificationApi'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { CursorPageResponse } from '@/types/api'
import type { Notification } from '@/types/notification'

export function useNotifications(size = 20, cursor?: string | null) {
  return useQuery({
    queryKey: ['notifications', 'list', size, cursor ?? null],
    queryFn: () => notificationApi.getAll(size, cursor),
  })
}

/**
 * Trang "Tất cả thông báo": tải dần theo con trỏ (keyset) — mỗi lần `size` thông báo, cuộn tới cuối thì tải tiếp.
 * Thông báo mới qua WebSocket được chèn vào trang đầu (`useWebSocketNotifications`).
 */
export function useNotificationFeed(size = 30) {
  return useInfiniteQuery({
    queryKey: ['notifications', 'feed', size],
    queryFn: ({ pageParam }) => notificationApi.getAll(size, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : undefined),
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationApi.getUnreadCount(),
  })
}

type FeedData = InfiniteData<CursorPageResponse<Notification>>

/** Sửa một / mọi thông báo ngay trong cache (cả ô chuông lẫn trang tải dần) — khỏi tải lại hàng trăm thông báo đã tải. */
function patchCachedNotifications(qc: QueryClient, patch: (n: Notification) => Notification) {
  qc.setQueriesData<CursorPageResponse<Notification>>({ queryKey: ['notifications', 'list'] },
    (old) => (old && 'content' in old ? { ...old, content: old.content.map(patch) } : old))
  qc.setQueriesData<FeedData>({ queryKey: ['notifications', 'feed'] },
    (old) => (old && 'pages' in old ? { ...old, pages: old.pages.map((p) => ({ ...p, content: p.content.map(patch) })) } : old))
}

export function useMarkAsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationApi.markAsRead(id),
    onSuccess: (_data, id) => {
      const now = new Date().toISOString()
      patchCachedNotifications(qc, (n) => (n.id === id && !n.isRead ? { ...n, isRead: true, readAt: now } : n))
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
    }
  })
}

export function useMarkAllRead() {
  const { t } = useTranslation('notifications')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      const now = new Date().toISOString()
      patchCachedNotifications(qc, (n) => (n.isRead ? n : { ...n, isRead: true, readAt: now }))
      qc.setQueryData<number>(['notifications', 'unread-count'], 0)
      toast.success(t('useNotifications.markedAllNotificationsAsRead'))
    }
  })
}
