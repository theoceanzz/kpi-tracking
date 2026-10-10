import { useEffect, useRef } from 'react'
import { Client } from '@stomp/stompjs'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { resetSession, useAuthStore } from '@/store/authStore'
import type { Notification } from '@/types/notification'
import type { CursorPageResponse } from '@/types/api'
import { notificationApi } from '../api/notificationApi'
import { notificationLink } from '../notificationLink'
import { playNotificationSound, primeNotificationSound, showDesktopNotification } from '../notificationAlert'
import { createReconnectPolicy, RECONNECT_DELAYS_MS } from '../realtimeReconnect'
import { refreshSession } from '@/lib/axios'
import { attachRealtimeClient, detachRealtimeClient } from '@/lib/realtime'

/**
 * Dữ liệu cần tải lại khi một thông báo loại tương ứng về tới.
 *
 * <p><b>Vì sao cần bảng này:</b> mỗi mutation đã tự làm mới cache của CHÍNH người bấm nút. Nhưng
 * phần lớn thay đổi về tiền và điểm lại do NGƯỜI KHÁC hoặc do máy chủ gây ra — sếp duyệt đề nghị
 * thưởng, quản trị viên thu hồi điểm, webhook SePay báo tiền về, bộ chạy nền phát thưởng cuối
 * đợt hay đánh dấu đơn nạp hết hạn. Người chịu ảnh hưởng không bấm gì cả, nên không có mutation
 * nào chạy ở máy họ và số dư đứng yên cho tới khi họ tự tải lại trang.
 *
 * <p>Thông báo là tín hiệu sẵn có duy nhất đi kèm đúng những sự kiện đó, và nó đã chạy qua
 * WebSocket. Bám vào đây thì mọi luồng điểm thưởng và ví tiền thành thời gian thực bằng một chỗ
 * duy nhất, thay vì rải cơ chế hỏi lại định kỳ khắp các màn hình.
 *
 * <p>Khoá liệt kê ở mức GỐC ({@code ['cashWallet']} chứ không phải {@code ['cashWallet','me']}):
 * React Query khớp theo tiền tố, nên một dòng bao trọn mọi biến thể phân trang và bộ lọc.
 */
const REFRESH_ON_NOTIFICATION: Record<string, string[]> = {
  // Vòng đời đề nghị thưởng: trình, duyệt, từ chối, rút lại, cấp hạn mức.
  REWARD_GRANT: ['rewardGrants', 'rewardBudget', 'rewardBudgets', 'myAwards'],

  // Điểm vào hoặc ra khỏi ví thưởng — thưởng thủ công, chương trình, và thu hồi cả hai loại.
  REWARD_POINT: [
    'rewardWallet',
    'rewardTransactions',
    'rewardGrants',
    'rewardRuns',
    'rewardActivity',
    'myAwards',
  ],

  // Đổi quà: số dư điểm đổi, tồn kho quà đổi, và hàng đợi của bộ phận xử lý quà.
  REWARD_GIFT: [
    'redemptions',
    'rewardWallet',
    'rewardTransactions',
    'giftShop',
    'giftsManage',
  ],
  // Đơn đổi quà mới chờ bộ phận xử lý quà.
  REWARD_GIFT_REQUEST: ['redemptions', 'giftsManage'],

  // Ví tiền: nạp thành công, đơn hết hạn, quy đổi sang điểm. Quy đổi chạm CẢ ví điểm nên phải
  // có mặt ở đây — bỏ sót thì trang "Điểm của tôi" hiện số cũ ngay sau khi đổi xong.
  WALLET: [
    'cashWallet',
    'cashTransactions',
    'topupOrders',
    'rewardWallet',
    'rewardTransactions',
  ],

  // Có tiền về mà chưa ghi có được: hàng đợi đối soát và huy hiệu đếm trên tab.
  WALLET_RECONCILE: ['sepayEvents', 'walletReconcile', 'cashWallet', 'cashTransactions'],

  // Chuỗi duyệt chỉ tiêu: KPI vừa được gửi lên / chuyển tới bước của mình, hoặc KPI của mình vừa
  // được duyệt, trả lại, hoàn duyệt. 'kpi-criteria' bao cả hộp "chờ tôi duyệt" và KPI của tôi.
  KPI_SUBMITTED: ['kpi-criteria', 'kpi-approval-chain'],
  KPI_APPROVED: ['kpi-criteria', 'kpi-approval-chain'],
  KPI_REJECTED: ['kpi-criteria', 'kpi-approval-chain'],
  KPI_APPROVAL_REVERTED: ['kpi-criteria', 'kpi-approval-chain'],
  KPI_ASSIGNED: ['kpi-criteria'],
  // Yêu cầu điều chỉnh: hộp chờ điều chỉnh, chấm đếm, và KPI được áp bản điều chỉnh.
  ADJUSTMENT_REQUEST: ['kpi-adjustments', 'kpi-approval-chain'],
  ADJUSTMENT_DECIDED: ['kpi-adjustments', 'my-kpi-adjustments', 'kpi-criteria', 'kpi-approval-chain'],
}

/** Popup giữ lâu hơn toast thường (4s): người dùng có thể đang đọc chỗ khác khi nó hiện lên. */
const POPUP_DURATION_MS = 8000

/**
 * Nhận thông báo thời gian thực: làm mới dữ liệu liên quan, hiện popup kèm tiếng "ting", và thông báo của hệ điều
 * hành nếu đang ở tab khác. Bấm "Xem" ở popup (hoặc bấm thông báo hệ điều hành) mở đúng màn của thông báo
 * (`notificationLink`) và đánh dấu đã đọc.
 *
 * <p>CHỈ được gọi ở MỘT chỗ trong cây component ({@code NotificationBell}, luôn có mặt trong
 * {@code AppLayout}). Gọi ở hai nơi sẽ mở hai kết nối STOMP, và mỗi thông báo về sẽ được thêm
 * hai lần vào danh sách kèm huy hiệu chưa đọc cộng hai.
 */
export function useWebSocketNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const qc = useQueryClient()
  const clientRef = useRef<Client | null>(null)
  const navigate = useNavigate()
  const { t } = useTranslation('notifications')
  // Kết nối chỉ mở lại khi đăng nhập/đăng xuất; navigate/t đổi theo trang và ngôn ngữ thì đọc qua ref.
  const navigateRef = useRef(navigate)
  const tRef = useRef(t)
  useEffect(() => {
    navigateRef.current = navigate
    tRef.current = t
  }, [navigate, t])

  useEffect(() => {
    primeNotificationSound()
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const brokerURL = `${protocol}//${window.location.host}/ws`

    // Không gửi Authorization: token nằm trong cookie HttpOnly, trình duyệt tự đính kèm vào
    // handshake (cùng origin) và backend đọc nó ở HandshakeInterceptor.
    // Kết nối lại có làm mới phiên + chờ tăng dần (realtimeReconnect.ts) — không còn CONNECT mỗi 5s vô hạn
    // khi phiên đã hết như log prod 2026-10-06.
    const policy = createReconnectPolicy({
      refresh: refreshSession,
      onSessionOver: () => {
        resetSession()
        navigateRef.current('/login')
      },
    })
    const client = new Client({
      brokerURL,
      reconnectDelay: RECONNECT_DELAYS_MS[0],
      beforeConnect: (c: Client) => policy.beforeConnect(c),
      onConnect: () => {
        policy.onConnected(client)
        // Các màn khác (khung thảo luận) đăng ký kênh riêng trên CHÍNH kết nối này.
        attachRealtimeClient(client)
        client.subscribe('/user/queue/notifications', (frame) => {
          const notification: Notification = JSON.parse(frame.body)

          // Thông báo GỘP (nhiều bình luận liên tiếp) về lại với cùng id: thay bản cũ lên đầu, không đếm thêm
          // chưa đọc — nó vẫn là một thông báo chưa đọc như trước.
          let alreadyListed = false
          qc.setQueriesData<CursorPageResponse<Notification>>(
            { queryKey: ['notifications', 'list'] },
            (old) => {
              if (!old || typeof old !== 'object' || !('content' in old)) return old
              if (old.content.some((n) => n.id === notification.id)) alreadyListed = true
              return { ...old, content: [notification, ...old.content.filter((n) => n.id !== notification.id)] }
            }
          )

          if (!alreadyListed) {
            qc.setQueryData<number>(
              ['notifications', 'unread-count'],
              (old) => (old ?? 0) + 1
            )
          }

          // Làm mới dữ liệu mà sự kiện này vừa thay đổi. Chỉ đánh dấu cũ (invalidate) chứ không
          // tự tải lại tất cả: React Query chỉ gọi API cho những truy vấn đang thực sự hiển thị,
          // nên một thông báo thưởng lúc người dùng đang ở màn hình khác không sinh request nào.
          for (const key of REFRESH_ON_NOTIFICATION[notification.type] ?? []) {
            qc.invalidateQueries({ queryKey: [key] })
          }

          const link = notificationLink(notification)
          const open = () => {
            notificationApi.markAsRead(notification.id)
              .then(() => qc.invalidateQueries({ queryKey: ['notifications'] }))
              .catch(() => {})
            if (link) navigateRef.current(link)
          }
          toast(notification.title, {
            id: `notification-${notification.id}`,
            description: notification.message,
            duration: POPUP_DURATION_MS,
            action: link ? { label: tRef.current('NotificationPopup.view'), onClick: open } : undefined,
          })
          // Bản cập nhật của thông báo gộp: chỉ thay nội dung popup, không kêu "ting" lại.
          if (!alreadyListed) {
            playNotificationSound()
            showDesktopNotification({ id: notification.id, title: notification.title, body: notification.message, onClick: open })
          }
        })
      },
      onWebSocketClose: () => {
        detachRealtimeClient()
        policy.onClosed(client)
      },
      onStompError: (frame) => {
        console.error('WebSocket STOMP error:', frame.headers['message'])
      },
    })

    client.activate()
    clientRef.current = client

    return () => {
      detachRealtimeClient()
      client.deactivate()
      clientRef.current = null
    }
  }, [isAuthenticated, qc])
}
