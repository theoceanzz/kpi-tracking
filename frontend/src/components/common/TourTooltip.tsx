import { useContext } from 'react'
import { createPortal } from 'react-dom'
import type { TooltipRenderProps } from 'react-joyride'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { TOUR_NARROW_QUERY, TourControlsContext } from './tours/controls'
import { resolveTarget } from './tours/engine'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'


/**
 * Hộp hướng dẫn theo mẫu: tiêu đề + nút đóng, một–hai câu, rồi "Bước x / y" bên trái và
 * Quay lại / Tiếp theo bên phải.
 *
 * Chiều cao chặn theo khung nhìn và chỉ thân bài cuộn: floating-ui chỉ dịch được hộp chứ không
 * thu nhỏ nó, hộp cao hơn màn thì hai nút điều hướng rơi ra ngoài và người dùng kẹt ở bước đó.
 */
export function TourTooltip({ step, tooltipProps }: TooltipRenderProps) {
  const { t } = useTranslation('shared')
  const controls = useContext(TourControlsContext)
  const narrow = useMediaQuery(TOUR_NARROW_QUERY)
  if (!controls) return null
  const { index, total, busy, next, prev, close, nextTourTitle } = controls
  const isLast = index >= total - 1
  const continueTo = isLast && nextTourTitle ? t('TourHost.nextTour', { title: nextTourTitle }) : null

  // Màn hẹp: ghim ở mép KHÔNG che neo — neo nằm nửa dưới màn hình thì ghim lên trên.
  let pinTop = false
  if (narrow && step.placement !== 'center') {
    const rect = resolveTarget(step.target)?.getBoundingClientRect()
    pinTop = !!rect && rect.top + rect.height / 2 > window.innerHeight / 2
  }

  const card = (
    <div
      {...tooltipProps}
      className={cn(
        'flex flex-col rounded-card border border-[var(--color-border-strong)] bg-[var(--color-card)] text-[var(--color-foreground)] shadow-2xl animate-in fade-in zoom-in-95 duration-200',
        narrow
          ? cn('fixed inset-x-4 z-[1401] max-h-[45vh]', pinTop ? 'top-4' : 'bottom-4')
          : 'w-[min(360px,calc(100vw-2rem))] max-h-[min(70vh,28rem)]',
      )}
    >
      <div className="shrink-0 flex items-start justify-between gap-3 px-5 pt-4">
        {step.title && <h3 className="text-base font-semibold leading-snug tracking-tight">{step.title}</h3>}
        <button
          type="button"
          onClick={close}
          aria-label={t('TourHost.close')}
          title={t('TourHost.closeHint')}
          className="-mr-1.5 -mt-0.5 shrink-0 rounded-control p-1 text-[var(--color-subtle-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {/* `overscroll-contain`: cuộn hết thân bài thì dừng, không đẩy trang phía sau làm neo trôi. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-2 pb-4 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
        {step.content}
      </div>

      <div className="shrink-0 space-y-2.5 border-t border-[var(--color-border)] px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="whitespace-nowrap text-[13px] font-semibold tabular-nums text-[var(--color-primary)]" aria-live="polite">
            {t('TourHost.stepOf', { current: index + 1, total })}
          </span>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button variant="outline" size="sm" onClick={prev} disabled={busy} title={t('TourHost.backHint')}>
                <ArrowLeft aria-hidden="true" /> {t('TourHost.back')}
              </Button>
            )}
            {!continueTo && (
              <Button size="sm" onClick={next} disabled={busy} title={isLast ? undefined : t('TourHost.nextHint')}>
                {isLast ? t('TourHost.finish') : <>{t('TourHost.next')} <ArrowRight aria-hidden="true" /></>}
              </Button>
            )}
          </div>
        </div>
        {/* Nút sang bài kế mang cả tên bài ("Tiếp: Tạo KPI (2/3): …") — quá dài để chen cạnh
            "Bước x / y", nên đứng riêng một hàng, rộng hết hộp, tên dài thì cắt bớt. */}
        {continueTo && (
          <Button size="sm" className="w-full" onClick={next} disabled={busy} title={continueTo}>
            <span className="min-w-0 truncate">{continueTo}</span> <ArrowRight aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  )

  // Hộp của Joyride nằm trong lớp có `transform`, mà `position: fixed` trong lớp đó bám theo lớp
  // chứ không bám khung nhìn — nên dải ghim phải ra thẳng <body>. Bước giữa màn hình vẫn để Joyride đặt.
  if (narrow && step.placement !== 'center') return createPortal(card, document.body)
  return card
}

/** Hỏi "Học tiếp từ bước x?" khi mở lại một bài đang học dở. */
export function TourResumePrompt({ title, current, total, onResume, onRestart, onClose }: {
  title: string
  current: number
  total: number
  onResume: () => void
  onRestart: () => void
  onClose: () => void
}) {
  const { t } = useTranslation('shared')
  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/30 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-resume-title"
        className="w-[min(380px,calc(100vw-2rem))] rounded-card border border-[var(--color-border-strong)] bg-[var(--color-card)] text-[var(--color-foreground)] shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <h3 id="tour-resume-title" className="text-base font-semibold leading-snug">{t('TourHost.resumeTitle')}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('TourHost.close')}
            className="-mr-1.5 -mt-0.5 shrink-0 rounded-control p-1 text-[var(--color-subtle-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <p className="px-5 pt-2 pb-4 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          {t('TourHost.resumeBody', { title, current, total })}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
          <Button variant="outline" size="sm" onClick={onRestart}>{t('TourHost.resumeRestart')}</Button>
          <Button size="sm" onClick={onResume} autoFocus>{t('TourHost.resumeContinue', { current })}</Button>
        </div>
      </div>
    </div>
  )
}
