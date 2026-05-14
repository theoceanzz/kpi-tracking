import { Bell } from 'lucide-react'
import { useUnreadCount } from '../hooks/useNotifications'
import { useState, useRef } from 'react'
import NotificationDropdown from './NotificationDropdown'
import { useOnClickOutside } from '@/hooks/useOnClickOutside'

export default function NotificationBell() {
  const { data: unreadCount } = useUnreadCount()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useOnClickOutside(containerRef, () => setOpen(false))

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[var(--color-accent)] transition-colors relative"
      >
        <Bell size={18} />
        {unreadCount != null && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[9px] flex items-center justify-center font-black border-2 border-white dark:border-slate-900 shadow-sm leading-none translate-x-1/4 -translate-y-1/4">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && <NotificationDropdown onClose={() => setOpen(false)} />}
    </div>
  )
}
