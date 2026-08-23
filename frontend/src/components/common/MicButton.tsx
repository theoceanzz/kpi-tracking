import { Mic, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSpeechInput } from '@/hooks/useSpeechInput'

interface MicButtonProps {
  /** Chữ đọc được, đã nối sẵn với phần người dùng gõ dở. Cứ ghi thẳng vào ô. */
  onText: (fullText: string) => void
  /** Chữ đang có trong ô. Đọc lúc bấm để nối thêm chứ không ghi đè. */
  getBaseText: () => string
  disabled?: boolean
  className?: string
}

/**
 * Nút đọc chính tả cho một ô nhập.
 *
 * <p><b>Không hỗ trợ thì KHÔNG vẽ gì</b> (Firefox chưa có Web Speech API). Vẽ một cái nút bấm vào
 * không làm gì là kiểu hứa suông mà dự án này đã phải đi sửa nhiều lần — thà không có còn hơn.
 *
 * <p>Trạng thái đang nghe phải THẤY RÕ: micro đang mở mà người dùng không biết là chuyện riêng tư,
 * không phải chuyện thẩm mỹ. Nên lúc nghe thì đổi hẳn sang biểu tượng dừng, nền đỏ, kèm chấm nhấp
 * nháy.
 */
export function MicButton({ onText, getBaseText, disabled, className }: MicButtonProps) {
  const { supported, listening, start } = useSpeechInput({ onText, getBaseText })

  if (!supported) return null

  return (
    <button
      type="button"
      onClick={start}
      disabled={disabled}
      aria-label={listening ? 'Dừng đọc' : 'Đọc bằng giọng nói'}
      aria-pressed={listening}
      title={listening ? 'Đang nghe — bấm để dừng' : 'Đọc bằng giọng nói'}
      className={cn(
        'relative inline-flex items-center justify-center rounded-lg p-2 transition-colors',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        listening
          ? 'bg-red-500 text-white hover:bg-red-600'
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800',
        className,
      )}
    >
      {listening ? <Square size={16} className="fill-current" /> : <Mic size={16} />}
      {listening && (
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-400 animate-pulse" />
      )}
    </button>
  )
}

export default MicButton
