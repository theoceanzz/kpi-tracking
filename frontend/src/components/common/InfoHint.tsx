import { useId, useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * Trạng thái mở của tooltip gợi ý: mở khi rê chuột, Tab bằng bàn phím, hoặc chạm (điện thoại). KHÔNG mở khi
 * focus do chương trình đặt (hộp thoại tự focus phần tử đầu tiên) — nếu không, mở hộp thoại là bật tooltip.
 */
function useHintOpen() {
  const [open, setOpen] = useState(false)
  const id = useId()
  const onOpenChange = (o: boolean) => {
    if (!o || document.getElementById(id)?.matches(':hover, :focus-visible')) setOpen(o)
  }
  return { open, setOpen, id, onOpenChange }
}

/**
 * Biểu tượng ⓘ đặt cạnh nhãn — rê chuột / Tab tới / chạm (điện thoại) để xem giải thích ngắn.
 * Dùng cho thuật ngữ người dùng có thể chưa hiểu, thay cho một dòng chú thích dài luôn hiện.
 */
export function InfoHint({ children, label = 'Giải thích', side = 'top', className }: {
  children: ReactNode
  label?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}) {
  const h = useHintOpen()
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={h.open} onOpenChange={h.onOpenChange}>
        <TooltipTrigger asChild>
          <button
            id={h.id}
            type="button"
            aria-label={label}
            // Radix Tooltip không mở khi chạm — tự bật/tắt để chạm cũng xem được.
            onClick={e => { e.preventDefault(); h.setOpen(o => !o) }}
            className={cn(
              'inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full align-middle',
              'text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-primary)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
              className,
            )}
          >
            <Info size={14} aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-[260px] text-left">{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Bọc một phần tử có sẵn (badge, con số…) bằng tooltip — thêm gạch chân chấm để người dùng biết rê vào được.
 */
export function HintOn({ hint, children, className }: { hint: ReactNode; children: ReactNode; className?: string }) {
  const h = useHintOpen()
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={h.open} onOpenChange={h.onOpenChange}>
        <TooltipTrigger asChild>
          <span
            id={h.id}
            tabIndex={0}
            onClick={() => h.setOpen(o => !o)}
            className={cn('cursor-help rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]', className)}
          >
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px] text-left">{hint}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
