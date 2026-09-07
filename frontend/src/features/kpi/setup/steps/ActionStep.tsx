import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ExternalLink, Hourglass } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotificationDots } from '@/hooks/useNotificationDots'
import StepShell from '../StepShell'
import { useKpiSetupFlow } from '../useKpiSetupFlow'
import { WORKFLOW_PARAMS } from '../../workflow/hooks/useWorkflowNavigator'
import type { SetupStep } from '../flows'

/**
 * Bước dẫn sang một màn hình có sẵn, kèm số việc đang chờ.
 *
 * Vì sao dẫn đi chứ không nhúng: sáu màn hình đích đều là trang lớn 600–900 dòng, mỗi trang có bộ
 * lọc, phân trang và modal riêng. Nhúng chúng vào wizard đòi tách nhỏ từng cái — nhiều rủi ro cho
 * các màn đang chạy ổn, đổi lại rất ít lợi ích so với một cú nhấp.
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
        <button
          type="button"
          onClick={() => goNext()}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {isLast ? 'Xong, về màn chọn luồng' : 'Bước tiếp theo'}
          <ArrowRight size={14} />
        </button>
      }
    >
      <div className="flex flex-col items-center gap-6 py-4 text-center">
        <div
          className={cn(
            'flex h-20 w-20 items-center justify-center rounded-[28px]',
            isWait
              ? 'bg-amber-50 text-amber-500 dark:bg-amber-900/20'
              : pending && pending > 0
                ? 'bg-rose-50 text-rose-500 dark:bg-rose-900/20'
                : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20',
          )}
        >
          {isWait ? <Hourglass size={34} /> : pending && pending > 0 ? <ExternalLink size={34} /> : <CheckCircle2 size={34} />}
        </div>

        <div className="max-w-md space-y-2">
          {pending !== undefined && (
            <p className="text-3xl font-black tabular-nums text-slate-900 dark:text-white">
              {pending}
              <span className="ml-2 align-middle text-xs font-black uppercase tracking-widest text-slate-400">
                việc đang chờ
              </span>
            </p>
          )}

          <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
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
            className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-7 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-700 active:scale-95"
          >
            {step.ctaLabel ?? 'Mở màn hình'}
            <ExternalLink size={14} />
          </Link>
        )}
      </div>
    </StepShell>
  )
}
