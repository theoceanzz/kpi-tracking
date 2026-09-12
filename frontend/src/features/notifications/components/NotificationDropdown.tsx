import { useRef } from 'react'
import { useNotifications, useMarkAllRead, useMarkAsRead } from '../hooks/useNotifications'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { CheckCheck, Bell, Send, FileSearch, ShieldCheck, Target, Inbox, Layers, GitBranch, Calculator, Award, Coins, Gift, Wallet, Scale } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

interface NotificationDropdownProps {
  onClose: () => void
}

/**
 * Màu icon theo NHÓM nghiệp vụ chứ không theo từng loại: KPI = màu chủ đạo, duyệt/kết
 * quả = success, cần xử lý = warning, tiền/thưởng = info, còn lại trung tính. Mười hai
 * màu khác nhau trước đây không mang nghĩa gì mà làm danh sách loang lổ.
 */
const typeConfig: Record<string, { icon: LucideIcon; color: string }> = {
  SUBMISSION: { icon: Send, color: 'bg-[var(--color-info-bg)] text-[var(--color-info)]' },
  REVIEW: { icon: FileSearch, color: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' },
  KPI_APPROVED: { icon: ShieldCheck, color: 'bg-[var(--color-success-bg)] text-[var(--color-success)]' },
  KPI_ASSIGNED: { icon: Target, color: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' },
  BSC_SCORECARD: { icon: Layers, color: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' },
  BSC_ASSIGNED: { icon: GitBranch, color: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' },
  BSC_RESULT: { icon: Calculator, color: 'bg-[var(--color-success-bg)] text-[var(--color-success)]' },
  REWARD_GRANT: { icon: Award, color: 'bg-[var(--color-info-bg)] text-[var(--color-info)]' },
  REWARD_POINT: { icon: Coins, color: 'bg-[var(--color-info-bg)] text-[var(--color-info)]' },
  REWARD_GIFT: { icon: Gift, color: 'bg-[var(--color-info-bg)] text-[var(--color-info)]' },
  WALLET: { icon: Wallet, color: 'bg-[var(--color-info-bg)] text-[var(--color-info)]' },
  WALLET_RECONCILE: { icon: Scale, color: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' },
}
const DEFAULT_TYPE = { icon: Bell, color: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]' }

export default function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const { data, isLoading } = useNotifications()
  const markAllRead = useMarkAllRead()
  const markRead = useMarkAsRead()

  const notifications = data?.content || []
  const unreadCount = notifications.filter(n => !n.isRead).length

  // Chưa đọc lên đầu, phần đã đọc mới chia Hôm nay / Trước đó. Con số đỏ trên chuông đếm
  // đúng nhóm đầu tiên này — xếp lẫn theo ngày là người dùng phải tự dò xem cái nào chưa đọc.
  //
  // Chốt nhóm "chưa đọc" ở lần tải đầu của mỗi lần mở: bấm vào một thông báo là nó thành
  // đã đọc, xếp lại ngay thì dòng vừa bấm nhảy xuống dưới ngay dưới con trỏ.
  const firstUnreadIds = useRef<Set<string> | null>(null)
  if (firstUnreadIds.current === null && !isLoading && data) {
    firstUnreadIds.current = new Set(notifications.filter(n => !n.isRead).map(n => n.id))
  }
  // Thông báo mới đến qua websocket khi đang mở cũng thuộc nhóm đầu, dù không có trong
  // ảnh chụp lúc mở.
  const isTopGroup = (n: { id: string; isRead: boolean }) =>
    (firstUnreadIds.current?.has(n.id) ?? false) || !n.isRead

  const today = new Date().setHours(0, 0, 0, 0)
  const unreadNotifs = notifications.filter(isTopGroup)
  const readNotifs = notifications.filter(n => !isTopGroup(n))
  const todayNotifs = readNotifs.filter(n => new Date(n.createdAt).getTime() >= today)
  const olderNotifs = readNotifs.filter(n => new Date(n.createdAt).getTime() < today)

  const renderSection = (title: string, list: typeof notifications) => {
    if (list.length === 0) return null
    return (
      <div className="py-1">
        <p className="px-4 pb-1 pt-2 text-eyebrow">{title}</p>
        {list.map((n) => {
          const config = typeConfig[n.type] || DEFAULT_TYPE
          const Icon = config.icon

          return (
            <div 
              key={n.id} 
              role="button"
              tabIndex={0}
              onClick={() => !n.isRead && markRead.mutate(n.id)}
              onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === '') && !n.isRead) { e.preventDefault(); markRead.mutate(n.id) } }}
              className={cn(
                'group flex cursor-pointer gap-3 border-l-2 px-4 py-3 transition-colors hover:bg-[var(--color-muted)]',
                n.isRead ? 'border-transparent' : 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
              )}
            >
              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-control', config.color)} aria-hidden="true">
                <Icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className={cn('line-clamp-2 text-sm leading-5', n.isRead ? 'text-[var(--color-muted-foreground)]' : 'font-medium text-[var(--color-foreground)]')}>
                    {n.title}
                  </p>
                  {!n.isRead && <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" />}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-[var(--color-muted-foreground)]">
                  {n.message}
                </p>
                <p className="mt-1 text-caption tabular-nums">{formatDateTime(n.createdAt)}</p>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-label="Thông báo"
      className="fixed left-4 right-4 top-14 z-50 overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-popover)] shadow-lg animate-in fade-in-0 motion-reduce:animate-none sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-[380px]"
    >
        {/* Header */}
      <div className="flex h-12 items-center justify-between border-b border-[var(--color-border)] px-4">
          <div className="flex items-center gap-2">
          <h3 className="text-section-title">Thông báo</h3>
            {unreadCount > 0 && (
            <span className="rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-xs font-medium leading-none tabular-nums text-[var(--color-primary-foreground)]">
                {unreadCount} mới
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" type="button" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
            <CheckCheck aria-hidden="true" />
              Đọc tất cả
            </Button>
          )}
        </div>

        {/* Content */}
      <div className="custom-scrollbar max-h-[480px] overflow-y-auto">
          {isLoading ? (
          <div className="space-y-4 p-4" aria-busy="true">
              {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8" />
                <div className="flex-1 space-y-2 py-0.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-8 py-14 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]">
              <Inbox size={22} strokeWidth={1.75} className="text-[var(--color-muted-foreground)]" aria-hidden="true" />
              </div>
            <p className="text-sm font-medium text-[var(--color-foreground)]">Chưa có thông báo</p>
            <p className="mt-1 text-caption">Thông báo về chỉ tiêu, bài nộp và đánh giá sẽ hiện ở đây.</p>
            </div>
          ) : (
            <>
              {renderSection('Chưa đọc', unreadNotifs)}
              {renderSection('Hôm nay', todayNotifs)}
              {renderSection('Trước đó', olderNotifs)}
            <div className="border-t border-[var(--color-border)] p-2">
                <Link 
                  to="/notifications"
                  onClick={onClose}
                className="flex h-8 items-center justify-center rounded-control text-[13px] font-medium text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                >
                  Xem tất cả thông báo
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
  )
}
