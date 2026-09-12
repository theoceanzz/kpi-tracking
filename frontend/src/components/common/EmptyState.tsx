import { Inbox } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
  /** Icon phù hợp ngữ cảnh (mặc định: khay rỗng). Truyền component lucide, không phải element. */
  icon?: LucideIcon
}

/**
 * Trạng thái rỗng: nói rõ VÌ SAO trống và LÀM GÌ tiếp theo. Chỉ có tiêu đề mà không có
 * mô tả/hành động thì người dùng không biết là chưa có dữ liệu hay lỗi tải.
 */
export default function EmptyState({ title, description, action, icon: Icon = Inbox }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]">
        <Icon className="text-[var(--color-muted-foreground)]" size={22} strokeWidth={1.75} aria-hidden="true" />
      </div>
      <h3 className="text-section-title">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-[var(--color-muted-foreground)]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
