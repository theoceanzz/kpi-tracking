import { useEffect, useRef } from 'react'
import { Client } from '@stomp/stompjs'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import type { Notification } from '@/types/notification'
import type { PageResponse } from '@/types/api'

export function useWebSocketNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const qc = useQueryClient()
  const clientRef = useRef<Client | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const brokerURL = `${protocol}//${window.location.host}/ws`

    // Không gửi Authorization: token nằm trong cookie HttpOnly, trình duyệt tự đính kèm vào
    // handshake (cùng origin) và backend đọc nó ở HandshakeInterceptor.
    const client = new Client({
      brokerURL,
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe('/user/queue/notifications', (frame) => {
          const notification: Notification = JSON.parse(frame.body)

          // Prepend to all paginated notification caches
          qc.setQueriesData<PageResponse<Notification>>(
            { queryKey: ['notifications'] },
            (old) => {
              if (!old || typeof old !== 'object' || !('content' in old)) return old
              return {
                ...old,
                content: [notification, ...old.content],
                totalElements: old.totalElements + 1,
              }
            }
          )

          // Increment unread count separately
          qc.setQueryData<number>(
            ['notifications', 'unread-count'],
            (old) => (old ?? 0) + 1
          )
        })
      },
      onStompError: (frame) => {
        console.error('WebSocket STOMP error:', frame.headers['message'])
      },
    })

    client.activate()
    clientRef.current = client

    return () => {
      client.deactivate()
      clientRef.current = null
    }
  }, [isAuthenticated, qc])
}
