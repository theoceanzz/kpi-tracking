import { useRef, useState } from 'react'
import { useNotifications, useMarkAllRead, useMarkAsRead } from '../hooks/useNotifications'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import PageHeader from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import {
  Bell, CheckCheck, Send,
  FileSearch, ShieldCheck, Target,
  CheckCircle2, Layers, GitBranch, Calculator,
  Award, Coins, Gift, Wallet, Scale, Inbox
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** Cùng bảng màu theo nhóm nghiệp vụ với NotificationDropdown. */
const typeConfig: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  SUBMISSION: { icon: Send, color: 'bg-[var(--color-info-bg)] text-[var(--color-info)]', label: 'Báo cáo mới' },
  REVIEW: { icon: FileSearch, color: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]', label: 'Đánh giá' },
  KPI_APPROVED: { icon: ShieldCheck, color: 'bg-[var(--color-success-bg)] text-[var(--color-success)]', label: 'Duyệt chỉ tiêu' },
  KPI_ASSIGNED: { icon: Target, color: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]', label: 'Giao chỉ tiêu' },
  BSC_SCORECARD: { icon: Layers, color: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]', label: 'Bộ tiêu chí BSC' },
  BSC_ASSIGNED: { icon: GitBranch, color: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]', label: 'Giao chỉ tiêu BSC' },
  BSC_RESULT: { icon: Calculator, color: 'bg-[var(--color-success-bg)] text-[var(--color-success)]', label: 'Kết quả BSC' },
  REWARD_GRANT: { icon: Award, color: 'bg-[var(--color-info-bg)] text-[var(--color-info)]', label: 'Đề nghị thưởng' },
  REWARD_POINT: { icon: Coins, color: 'bg-[var(--color-info-bg)] text-[var(--color-info)]', label: 'Điểm thưởng' },
  REWARD_GIFT: { icon: Gift, color: 'bg-[var(--color-info-bg)] text-[var(--color-info)]', label: 'Đổi quà' },
  WALLET: { icon: Wallet, color: 'bg-[var(--color-info-bg)] text-[var(--color-info)]', label: 'Ví tiền' },
  WALLET_RECONCILE: { icon: Scale, color: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]', label: 'Đối soát ví' },
}
const DEFAULT_TYPE = { icon: Bell, color: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]', label: 'Thông báo' }

export default function NotificationsPage() {
  // KHÔNG mở kết nối WebSocket ở đây: NotificationBell trong AppLayout đã mở sẵn một cái và
  // luôn có mặt trên mọi trang. Gọi thêm lần nữa sẽ có hai kết nối, và mỗi thông báo về được
  // thêm hai lần vào danh sách kèm huy hiệu chưa đọc cộng hai.
  // Trang đầu 50 thông báo mới nhất (keyset, không cursor). Trang kế = useNotifications(50, data.nextCursor).
  const { data, isLoading } = useNotifications(50)
  const markAllRead = useMarkAllRead()
  const markRead = useMarkAsRead()
  
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL')

  const notifications = data?.content || []
  const filteredNotifs = filter === 'UNREAD' ? notifications.filter(n => !n.isRead) : notifications
  const unreadCount = notifications.filter(n => !n.isRead).length

  // Chưa đọc lên đầu — đúng thứ mà con số đỏ trên chuông đang đếm, khỏi phải cuộn đi tìm.
  // Chốt danh sách chưa đọc ở LẦN TẢI ĐẦU chứ không bám `isRead` hiện tại: bấm vào một
  // thông báo là nó thành đã đọc, xếp lại ngay thì dòng vừa bấm rơi xuống cuối và cả danh
  // sách trượt đi dưới con trỏ. Sort ổn định nên trong từng nhóm vẫn là mới nhất trước.
  const firstUnreadIds = useRef<Set<string> | null>(null)
  if (firstUnreadIds.current === null && !isLoading && data) {
    firstUnreadIds.current = new Set(notifications.filter(n => !n.isRead).map(n => n.id))
  }
  // Thông báo mới đến qua websocket khi đang mở trang cũng lên đầu, dù không có trong
  // ảnh chụp lúc vào trang.
  const isTopGroup = (n: { id: string; isRead: boolean }) =>
    (firstUnreadIds.current?.has(n.id) ?? false) || !n.isRead
  const orderedNotifs = [...filteredNotifs].sort((a, b) => Number(isTopGroup(b)) - Number(isTopGroup(a)))

  const filters = [
    { key: 'ALL' as const, label: 'Tất cả', count: notifications.length },
    { key: 'UNREAD' as const, label: 'Chưa đọc', count: unreadCount },
  ]

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Thông báo"
        description={unreadCount > 0 ? `${unreadCount} thông báo chưa đọc.` : 'Bạn đã đọc hết thông báo.'}
        action={
          <Button
            variant="outline"
            onClick={() => markAllRead.mutate()}
            disabled={unreadCount === 0 || markAllRead.isPending}
          >
            <CheckCheck aria-hidden="true" />
            Đọc tất cả
          </Button>
        }
      />
      
      {/* Bộ lọc */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-control bg-[var(--color-muted)] p-1" role="tablist" aria-label="Lọc thông báo">
          {filters.map(f => {
            const active = filter === f.key
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'flex h-8 items-center gap-1.5 rounded-sm px-3 text-[13px] font-medium transition-colors',
                  active
                    ? 'bg-[var(--color-card)] text-[var(--color-foreground)] shadow-sm'
                    : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
                )}
              >
                {f.label}
                <span className={cn('tabular-nums', active ? 'text-[var(--color-muted-foreground)]' : 'text-[var(--color-subtle-foreground)]')}>{f.count}</span>
              </button>
            )
          })}
        </div>
        <p className="flex items-center gap-2 text-caption">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--color-success-solid)]" />
          Cập nhật theo thời gian thực
        </p>
        </div>

      {/* Danh sách */}
        {isLoading ? (
          <LoadingSkeleton type="table" rows={6} />
        ) : filteredNotifs.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
            <EmptyState 
            icon={Inbox}
            title={filter === 'UNREAD' ? 'Không còn thông báo chưa đọc' : 'Chưa có thông báo'}
            description={filter === 'UNREAD' ? 'Mọi thông báo đã được đọc.' : 'Thông báo về chỉ tiêu, bài nộp và đánh giá sẽ hiện ở đây.'}
            />
          </div>
        ) : (
        <div className="divide-y divide-[var(--color-border)] overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
            {orderedNotifs.map((n) => {
            const config = typeConfig[n.type] || DEFAULT_TYPE
              const Icon = config.icon
              
              return (
                <div 
                  key={n.id}
                role={n.isRead ? undefined : 'button'}
                tabIndex={n.isRead ? undefined : 0}
                  onClick={() => !n.isRead && markRead.mutate(n.id)}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === '') && !n.isRead) { e.preventDefault(); markRead.mutate(n.id) } }}
                  className={cn(
                  'flex gap-4 border-l-2 px-5 py-4 transition-colors',
                    n.isRead 
                    ? 'border-transparent'
                    : 'cursor-pointer border-[var(--color-primary)] bg-[var(--color-primary-soft)] hover:bg-[var(--color-muted)]'
                  )}
                >
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-card', config.color)} aria-hidden="true">
                  <Icon size={18} />
                  </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-eyebrow">{config.label}</p>
                      <h3 className={cn('mt-0.5 text-sm leading-5', n.isRead ? 'text-[var(--color-muted-foreground)]' : 'font-medium text-[var(--color-foreground)]')}>
                          {n.title}
                        </h3>
                      </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-caption tabular-nums">{formatDateTime(n.createdAt)}</span>
                        {!n.isRead && (
                        <span className="rounded-control bg-[var(--color-primary)] px-1.5 py-0.5 text-xs font-medium leading-none text-[var(--color-primary-foreground)]">
                             Mới
                        </span>
                        )}
                      </div>
                    </div>
                    
                  <p className="mt-1 max-w-2xl text-sm leading-5 text-[var(--color-muted-foreground)]">
                      {n.message}
                    </p>

                  {n.isRead && n.readAt && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-caption">
                      <CheckCircle2 size={12} aria-hidden="true" /> Đã đọc lúc {formatDateTime(n.readAt)}
                    </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
  )
}
