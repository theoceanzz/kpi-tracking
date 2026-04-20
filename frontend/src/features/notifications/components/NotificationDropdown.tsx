import { useNotifications, useMarkAllRead, useMarkAsRead } from '../hooks/useNotifications'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { CheckCheck, Bell, Send, FileSearch, ShieldCheck, Target, Inbox } from 'lucide-react'
import { Link } from 'react-router-dom'

interface NotificationDropdownProps {
  onClose: () => void
}

const typeConfig: Record<string, { icon: any, color: string }> = {
  SUBMISSION: { icon: Send, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
  REVIEW: { icon: FileSearch, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' },
  KPI_APPROVED: { icon: ShieldCheck, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' },
  KPI_ASSIGNED: { icon: Target, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' },
}

export default function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const { data, isLoading } = useNotifications()
  const markAllRead = useMarkAllRead()
  const markRead = useMarkAsRead()

  const notifications = data?.content || []
  const unreadCount = notifications.filter(n => !n.isRead).length

  // Simple grouping: Today vs Older
  const today = new Date().setHours(0, 0, 0, 0)
  const todayNotifs = notifications.filter(n => new Date(n.createdAt).getTime() >= today)
  const olderNotifs = notifications.filter(n => new Date(n.createdAt).getTime() < today)

  const renderSection = (title: string, list: typeof notifications) => {
    if (list.length === 0) return null
    return (
      <div className="py-2">
        <div className="px-4 py-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</span>
        </div>
        {list.map((n) => {
          const config = typeConfig[n.type] || { icon: Bell, color: 'text-slate-500 bg-slate-50 dark:bg-slate-800' }
          const Icon = config.icon

          return (
            <div 
              key={n.id} 
              onClick={() => !n.isRead && markRead.mutate(n.id)}
              className={cn(
                'group px-4 py-4 flex gap-4 cursor-pointer transition-all border-l-4',
                n.isRead 
                  ? 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50' 
                  : 'border-indigo-600 bg-indigo-50/30 dark:bg-indigo-900/10 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20'
              )}
            >
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110', config.color)}>
                <Icon size={18} />
              </div>
              <div className="flex-1 space-y-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <p className={cn('text-sm leading-tight line-clamp-2', n.isRead ? 'text-slate-600 dark:text-slate-400 font-medium' : 'text-slate-900 dark:text-white font-bold')}>
                    {n.title}
                  </p>
                  {!n.isRead && <div className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1.5" />}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-500 line-clamp-2 leading-relaxed">
                  {n.message}
                </p>
                <p className="text-[10px] font-medium text-slate-400 group-hover:text-slate-500 transition-colors">
                  {formatDateTime(n.createdAt)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/5 dark:bg-black/20" onClick={onClose} />
      <div className="absolute right-0 top-12 z-50 w-[380px] bg-white dark:bg-slate-900 rounded-[24px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-base">Thông báo</h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                {unreadCount} mới
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button 
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors disabled:opacity-50"
            >
              <CheckCheck size={14} />
              Đọc tất cả
            </button>
          )}
        </div>

        {/* Content */}
        <div className="max-h-[480px] overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-4 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-3/4" />
                    <div className="h-3 bg-slate-50 dark:bg-slate-800/50 rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center px-10">
              <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4">
                <Inbox size={32} className="text-slate-200 dark:text-slate-700" />
              </div>
              <p className="font-bold text-slate-900 dark:text-white mb-1">Hộp thư trống</p>
              <p className="text-xs text-slate-400">Bạn chưa có bất kỳ thông báo nào từ hệ thống.</p>
            </div>
          ) : (
            <>
              {renderSection('Hôm nay', todayNotifs)}
              {renderSection('Trước đó', olderNotifs)}
              <div className="p-4 border-t border-slate-50 dark:border-slate-800 text-center">
                <Link 
                  to="/notifications"
                  onClick={onClose}
                  className="inline-block text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest"
                >
                  Xem tất cả thông báo
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
