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
      <div className="mb-5 h-0.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full bg-indigo-500 transition-all duration-500"
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
                  'group flex min-w-0 flex-1 flex-col items-center gap-2 rounded-2xl px-1 py-2 text-center transition-colors sm:px-2',
                  canJump && 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                  !canJump && 'cursor-default',
                )}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black transition-all',
                    isCurrent && 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 ring-4 ring-indigo-500/15',
                    isDone && 'bg-emerald-500 text-white',
                    !isCurrent && !isDone && 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
                  )}
                >
                  {isDone ? <Check size={16} strokeWidth={3} /> : index + 1}
                </span>

                <span className="min-w-0">
                  <span
                    className={cn(
                      'block truncate text-[11px] font-black uppercase tracking-widest',
                      isCurrent ? 'text-indigo-600 dark:text-indigo-400' : isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400',
                    )}
                  >
                    {step.label}
                  </span>
                  {/* Gợi ý chỉ hiện ở bước đang đứng: bốn dòng mô tả cùng lúc là nhiễu, không phải hướng dẫn. */}
                  {isCurrent && (
                    <span className="mt-1 hidden text-[11px] font-medium leading-snug text-slate-400 sm:block">
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
                    index < currentIndex ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700',
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
