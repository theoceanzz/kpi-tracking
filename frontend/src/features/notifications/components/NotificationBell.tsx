import { Bell } from 'lucide-react'
import { useUnreadCount } from '../hooks/useNotifications'
import { useState } from 'react'
import NotificationDropdown from './NotificationDropdown'

export default function NotificationBell() {
  const { data: unreadCount } = useUnreadCount()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[var(--color-accent)] transition-colors relative"
      >
        <Bell size={18} />
        {unreadCount != null && unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && <NotificationDropdown onClose={() => setOpen(false)} />}
    </div>
  )
}
