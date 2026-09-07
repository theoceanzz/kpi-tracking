import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Khung một bước trên dòng thời gian: đường nối dọc, node icon, hàng tiêu đề
 * và vùng thân tuỳ biến. Tách ra từ timeline của modal đánh giá đợt để trang
 * đánh giá kỳ dùng lại đúng cùng một ngôn ngữ hình ảnh.
 *
 * Không truyền `children` ⇒ hiện ô rỗng nét đứt (`emptyLabel`).
 */
export default function TimelineStep({
  title, icon: Icon, iconBg, iconColor, timeLabel, lineActive, isLast,
  emptyLabel = 'Chưa có đánh giá', onClick, children,
}: {
  title: string
  icon: LucideIcon
  iconBg: string
  iconColor: string
  timeLabel?: string | null
  /** Tô đường nối xuống bước kế tiếp + hiệu ứng ring — dùng khi bước sau đã xong. */
  lineActive?: boolean
  isLast?: boolean
  emptyLabel?: string
  onClick?: () => void
  children?: ReactNode
}) {
  return (
    <div className="relative flex gap-5 group/card">
      {/* Timeline line */}
      {!isLast && (
        <div className={`absolute left-[22px] top-[56px] w-0.5 h-[calc(100%-16px)] transition-colors duration-500 ${lineActive ? 'bg-indigo-300 dark:bg-indigo-700' : 'bg-slate-100 dark:bg-slate-800'}`} />
      )}

      {/* Icon with Ring effect */}
      <div className="relative shrink-0 z-10">
        <div className={`w-11 h-11 rounded-2xl ${iconBg} flex items-center justify-center shadow-sm transition-transform duration-500 group-hover/card:scale-110`}>
          <Icon size={20} className={iconColor} />
        </div>
        {lineActive && (
          <div className="absolute -inset-1 rounded-2xl border-2 border-indigo-500/20 animate-pulse" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-1 sm:gap-0">
          <p className="text-[13px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">{title}</p>
          {timeLabel && (
            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded-md self-start sm:self-auto">
              {timeLabel}
            </span>
          )}
        </div>

        {children ? (
          <div
            onClick={onClick}
            className={cn(
              'p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm transition-all duration-300 group-hover/card:shadow-md',
              onClick
                ? 'cursor-pointer hover:border-indigo-500 hover:ring-4 hover:ring-indigo-500/5'
                : 'group-hover/card:border-slate-200 dark:group-hover/card:border-slate-700',
            )}
          >
            {children}
          </div>
        ) : (
          <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center bg-slate-50/30 dark:bg-slate-900/10">
            <span className="text-xs font-bold text-slate-300 dark:text-slate-700 uppercase tracking-[0.2em]">{emptyLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
}
