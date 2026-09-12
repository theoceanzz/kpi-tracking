import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BulkActionBarProps {
  /** Số hàng đang chọn. `0` thì thanh ẩn hẳn. */
  count: number
  onClear: () => void
  /** Các nút hành động — nút chính là nút đặc DUY NHẤT, đặt cuối cùng. */
  children: ReactNode
  /** Nhãn đơn vị đếm: "Đã chọn 3 chỉ tiêu". */
  itemLabel?: string
}

/**
 * Thanh hành động hàng loạt (UX_PATTERNS.md §R2). Dính đáy khung nhìn, cao 56px, nền card +
 * viền trên + bóng mức 2 — cùng một chỗ, cùng một hình ở mọi trang có chọn nhiều. Portal ra
 * body để không bị khung cuộn của <main> cắt.
 */
export default function BulkActionBar({ count, onClear, children, itemLabel = 'mục' }: BulkActionBarProps) {
  if (count <= 0) return null
  return createPortal(
    <div
      role="region"
      aria-label="Hành động với các mục đã chọn"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 pointer-events-none"
    >
      <div className="pointer-events-auto flex h-14 w-full max-w-3xl items-center gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] px-4 shadow-md animate-in slide-in-from-bottom-2 fade-in-0 motion-reduce:animate-none">
        <p className="text-sm text-[var(--color-foreground)]">
          Đã chọn <span className="font-semibold tabular-nums">{count}</span> {itemLabel}
        </p>
        <Button variant="ghost" size="sm" onClick={onClear} aria-label="Bỏ chọn tất cả">
          <X aria-hidden="true" /> Bỏ chọn
        </Button>
        <div className="ml-auto flex items-center gap-2">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
