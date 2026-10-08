import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Maximize2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ChartWrapper } from '@/components/common/dashboard/ChartWrapper'
import { cn } from '@/lib/utils'

/**
 * Chế độ trình chiếu cho các ô SƠ ĐỒ (bản đồ chiến lược, xương cá) — BRD §8: đây là những hình
 * dành cho họp, workshop, màn hình lớn, nên phải phủ kín màn hình chứ không nằm trong một ô lưới.
 *
 * <p>BẮT BUỘC `createPortal` ra `document.body`. Lưới dashboard định vị từng ô bằng CSS
 * `transform` (`index.css`), nên một `position: fixed` dựng BÊN TRONG ô lấy chính ô đó làm khung
 * tham chiếu — và `GridCell` còn `overflow-hidden` cắt mọi thứ tràn ra. Làm tại chỗ thì "toàn màn
 * hình" chỉ phủ đúng một ô, không che nổi sidebar.
 *
 * <p>Xin thêm toàn màn hình của trình duyệt để ẩn cả thanh địa chỉ; không được thì thôi, lớp phủ
 * đã che hết giao diện ứng dụng.
 */
export default function PresentationShell({ open, title, subtitle, onClose, children }: {
  open: boolean
  title: string
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  const { t } = useTranslation('analytics')

  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Có modal/drawer mở bên trên thì Escape thuộc về nó (khuôn của ProcessCanvas).
      if (document.querySelector('[role="dialog"]')) return
      onClose()
    }
    // Trình duyệt tự rời toàn màn hình (Esc, F11) thì thoát luôn chế độ trình chiếu, không để lại
    // một lớp phủ mà người dùng tưởng đã đóng.
    const onFullscreenChange = () => { if (!document.fullscreenElement) onClose() }

    document.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    const bodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    void document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {})

    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.body.style.overflow = bodyOverflow
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {})
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex flex-col bg-[var(--color-background)]"
      role="region"
      aria-label={title}
    >
      {/* `data-copy-exclude`: "Sao chép ảnh" chụp cả vùng này, không lọc thì ảnh dính thanh công cụ. */}
      <header
        data-copy-exclude
        className="flex items-center justify-between gap-4 px-6 py-3 border-b border-[var(--color-border)]"
      >
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-[var(--color-foreground)] truncate">{title}</h3>
          {subtitle && <div className="mt-0.5 text-xs font-medium text-slate-400">{subtitle}</div>}
        </div>
        <button
          type="button"
          onClick={onClose}
          title={t('presentation.exit')}
          aria-label={t('presentation.exit')}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-control border border-[var(--color-border)] text-sm font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] cursor-pointer"
        >
          <X size={16} aria-hidden="true" /> Esc
        </button>
      </header>

      {/* `relative` để bảng chi tiết của mục tiêu phủ bên phải nằm trong khung trình chiếu. */}
      <div className="relative flex-1 min-h-0 flex flex-col p-6">{children}</div>
    </div>,
    document.body,
  )
}

/** Nút mở trình chiếu — nhỏ, đặt trong tiêu đề ô cạnh menu. */
export function PresentationButton({ onClick, className }: { onClick: () => void; className?: string }) {
  const { t } = useTranslation('analytics')
  return (
    <button
      type="button"
      onClick={onClick}
      title={t('presentation.open')}
      aria-label={t('presentation.open')}
      className={cn('p-1.5 rounded-lg text-slate-400 hover:bg-[var(--color-muted)] cursor-pointer', className)}
    >
      <Maximize2 size={16} aria-hidden="true" />
    </button>
  )
}

/**
 * Ô sơ đồ có nút trình chiếu: thẻ bình thường trên lưới + bản phủ toàn màn hình khi bật.
 *
 * <p>Trạng thái "đang trình chiếu" nằm ở ĐÂY chứ không ở tab, vì `renderWidget` của tab là một
 * `useCallback` mà lưới cache theo định danh hàm — thêm state vào đó là mọi biểu đồ trên trang vẽ
 * lại mỗi lần ai đó bật/tắt trình chiếu một ô.
 *
 * <p>Nội dung nhận `presenting` để tự nới rộng (ví dụ xương cá vẽ nhiều xương hơn trên màn lớn).
 * Bản trong lưới vẫn được dựng khi đang trình chiếu — nó nằm sau lớp phủ, và giữ nguyên để lúc
 * thoát không phải dựng lại từ đầu.
 */
export function PresentableChart({ title, icon, subtitle, children }: {
  title: string
  icon: ReactNode
  subtitle?: ReactNode
  children: (ctx: { presenting: boolean }) => ReactNode
}) {
  const [presenting, setPresenting] = useState(false)
  return (
    <>
      <ChartWrapper
        title={title}
        icon={icon}
        extraHeaderContent={<PresentationButton onClick={() => setPresenting(true)} />}
      >
        <div className="relative flex-1 min-h-0 flex flex-col">{children({ presenting: false })}</div>
      </ChartWrapper>
      <PresentationShell
        open={presenting}
        title={title}
        subtitle={subtitle}
        onClose={() => setPresenting(false)}
      >
        {children({ presenting: true })}
      </PresentationShell>
    </>
  )
}
