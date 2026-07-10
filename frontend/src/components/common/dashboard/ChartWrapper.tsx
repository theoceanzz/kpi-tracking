import React, { useRef } from 'react'
import { Pin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CopyButton } from '@/components/common/CopyButton'

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
  <button
    onClick={() => onTogglePin(widget)}
    className={cn(
      "p-1.5 rounded-lg transition-all",
      widget.isPinned
        ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none"
        : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
    )}
    title={widget.isPinned ? "Bỏ ghim khỏi trang chủ" : "Ghim vào trang chủ"}
  >
    <Pin size={16} fill={widget.isPinned ? "currentColor" : "none"} className={cn(widget.isPinned && "rotate-45")} />
  </button>
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
          <div className="absolute top-5 right-5 z-10 flex items-center gap-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl p-1">
            {extraHeaderContent}
            <PinButton widget={widget} onTogglePin={onTogglePin} />
            <CopyButton targetRef={sectionRef} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-full flex flex-col relative" ref={sectionRef}>
      <div className="flex items-center justify-between gap-2 mb-6">
        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 min-w-0">
          <span className="shrink-0">{icon}</span>
          <span className="truncate">{title}</span>
        </h3>
        <div className="flex items-center gap-2 shrink-0">
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
