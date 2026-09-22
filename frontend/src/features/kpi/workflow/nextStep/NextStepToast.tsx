import { ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { stageIcon } from '../workflowStageIcons'
import type { NextStepHint } from './nextStepHints'

interface Props {
  hint: NextStepHint
  /** Thời gian tự ẩn (ms) — vạch đếm ngược chạy cạn đúng bằng chừng này. */
  durationMs: number
  onGo: () => void
  onDismiss: () => void
}

/**
 * Hộp gợi ý bước tiếp theo, hiện ở góc dưới-phải rồi tự ẩn.
 *
 * Vạch đếm ngược ở đáy là để người dùng biết hộp sắp đi — và biết rằng rê chuột vào là nó dừng.
 * Sonner vốn dừng đồng hồ tự ẩn khi rê chuột vào toast; vạch dừng theo bằng CSS để hai thứ không
 * nói khác nhau.
 */
export default function NextStepToast({ hint, durationMs, onGo, onDismiss }: Props) {
  return (
    <div
      role="status"
      className="group relative w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none"
    >
      <style>{`
        @keyframes next-step-shrink { from { transform: scaleX(1) } to { transform: scaleX(0) } }
        .next-step-bar { transform-origin: left; animation: next-step-shrink ${durationMs}ms linear forwards; }
        .group:hover .next-step-bar { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .next-step-bar { animation: none; } }
      `}</style>

      <div className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          {stageIcon(hint.stage, 18)}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-eyebrow">Bước tiếp theo</p>
          <p className="mt-0.5 text-sm font-semibold leading-snug text-[var(--color-foreground)]">{hint.title}</p>
          {hint.description && (
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted-foreground)]">{hint.description}</p>
          )}

          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              Để sau
            </Button>
            <Button size="sm" onClick={onGo}>
              {hint.actionLabel}
              <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Đóng gợi ý"
          className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-[var(--color-subtle-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
        >
          <X size={15} />
        </button>
      </div>

      <div className="h-0.5 w-full bg-[var(--color-muted)]">
        <div className="next-step-bar h-full w-full bg-[var(--color-primary)]" />
      </div>
    </div>
  )
}
