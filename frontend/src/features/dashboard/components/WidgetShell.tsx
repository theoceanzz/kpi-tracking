import React from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

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
 *
 * Widget là mức bo góc lớn nhất của hệ thống (12px) — thứ duy nhất được phép, vì nó là
 * khối kéo-thả độc lập trên lưới chứ không phải card nằm trong luồng nội dung.
 */
export function WidgetShell({
  title, icon, actions, isLoading, error, onRetry, isEmpty, emptyMessage, bare, children,
}: Props) {
  const body = (() => {
    if (isLoading) {
      return (
        <div className="flex flex-1 flex-col gap-3 py-1" aria-busy="true" aria-live="polite">
          <span className="sr-only">Đang tải {title}</span>
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="min-h-[120px] flex-1" />
        </div>
      )
    }
    if (error) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-center">
          <AlertCircle size={24} aria-hidden="true" className="text-[var(--color-error)]" strokeWidth={1.75} />
          <p className="text-sm font-medium text-[var(--color-foreground)]">Không tải được dữ liệu</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RotateCcw aria-hidden="true" /> Thử lại
            </Button>
          )}
        </div>
      )
    }
    if (isEmpty) {
      return (
        <div className="flex flex-1 items-center justify-center px-6 py-10 text-center">
          <p className="max-w-xs text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            {emptyMessage ?? 'Chưa có dữ liệu trong khoảng thời gian này.'}
          </p>
        </div>
      )
    }
    return children
  })()

  if (bare) return <div className="flex h-full w-full min-h-0 flex-col">{body}</div>

  return (
    <section
      aria-label={title}
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-widget border border-[var(--color-border)] bg-[var(--color-card)] p-4 sm:p-5'
      )}
    >
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <h3 className="flex min-w-0 items-center gap-2 text-section-title">
          {icon && <span className="shrink-0 text-[var(--color-muted-foreground)]" aria-hidden="true">{icon}</span>}
          <span className="truncate">{title}</span>
        </h3>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{body}</div>
    </section>
  )
}
