import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface Props {
  title: string
  description?: string
  children: ReactNode
  /** Nút phụ bên trái ở chân trang. Bỏ trống thì chỉ hiện nút Quay lại. */
  footer?: ReactNode
  onBack: () => void
  backLabel?: string
  /** Bỏ khung thẻ khi bước tự dựng bố cục riêng (bước Chỉ tiêu chia hai cột). */
  bare?: boolean
}

/**
 * Vỏ chung của một bước: thẻ trắng bo tròn, tiêu đề, nội dung, và chân trang có nút Quay lại.
 *
 * Gom vào đây để bốn bước không mỗi cái một kiểu bo góc và khoảng cách — thứ dễ trôi nhất khi
 * bốn màn hình được viết ở bốn thời điểm khác nhau.
 */
export default function StepShell({ title, description, children, footer, onBack, backLabel = 'Quay lại', bare }: Props) {
  return (
    // Khung wizard rộng để bước Chỉ tiêu đủ chỗ dàn form hai cột; các bước còn lại là danh sách
    // hoặc form đơn nên tự thu hẹp lại, dòng chữ dài quá màn hình rất khó đọc.
    <div
      className={cn(
        'space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300',
        !bare && 'mx-auto max-w-3xl',
      )}
    >
      <div className="space-y-1">
        <h2 className="text-page-title">{title}</h2>
        {description && <p className="text-sm font-medium text-[var(--color-muted-foreground)]">{description}</p>}
      </div>

      <div
        className={cn(
          !bare &&
            'rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm md:p-8',
        )}
      >
        {children}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          {backLabel}
        </Button>
        {footer}
      </div>
    </div>
  )
}
