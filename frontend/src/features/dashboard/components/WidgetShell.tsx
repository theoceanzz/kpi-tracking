import React from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  title: string
  icon?: React.ReactNode
  /** Cụm nút/bộ lọc riêng của widget, đặt bên phải tiêu đề. */
  actions?: React.ReactNode
  isLoading?: boolean
  /** Có lỗi tải dữ liệu — hiện thông điệp + nút thử lại thay vì khung trống. */
  error?: unknown
  onRetry?: () => void
  /** Không có dữ liệu — hiện hướng dẫn thay vì biểu đồ rỗng. */
  isEmpty?: boolean
  emptyMessage?: string
  /** Bỏ khung card khi widget con đã tự vẽ card của nó. */
  bare?: boolean
  children: React.ReactNode
}

/**
 * Khung chung cho mọi widget trang chủ: tiêu đề, skeleton, trạng thái lỗi và trạng thái rỗng.
 * Trước đây mỗi khối tự vẽ khung riêng nên cùng một trang có nhiều kiểu chờ/rỗng khác nhau.
 */
export function WidgetShell({
  title, icon, actions, isLoading, error, onRetry, isEmpty, emptyMessage, bare, children,
}: Props) {
  const body = (() => {
    if (isLoading) {
      return (
        <div className="flex-1 flex flex-col gap-3 py-2" aria-busy="true" aria-live="polite">
          <span className="sr-only">Đang tải {title}</span>
          <div className="h-3 w-2/5 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="flex-1 min-h-[120px] rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
        </div>
      )
    }
    if (error) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-8 px-4">
          <AlertCircle size={28} aria-hidden="true" className="text-red-500/70" strokeWidth={1.5} />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Không tải được dữ liệu</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="min-h-[44px] px-5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-black hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw size={15} aria-hidden="true" /> Thử lại
            </button>
          )}
        </div>
      )
    }
    if (isEmpty) {
      return (
        <div className="flex-1 flex items-center justify-center text-center px-6 py-10">
          <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
            {emptyMessage ?? 'Chưa có dữ liệu trong khoảng thời gian này.'}
          </p>
        </div>
      )
    }
    return children
  })()

  if (bare) return <div className="h-full w-full flex flex-col min-h-0">{body}</div>

  return (
    <section
      aria-label={title}
      className={cn(
        'bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-[28px] border border-slate-200 dark:border-slate-800',
        'shadow-sm h-full flex flex-col min-h-0 overflow-hidden'
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
        <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2 min-w-0">
          {icon && <span className="shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden="true">{icon}</span>}
          <span className="truncate">{title}</span>
        </h3>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{body}</div>
    </section>
  )
}
