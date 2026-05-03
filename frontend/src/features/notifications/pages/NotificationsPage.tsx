import { useState } from 'react'
import { useNotifications, useMarkAllRead, useMarkAsRead } from '../hooks/useNotifications'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import { 
  Bell, CheckCheck, Send, 
  FileSearch, ShieldCheck, Target, 
  Clock, CheckCircle2
} from 'lucide-react'

const typeConfig: Record<string, { icon: any, color: string, label: string }> = {
  SUBMISSION: { icon: Send, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20', label: 'Báo cáo mới' },
  REVIEW: { icon: FileSearch, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20', label: 'Đánh giá' },
  KPI_APPROVED: { icon: ShieldCheck, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20', label: 'Duyệt chỉ tiêu' },
  KPI_ASSIGNED: { icon: Target, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20', label: 'Giao chỉ tiêu' },
}

export default function NotificationsPage() {
  const [page] = useState(0)
  const { data, isLoading } = useNotifications(page, 50)
  const markAllRead = useMarkAllRead()
  const markRead = useMarkAsRead()
  
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL')

  const notifications = data?.content || []
  const filteredNotifs = filter === 'UNREAD' ? notifications.filter(n => !n.isRead) : notifications
  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-2xl" />
        
        <div className="relative z-10 space-y-1">
          <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <Bell size={28} className="text-indigo-600" />
            Trung tâm Thông báo
          </h1>
          <p className="text-slate-500 font-medium">Bạn có {unreadCount} thông báo mới chưa đọc.</p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <button 
            onClick={() => markAllRead.mutate()}
            disabled={unreadCount === 0 || markAllRead.isPending}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all disabled:opacity-50 active:scale-95"
          >
            <CheckCheck size={18} />
            Đọc tất cả
          </button>
        </div>
      </div>

      {/* Toolbar & Filter */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button 
            onClick={() => setFilter('ALL')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
              filter === 'ALL' ? "bg-white dark:bg-slate-700 text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Tất cả
          </button>
          <button 
            onClick={() => setFilter('UNREAD')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
              filter === 'UNREAD' ? "bg-white dark:bg-slate-700 text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Chưa đọc
          </button>
        </div>

        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <Clock size={12} />
          Cập nhật mỗi 30 giây
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {isLoading ? (
          <LoadingSkeleton type="table" rows={6} />
        ) : filteredNotifs.length === 0 ? (
          <div className="py-20 bg-white dark:bg-slate-900 rounded-[32px] border border-dashed border-slate-200 dark:border-slate-800">
            <EmptyState 
              title="Hộp thư trống" 
              description={filter === 'UNREAD' ? "Tuyệt vời! Bạn không có thông báo nào chưa đọc." : "Bạn chưa nhận được thông báo nào từ hệ thống."}
            />
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-sm">
            {filteredNotifs.map((n) => {
              const config = typeConfig[n.type] || { icon: Bell, color: 'text-slate-500 bg-slate-50', label: 'Thông báo' }
              const Icon = config.icon
              
              return (
                <div 
                  key={n.id}
                  onClick={() => !n.isRead && markRead.mutate(n.id)}
                  className={cn(
                    "group p-6 flex gap-6 cursor-pointer transition-all border-l-4",
                    n.isRead 
                      ? "border-transparent hover:bg-slate-50/50 dark:hover:bg-slate-800/30" 
                      : "border-indigo-600 bg-indigo-50/30 dark:bg-indigo-900/10 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20"
                  )}
                >
                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm", config.color)}>
                    <Icon size={24} />
                  </div>

                  <div className="flex-1 space-y-1.5">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500/70">{config.label}</span>
                        <h3 className={cn("text-base leading-tight", n.isRead ? "text-slate-700 dark:text-slate-300 font-semibold" : "text-slate-900 dark:text-white font-black")}>
                          {n.title}
                        </h3>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-[10px] font-bold text-slate-400">{formatDateTime(n.createdAt)}</span>
                        {!n.isRead && (
                           <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-600/10 text-indigo-600 text-[10px] font-black uppercase tracking-tighter">
                             <div className="w-1 h-1 rounded-full bg-indigo-600" />
                             Mới
                           </div>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-2xl">
                      {n.message}
                    </p>

                    {n.isRead && (
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 pt-1">
                        <CheckCircle2 size={12} /> Đã đọc vào {formatDateTime(n.readAt!)}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
