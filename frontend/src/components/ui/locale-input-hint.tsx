import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Gợi ý sửa định dạng hiện ngay dưới ô đang gõ sai (vd. "Dùng dấu phẩy cho phần thập phân: 1.000,5").
 * Vẽ qua portal, định vị theo toạ độ của ô: không chen phần tử mới vào cạnh ô nên không làm lệch bố cục
 * của bảng / form đang dùng ô đó. z-index trên Dialog của app (1000).
 */
export function LocaleInputHint({ anchor, message }: { anchor: HTMLElement | null; message: string | null }) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useLayoutEffect(() => {
    if (!anchor || !message) return
    const update = () => setRect(anchor.getBoundingClientRect())
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [anchor, message])

  if (!anchor || !message || !rect) return null
  return createPortal(
    <div
      role="alert"
      className="pointer-events-none fixed z-[1200] max-w-xs rounded-control border border-[var(--color-error-border)] bg-[var(--color-card)] px-2 py-1 text-xs text-[var(--color-error)] shadow-md"
      style={{ top: rect.bottom + 4, left: rect.left }}
    >
      {message}
    </div>,
    document.body,
  )
}
