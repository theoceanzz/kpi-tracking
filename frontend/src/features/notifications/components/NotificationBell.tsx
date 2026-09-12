import { Bell } from 'lucide-react'
import { useUnreadCount } from '../hooks/useNotifications'
import { useWebSocketNotifications } from '../hooks/useWebSocketNotifications'
import { useState, useRef } from 'react'
import NotificationDropdown from './NotificationDropdown'
import { useOnClickOutside } from '@/hooks/useOnClickOutside'
import { Button } from '@/components/ui/button'

/**
 * Chuông thông báo trên header. Số chưa đọc là huy hiệu nhỏ góc trên phải — không nhấp
 * nháy, không bóng: nó phải thấy được khi liếc qua chứ không được kéo mắt liên tục.
 */
export default function NotificationBell() {
  useWebSocketNotifications()
  const { data: unreadCount } = useUnreadCount()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useOnClickOutside(containerRef, () => setOpen(false))

  const hasUnread = unreadCount != null && unreadCount > 0

  return (
    <div className="relative" ref={containerRef}>
      <Button variant="secondary" type="button" onClick={() => setOpen(!open)} aria-label={hasUnread ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'} aria-expanded={open} aria-haspopup="dialog">
        <Bell aria-hidden="true" />
        {hasUnread && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-[var(--color-card)] bg-[var(--color-destructive)] px-1 text-xs font-semibold leading-none tabular-nums text-white"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>
      {open && <NotificationDropdown onClose={() => setOpen(false)} />}
    </div>
  )
}
