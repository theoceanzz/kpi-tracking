import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

/** Đầu trang: tiêu đề cấp 1 + mô tả một dòng, nút hành động chính căn phải. */
export default function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="text-page-title">{title}</h1>
        {description && <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}
