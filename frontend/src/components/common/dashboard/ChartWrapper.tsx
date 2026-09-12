import React, { useRef } from 'react'
import { Pin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CopyButton } from '@/components/common/CopyButton'
import { ChoiceChip } from '@/components/ui/choice-chip'

/** Widget cấu hình được cho lưới dashboard tuỳ chỉnh (dùng chung nhiều tab thống kê). */
export interface DashboardWidget {
  id?: string
  i: string
  type: string
  title: string
  x: number
  y: number
  w: number
  h: number
  visible: boolean
  isPinned?: boolean
}

export const PinButton = ({ widget, onTogglePin }: { widget: DashboardWidget, onTogglePin: (w: DashboardWidget) => void }) => (
  <ChoiceChip selected={!!widget.isPinned} onClick={() => onTogglePin(widget)} title={widget.isPinned ? "Bỏ ghim khỏi trang chủ" : "Ghim vào trang chủ"} aria-label={widget.isPinned ? "Bỏ ghim khỏi trang chủ" : "Ghim vào trang chủ"} aria-pressed={!!widget.isPinned}>
    <Pin fill={widget.isPinned ? "currentColor" : "none"} className={cn(widget.isPinned && "rotate-45")} />
  </ChoiceChip>
)

/**
 * Bọc nội dung 1 widget: cấp card + tiêu đề + cụm Ghim/Copy. Chế độ `chromeless` giữ nguyên
 * card/tiêu đề GỐC của biểu đồ con (chỉ nổi cụm Ghim/Copy ở góc phải).
 */
export const ChartWrapper = ({ children, title, icon, widget, onTogglePin, isEditMode, extraHeaderContent, chromeless }: {
  children: React.ReactNode,
  title: string,
  icon: React.ReactNode,
  widget: DashboardWidget,
  onTogglePin: (w: DashboardWidget) => void,
  isEditMode: boolean,
  extraHeaderContent?: React.ReactNode,
  chromeless?: boolean
}) => {
  const sectionRef = useRef<HTMLDivElement>(null)

  if (chromeless) {
    return (
      <div className="relative h-full" ref={sectionRef}>
        {children}
        {!isEditMode && (
          <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-control bg-[var(--color-card)] p-0.5">
            {extraHeaderContent}
            <PinButton widget={widget} onTogglePin={onTogglePin} />
            <CopyButton targetRef={sectionRef} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-widget border border-[var(--color-border)] bg-[var(--color-card)] p-4 sm:p-5" ref={sectionRef}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 text-section-title">
          <span className="shrink-0 text-[var(--color-muted-foreground)] [&_svg]:size-4" aria-hidden="true">{icon}</span>
          <span className="truncate">{title}</span>
        </h3>
        <div className="flex shrink-0 items-center gap-1">
          {extraHeaderContent}
          {!isEditMode && (
            <>
              <PinButton widget={widget} onTogglePin={onTogglePin} />
              <CopyButton targetRef={sectionRef} />
            </>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}
