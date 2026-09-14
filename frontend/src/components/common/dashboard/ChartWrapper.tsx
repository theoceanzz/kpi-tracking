import React, { useRef } from 'react'
import { Pin } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WidgetSettings } from './widgetSettings'

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
  /** Cấu hình riêng của ô — bộ lọc và cách biểu diễn. Xem {@link WidgetSettings}. */
  s?: WidgetSettings
}

/**
 * Nút ghim rời — vẫn dùng ở thẻ đã ghim ngoài trang chủ. Trên lưới thì việc ghim nằm trong menu
 * của ô, không còn phơi thành một nút riêng.
 */
export const PinButton = ({ widget, onTogglePin }: { widget: DashboardWidget, onTogglePin: (w: DashboardWidget) => void }) => (
  <button
    onClick={() => onTogglePin(widget)}
    className={cn(
      "p-1.5 rounded-lg transition-all",
      widget.isPinned
        ? "bg-[var(--color-primary)] text-white shadow-sm dark:shadow-none"
        : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
    )}
    title={widget.isPinned ? "Bỏ ghim khỏi trang chủ" : "Ghim vào trang chủ"}
  >
    <Pin size={16} fill={widget.isPinned ? "currentColor" : "none"} className={cn(widget.isPinned && "rotate-45")} />
  </button>
)

/**
 * Bọc nội dung 1 widget: cấp card + tiêu đề. Chế độ `chromeless` giữ nguyên card/tiêu đề GỐC của
 * biểu đồ con.
 *
 * <p>Cụm Ghim/Copy từng nằm ở góc phải đã chuyển vào MENU của ô trên lưới
 * (`DashboardCustomizeChrome`): hai icon phơi sẵn ở mỗi widget nhân lên hàng chục lần trên một
 * trang, trong khi mỗi cái chỉ dùng đến rất thưa. Gom vào một nút cũng là chỗ để thêm "Cấu hình"
 * và "Xoá" mà không làm góc thẻ đông thêm.
 */
export const ChartWrapper = ({ children, title, icon, extraHeaderContent, chromeless, meta }: {
  children: React.ReactNode,
  title: string,
  icon: React.ReactNode,
  extraHeaderContent?: React.ReactNode,
  chromeless?: boolean,
  /**
   * Dòng tóm tắt "ô này đang theo cấu hình gì" đặt ngay dưới tiêu đề. Ở chế độ `chromeless`
   * component con tự vẽ header nên phải tự nhận và đặt `meta` — ở đây không đè overlay lên.
   */
  meta?: React.ReactNode,
}) => {
  const sectionRef = useRef<HTMLDivElement>(null)

  if (chromeless) {
    return (
      <div className="relative h-full" ref={sectionRef}>
        {children}
        {extraHeaderContent && (
          // Chừa chỗ cho menu của ô ở sát góc: đẩy cụm này lùi vào trong.
          <div className="absolute top-5 right-14 z-10 flex items-center gap-2 bg-white dark:bg-slate-900 rounded-lg p-1">
            {extraHeaderContent}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-full flex flex-col relative" ref={sectionRef}>
      <div className="flex items-center justify-between gap-2 mb-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2 min-w-0">
          <span className="shrink-0">{icon}</span>
          <span className="truncate">{title}</span>
        </h3>
        {/* Chừa chỗ cho menu của ô — nó nằm đè lên góc phải trên của thẻ. */}
        <div className="flex items-center gap-2 shrink-0 pr-9">
          {extraHeaderContent}
        </div>
      </div>
      {meta && <div className="-mt-4 mb-4">{meta}</div>}
      {children}
    </div>
  )
}
