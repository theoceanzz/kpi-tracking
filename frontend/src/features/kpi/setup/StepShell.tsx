import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

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
        <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white md:text-3xl">{title}</h2>
        {description && <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{description}</p>}
      </div>

      <div
        className={cn(
          !bare &&
            'rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8',
        )}
      >
        {children}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 transition-colors hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
        >
          <ArrowLeft size={14} />
          {backLabel}
        </button>
        {footer}
      </div>
    </div>
  )
}
