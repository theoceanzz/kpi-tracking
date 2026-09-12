import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SetupStep } from './flows'

interface Props {
  steps: SetupStep[]
  currentIndex: number
  isReachable: (id: string) => boolean
  onJump: (id: string) => void
}

/**
 * Thanh bước kiểu trang thanh toán: vòng tròn đánh số nối bằng đường kẻ, bước đã qua thành dấu
 * tích, bước chưa tới thì mờ và không bấm được.
 *
 * Đánh số theo VỊ TRÍ trong danh sách đã lọc, không theo mã bước — tổ chức tắt "Quản lý kỳ" thì
 * "Đợt" thành bước 1 chứ không phải bước 2 bị hụt.
 */
export default function WizardStepper({ steps, currentIndex, isReachable, onJump }: Props) {
  return (
    <nav aria-label="Các bước thiết lập" className="w-full">
      {/* Đường tiến độ mảnh — mẫu duy nhất trong dự án, lấy từ PageTour để không lệch phong cách. */}
      <div className="mb-5 h-0.5 w-full overflow-hidden rounded-full bg-[var(--color-muted)]">
        <div
          className="h-full bg-[var(--color-primary)] transition-all duration-500"
          style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
        />
      </div>

      <ol className="flex items-start gap-1 sm:gap-2">
        {steps.map((step, index) => {
          const isDone = index < currentIndex
          const isCurrent = index === currentIndex
          const canJump = isReachable(step.id) && index !== currentIndex

          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-start gap-1 sm:gap-2">
              <button
                type="button"
                disabled={!canJump}
                onClick={() => canJump && onJump(step.id)}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'group flex min-w-0 flex-1 flex-col items-center gap-2 rounded-card px-1 py-2 text-center transition-colors sm:px-2',
                  canJump && 'hover:bg-[var(--color-muted)]',
                  !canJump && 'cursor-default',
                )}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all',
                    isCurrent && 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] ring-4 ring-[var(--color-ring)]',
                    isDone && 'bg-[var(--color-success-solid)] text-white',
                    !isCurrent && !isDone && 'bg-[var(--color-muted)] text-[var(--color-subtle-foreground)]',
                  )}
                >
                  {isDone ? <Check size={16} strokeWidth={3} /> : index + 1}
                </span>

                <span className="min-w-0">
                  <span
                    className={cn(
                      'text-eyebrow block truncate',
                      isCurrent ? 'text-[var(--color-primary)]' : isDone ? 'text-[var(--color-success)]' : 'text-[var(--color-subtle-foreground)]',
                    )}
                  >
                    {step.label}
                  </span>
                  {/* Gợi ý chỉ hiện ở bước đang đứng: bốn dòng mô tả cùng lúc là nhiễu, không phải hướng dẫn. */}
                  {isCurrent && (
                    <span className="mt-1 hidden text-xs font-medium leading-snug text-[var(--color-subtle-foreground)] sm:block">
                      {step.hint}
                    </span>
                  )}
                </span>
              </button>

              {index < steps.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    'mt-4 h-0.5 w-4 shrink-0 rounded-full sm:w-8',
                    index < currentIndex ? 'bg-[var(--color-success-solid)]' : 'bg-[var(--color-border)]',
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
