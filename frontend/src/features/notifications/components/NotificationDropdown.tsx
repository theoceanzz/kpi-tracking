import { useNotifications } from '../hooks/useNotifications'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'

interface NotificationDropdownProps {
  onClose: () => void
}

export default function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const { data, isLoading } = useNotifications()

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-11 z-50 w-80 bg-[var(--color-card)] rounded-xl shadow-xl border border-[var(--color-border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <h3 className="font-semibold text-sm">Thông báo</h3>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-4"><LoadingSkeleton type="table" rows={3} /></div>
          ) : !data || data.content.length === 0 ? (
            <p className="text-center py-8 text-sm text-[var(--color-muted-foreground)]">Không có thông báo</p>
          ) : (
            data.content.map((n) => (
              <div key={n.id} className={cn('px-4 py-3 border-b border-[var(--color-border)] last:border-0', !n.isRead && 'bg-[var(--color-primary)]/5')}>
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5 line-clamp-2">{n.message}</p>
                <p className="text-[10px] text-[var(--color-muted-foreground)] mt-1">{formatDateTime(n.createdAt)}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
