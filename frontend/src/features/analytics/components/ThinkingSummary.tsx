import { useState } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ThinkingSummaryProps {
  /** Thời gian trợ lý xử lý lượt này, tính bằng giây. */
  seconds: number
  /** Các bước đã chạy, theo thứ tự. Không có bước nào thì khối này không mở ra được. */
  steps?: string[]
}

/** "dưới 1 giây" / "12 giây" / "1 phút 5 giây" — người Việt đọc thẳng, không cần đơn vị viết tắt. */
function formatDuration(seconds: number): string {
  if (seconds < 1) return 'dưới 1 giây'
  const total = Math.round(seconds)
  if (total < 60) return `${total} giây`
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return rest === 0 ? `${minutes} phút` : `${minutes} phút ${rest} giây`
}

/**
 * Dòng "Đã suy nghĩ N giây" đặt NGAY TRONG bóng bóng trả lời, phía trên một đường kẻ mảnh.
 *
 * <p><b>Vì sao nằm trong bóng bóng.</b> Cùng một nền, cùng một đường viền thì người dùng không có
 * cách nào đọc nhầm thành hai tin nhắn rời — phần tóm tắt và câu trả lời hiển nhiên là một khối.
 *
 * <p><b>Vì sao cho mở ra.</b> Các nhãn tiến độ lướt qua trong lúc chờ rồi mất hẳn. Giữ lại thì
 * người dùng kiểm chứng được trợ lý đã thực sự tra cứu những gì, thay vì phải tin lời nó.
 */
export default function ThinkingSummary({ seconds, steps }: ThinkingSummaryProps) {
  const [open, setOpen] = useState(false)
  const expandable = !!steps?.length

  return (
    <div className="mb-2 pb-2 border-b border-[var(--color-ai-line)]/40">
      <button
        type="button"
        onClick={() => expandable && setOpen(v => !v)}
        aria-expanded={expandable ? open : undefined}
        disabled={!expandable}
        className={cn(
          'flex w-full items-center gap-1.5 text-xs text-[var(--color-ai)] transition-opacity',
          expandable && 'hover:opacity-80 cursor-pointer',
        )}
      >
        <Sparkles size={12} className="shrink-0" />
        <span>Đã suy nghĩ {formatDuration(seconds)}</span>
        {expandable && (
          <ChevronDown
            size={13}
            className={cn('ml-auto shrink-0 transition-transform', open && 'rotate-180')}
          />
        )}
      </button>

      {open && expandable && (
        // Rãnh dọc bên trái buộc các bước lại thành một chuỗi, thay vì mấy dòng chữ rời rạc.
        <ul className="mt-2 ml-1.5 space-y-1 border-l border-[var(--color-ai-line)] pl-3">
          {steps!.map((step, i) => (
            <li
              key={`${i}-${step}`}
              className="relative text-xs text-[var(--color-muted-foreground)] before:absolute
                         before:-left-[15px] before:top-1.5 before:h-1 before:w-1 before:rounded-full
                         before:bg-[var(--color-ai-line)]"
            >
              {step}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
