import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ExternalLink, Hourglass } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotificationDots } from '@/hooks/useNotificationDots'
import StepShell from '../StepShell'
import { useKpiSetupFlow } from '../useKpiSetupFlow'
import { WORKFLOW_PARAMS } from '../../workflow/hooks/useWorkflowNavigator'
import type { SetupStep } from '../flows'
import { Button } from '@/components/ui/button'

/**
 * Bước dẫn sang một màn hình có sẵn, kèm số việc đang chờ.
 *
 * Vì sao dẫn đi chứ không nhúng: các màn hình đích còn lại đều là trang lớn 600–900 dòng, mỗi
 * trang có bộ lọc, phân trang và modal riêng. Nhúng chúng vào wizard đòi tách nhỏ từng cái —
 * nhiều rủi ro cho các màn đang chạy ổn, đổi lại rất ít lợi ích so với một cú nhấp.
 *
 * Hai ngoại lệ đã được nhúng hẳn thành bước dựng sẵn (`SubmitStep`, `SelfEvalStep`): ở đó việc
 * phải làm chỉ là điền vài con số, mà cái giá của việc dẫn đi lại là rời trang một lần cho MỖI
 * chỉ tiêu. Khi việc nhỏ hơn thao tác đi lại thì phép đánh đổi trên đảo chiều.
 *
 * Biến thể `wait` dùng cho bước phải chờ NGƯỜI KHÁC (chờ cấp trên duyệt). Nó nói thẳng rằng không
 * có gì để làm ở đây, thay vì bày ra một nút giả vờ có việc.
 */
export default function ActionStep({ step }: { step: SetupStep }) {
  const { goNext, goBack, isLast, periodId } = useKpiSetupFlow()
  const { counts } = useNotificationDots()

  const pending = step.counter ? counts[step.counter] : undefined
  const isWait = step.kind === 'wait'

  // Mang bối cảnh đợt sang màn hình đích, theo đúng quy ước deep-link sẵn có của dự án.
  const target = (() => {
    if (!step.route) return '#'
    if (!periodId) return step.route
    const [path, query] = step.route.split('?')
    const params = new URLSearchParams(query)
    params.set(WORKFLOW_PARAMS.period, periodId)
    return `${path}?${params.toString()}`
  })()

  return (
    <StepShell
      title={step.label}
      description={step.hint}
      onBack={goBack}
      footer={
        <Button variant="outline" type="button" onClick={() => goNext()}>
          {isLast ? 'Xong, về màn chọn luồng' : 'Bước tiếp theo'}
          <ArrowRight aria-hidden="true" />
        </Button>
      }
    >
      <div className="flex flex-col items-center gap-6 py-4 text-center">
        <div
          className={cn(
            'flex h-20 w-20 items-center justify-center rounded-card',
            isWait
              ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)]'
              : pending && pending > 0
                ? 'bg-[var(--color-error-bg)] text-[var(--color-error)] dark:bg-[var(--color-error-bg)]'
                : 'bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)]',
          )}
        >
          {isWait ? <Hourglass size={34} /> : pending && pending > 0 ? <ExternalLink size={34} /> : <CheckCircle2 size={34} />}
        </div>

        <div className="max-w-md space-y-2">
          {pending !== undefined && (
            <p className="text-3xl font-semibold tabular-nums text-[var(--color-foreground)]">
              {pending}
              <span className="ml-2 align-middle text-sm font-medium text-[var(--color-subtle-foreground)]">
                việc đang chờ
              </span>
            </p>
          )}

          <p className="text-sm font-medium leading-relaxed text-[var(--color-muted-foreground)]">
            {isWait
              ? 'Bước này do người khác thực hiện. Bạn không cần ngồi đợi ở đây — rời đi và quay lại khi có thông báo, chỉ tiêu sẽ tự chuyển sang trạng thái đã duyệt.'
              : pending === 0
                ? 'Không còn việc nào đang chờ bạn ở bước này.'
                : 'Mở màn hình bên dưới để xử lý. Xong rồi quay lại đây đi tiếp.'}
          </p>
        </div>

        {step.route && (
          <Link
            to={target}
            className="flex items-center gap-2 rounded-card bg-[var(--color-primary)] px-7 py-3.5 text-sm font-medium text-[var(--color-primary-foreground)] transition-all hover:bg-[var(--color-primary-hover)]"
          >
            {step.ctaLabel ?? 'Mở màn hình'}
            <ExternalLink size={14} />
          </Link>
        )}
      </div>
    </StepShell>
  )
}
