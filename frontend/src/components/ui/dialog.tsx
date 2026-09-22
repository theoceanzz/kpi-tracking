import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Khung modal / drawer chuẩn của KeyGo (UX_PATTERNS.md §P0).
 *
 * Tự lo: lớp phủ z-[1000], khoá cuộn body, Esc và bấm nền để đóng, đưa focus vào hộp thoại
 * khi mở và trả focus về nút đã mở khi đóng, `role="dialog"`+`aria-modal` + nhãn.
 * Trang chỉ điền tiêu đề, thân, và footer qua `DialogFooter` để thứ tự nút thống nhất.
 *
 * Không dùng @radix-ui/react-dialog: dự án chưa có dependency đó, và 64 modal hiện tại đều
 * đang tự dựng bằng `fixed inset-0` — khung này thay thế chúng dần mà không đổi cách gọi.
 */

type Size = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'

const DIALOG_WIDTH: Record<Size, string> = {
  sm: 'max-w-sm',    // xác nhận, nhập một trường
  md: 'max-w-lg',    // form 3–6 trường
  lg: 'max-w-2xl',   // form nhiều cột / bảng nhỏ
  xl: 'max-w-4xl',   // xem trước import, ma trận
  '2xl': 'max-w-6xl', // phiếu chấm có dãy 6 thẻ số + bảng
  full: 'max-w-[min(96vw,1400px)]',
}

const DRAWER_WIDTH: Record<Size, string> = {
  sm: 'w-full sm:w-[360px]',
  md: 'w-full sm:w-[480px]',
  lg: 'w-full sm:w-[640px]',
  xl: 'w-full sm:w-[800px]',
  '2xl': 'w-full sm:w-[960px]',
  full: 'w-full sm:w-[min(96vw,1100px)]',
}

interface ShellProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  /** Nút/badge đứng cạnh tiêu đề (vd trạng thái). */
  headerExtra?: ReactNode
  footer?: ReactNode
  size?: Size
  /** Cho phép đóng bằng Esc / bấm nền. Tắt khi đang lưu dở để không mất dữ liệu. */
  dismissible?: boolean
  /** Thân không có padding — cho bảng/preview tràn mép. */
  flush?: boolean
  /** Neo cho hướng dẫn (tour-*). */
  id?: string
  className?: string
  children: ReactNode
}

function useDialogBehaviour(open: boolean, onClose: () => void, dismissible: boolean) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus vào phần tử tương tác đầu tiên; không có thì vào chính panel.
    const t = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        'input:not([type=hidden]),select,textarea,button:not([data-dialog-close]),[href],[tabindex]:not([tabindex="-1"])',
      )
      ;(first ?? panelRef.current)?.focus()
    }, 0)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) { e.stopPropagation(); onClose() }
      // Giữ focus trong hộp thoại khi Tab qua đầu/cuối.
      if (e.key === 'Tab' && panelRef.current) {
        const nodes = panelRef.current.querySelectorAll<HTMLElement>(
          'input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])',
        )
        if (nodes.length === 0) return
        const first = nodes[0]!, last = nodes[nodes.length - 1]!
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      window.clearTimeout(t)
      restoreRef.current?.focus?.()
    }
  }, [open, onClose, dismissible])

  return panelRef
}

function Header({ title, description, headerExtra, onClose, titleId, descId }: {
  title: ReactNode; description?: ReactNode; headerExtra?: ReactNode; onClose: () => void; titleId: string; descId: string
}) {
  return (
    <div className="flex shrink-0 items-start gap-3 border-b border-[var(--color-border)] px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 id={titleId} className="text-section-title truncate">{title}</h2>
          {headerExtra}
        </div>
        {description && <p id={descId} className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">{description}</p>}
      </div>
      <button
        type="button"
        data-dialog-close
        onClick={onClose}
        aria-label="Đóng"
        className="-mr-1.5 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      >
        <X size={18} />
      </button>
    </div>
  )
}

export function Dialog({
  open, onClose, title, description, headerExtra, footer, size = 'md', dismissible = true, flush, id, className, children,
}: ShellProps) {
  const panelRef = useDialogBehaviour(open, onClose, dismissible)
  const base = useId()
  const ids = { title: `${base}-title`, desc: `${base}-desc` }
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-950/50" aria-hidden="true" onClick={dismissible ? onClose : undefined} />
      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ids.title}
        aria-describedby={description ? ids.desc : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-t-card border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg outline-none',
          'sm:max-h-[calc(100dvh-2rem)] sm:rounded-card animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none',
          DIALOG_WIDTH[size],
          className,
        )}
      >
        <Header title={title} description={description} headerExtra={headerExtra} onClose={onClose} titleId={ids.title} descId={ids.desc} />
        <div className={cn('custom-scrollbar min-h-0 flex-1 overflow-y-auto', !flush && 'p-5')}>{children}</div>
        {footer}
      </div>
    </div>,
    document.body,
  )
}

/** Bảng trượt từ mép phải — cho xem/sửa một bản ghi mà vẫn thấy danh sách phía sau. */
export function Drawer({
  open, onClose, title, description, headerExtra, footer, size = 'md', dismissible = true, flush, id, className, children,
}: ShellProps) {
  const panelRef = useDialogBehaviour(open, onClose, dismissible)
  const base = useId()
  const ids = { title: `${base}-title`, desc: `${base}-desc` }
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex justify-end">
      <div className="absolute inset-0 bg-slate-950/50" aria-hidden="true" onClick={dismissible ? onClose : undefined} />
      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ids.title}
        aria-describedby={description ? ids.desc : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex h-full flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-card)] shadow-lg outline-none',
          'animate-in slide-in-from-right-4 fade-in-0 motion-reduce:animate-none',
          DRAWER_WIDTH[size],
          className,
        )}
      >
        <Header title={title} description={description} headerExtra={headerExtra} onClose={onClose} titleId={ids.title} descId={ids.desc} />
        <div className={cn('custom-scrollbar min-h-0 flex-1 overflow-y-auto', !flush && 'p-5')}>{children}</div>
        {footer}
      </div>
    </div>,
    document.body,
  )
}

/**
 * Footer với thứ tự nút cố định toàn hệ thống:
 *   [phá huỷ — bên trái, cách xa]   …   [phụ: Hủy / Đóng]  [chính: Lưu / Xác nhận]
 * Nút chính luôn ở góc phải ngoài cùng; nút phá huỷ (Xoá) không bao giờ đứng cạnh nút chính.
 * `note` là dòng chữ nhỏ bên trái (vd "Có thay đổi chưa lưu") khi không có nút phá huỷ.
 */
export function DialogFooter({ primary, secondary, destructive, note }: {
  primary?: ReactNode; secondary?: ReactNode; destructive?: ReactNode; note?: ReactNode
}) {
  return (
    // Dưới 640px hộp thoại là bottom-sheet: ghi chú nằm trên, hàng nút chia đều bề ngang —
    // để chung một hàng thì ghi chú bị ép thành cột hẹp, mỗi dòng một chữ.
    <div className="flex shrink-0 flex-col gap-2 border-t border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 sm:flex-row sm:items-center sm:px-5">
      {destructive ?? (note && <p className="text-caption">{note}</p>)}
      <div className="flex items-center gap-2 sm:ml-auto [&>*]:flex-1 sm:[&>*]:flex-none">
        {secondary}
        {primary}
      </div>
    </div>
  )
}
