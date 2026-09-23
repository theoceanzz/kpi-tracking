import type { MouseEvent } from 'react'
import { Bot } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAiAssistantStore } from '@/store/aiAssistantStore'
import { useAiAvailable } from '../hooks/useAiAvailable'

interface Props {
  /** Câu hỏi sẽ được gửi NGAY khi bấm — lấy từ `aiShortcuts` để câu chữ khớp bộ đo. */
  prompt: string
  /** Đơn vị trang đang xem, để trợ lý hiểu "đơn vị tôi" đúng như màn hình. */
  focusUnitId?: string
  label?: string
  title?: string
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  className?: string
  disabled?: boolean
}

/**
 * Nút "K.AI" đặt cạnh một thao tác mà trợ lý đã có tool xử lý: bấm là bong bóng chat mở, câu hỏi
 * được gửi luôn (không phải gõ, không phải Enter). Với thao tác GHI, trợ lý trả về lời mời xác
 * nhận liệt kê từng mục — người dùng vẫn là người bấm xác nhận.
 *
 * <p>Nút tự ẩn khi người dùng không dùng được K.AI (cùng điều kiện với bong bóng). Quyền NGHIỆP VỤ
 * thì trang gác: chỉ đặt nút cạnh việc người dùng vốn được làm, đừng dựa vào trợ lý từ chối.
 */
export default function AiShortcutButton({
  prompt, focusUnitId, label = 'K.AI', title, variant = 'outline', size, className, disabled,
}: Props) {
  const available = useAiAvailable()
  const ask = useAiAssistantStore(s => s.ask)
  if (!available) return null

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    // Nút hay nằm trong hàng bấm được (menu dòng, thẻ) — không để cú bấm lan lên mở thứ khác.
    e.stopPropagation()
    ask(prompt, { focusUnitId })
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled}
      onClick={onClick}
      title={title ?? prompt}
      aria-label={`K.AI: ${prompt}`}
      className={cn(
        variant === 'outline' && 'border-[var(--color-ai-line)] text-[var(--color-ai)] hover:bg-[var(--color-ai-soft)] hover:border-[var(--color-ai-line)]',
        variant === 'ghost' && 'text-[var(--color-ai)] hover:bg-[var(--color-ai-soft)]',
        className,
      )}
    >
      <Bot aria-hidden="true" /> {label}
    </Button>
  )
}
