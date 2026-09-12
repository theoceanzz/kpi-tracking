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
        <div className={`absolute left-[22px] top-[56px] w-0.5 h-[calc(100%-16px)] transition-colors duration-500 ${lineActive ? 'bg-[var(--color-primary-soft)]' : 'bg-[var(--color-muted)]'}`} />
      )}

      {/* Icon with Ring effect */}
      <div className="relative shrink-0 z-10">
        <div className={`w-11 h-11 rounded-card ${iconBg} flex items-center justify-center shadow-sm transition-transform duration-500 group-hover/card:scale-110`}>
          <Icon size={20} className={iconColor} />
        </div>
        {lineActive && (
          <div className="absolute -inset-1 rounded-card border-2 border-[var(--color-primary)] animate-pulse" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-1 sm:gap-0">
          <p className="text-[13px] font-semibold text-[var(--color-foreground)] uppercase tracking-tight">{title}</p>
          {timeLabel && (
            <span className="text-caption bg-[var(--color-muted)] px-2 py-0.5 rounded-control self-start sm:self-auto">
              {timeLabel}
            </span>
          )}
        </div>

        {children ? (
          <div
            onClick={onClick}
            className={cn(
              'p-5 rounded-card bg-[var(--color-card)] border border-[var(--color-border)] shadow-sm transition-all duration-300 group-hover/card:shadow-md',
              onClick
                ? 'cursor-pointer hover:border-[var(--color-primary)] hover:ring-4 hover:ring-[var(--color-ring)]'
                : 'group-hover/card:border-[var(--color-border)] dark:group-hover/card:border-[var(--color-border-strong)]',
            )}
          >
            {children}
          </div>
        ) : (
          <div className="p-6 rounded-card border border-dashed border-[var(--color-border)] flex items-center justify-center bg-[var(--color-muted)]">
            <span className="text-eyebrow">{emptyLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
}
