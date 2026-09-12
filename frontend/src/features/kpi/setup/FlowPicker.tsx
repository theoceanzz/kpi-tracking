import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ClipboardCheck, ListChecks, Loader2, Rocket, Star, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotificationDots } from '@/hooks/useNotificationDots'
import { useKpiSetupFlow } from './useKpiSetupFlow'
import type { SetupFlowId } from './flows'

const FLOW_ICON: Record<SetupFlowId, React.ReactNode> = {
  SETUP: <Rocket size={22} />,
  ASSIGN: <Target size={22} />,
  APPROVE: <ClipboardCheck size={22} />,
  REPORT: <ListChecks size={22} />,
  EVALUATE: <Star size={22} />,
}

/**
 * Màn chọn luồng — cửa vào của trình thiết lập.
 *
 * Số thẻ hiện ra tự khớp với quyền: nhân viên thấy hai (giao chỉ tiêu, nộp báo cáo), quản lý cấp
 * trung thấy thêm duyệt và đánh giá, quản lý cấp cao thấy đủ cả thiết lập kỳ/đợt.
 *
 * Chỉ có đúng một luồng thì bỏ luôn màn này và đi thẳng vào — bắt người dùng chọn giữa một lựa
 * chọn là một cú nhấp vô nghĩa.
 */
export default function FlowPicker() {
  const { flows, buildUrl, isLoading } = useKpiSetupFlow()
  const { counts } = useNotificationDots()

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-[var(--color-primary)]" size={28} />
      </div>
    )
  }

  if (flows.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-[var(--color-border)] p-12 text-center">
        <CheckCircle2 className="mx-auto mb-3 text-[var(--color-subtle-foreground)]" size={28} />
        <p className="text-sm font-medium text-[var(--color-muted-foreground)]">Chưa có luồng nào dành cho bạn</p>
        <p className="mt-1 text-xs font-medium text-[var(--color-subtle-foreground)]">
          Tài khoản của bạn chưa có quyền tham gia bước nào trong quy trình KPI.
        </p>
      </div>
    )
  }

  const only = flows.length === 1 ? flows[0] : undefined
  if (only?.steps[0]) {
    return <Navigate to={buildUrl(only.id, only.steps[0].id)} replace />
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="space-y-1">
        <h2 className="text-page-title">
          Bạn muốn làm gì?
        </h2>
        <p className="text-sm font-medium text-[var(--color-muted-foreground)]">
          Mỗi luồng dẫn bạn đi trọn một mạch công việc. Chọn xong vẫn quay lại đây được bất cứ lúc nào.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {flows.map(flow => {
          const pending = flow.counter ? counts[flow.counter] : 0
          const firstStep = flow.steps[0]
          if (!firstStep) return null

          return (
            <li key={flow.id}>
              <Link
                to={buildUrl(flow.id, firstStep.id)}
                className={cn(
                  'group flex h-full flex-col gap-4 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-6 transition-all',
                  'hover:border-[var(--color-primary)]',
                  '',
                )}
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                    {FLOW_ICON[flow.id]}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-base font-semibold text-[var(--color-foreground)]">{flow.label}</span>
                      {/* Số việc đang chờ chính người này — trả lời ngay "có gì cần tôi không". */}
                      {pending > 0 && (
                        <span className="rounded-full bg-[var(--color-error-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--color-error)] dark:bg-[var(--color-error-bg)] dark:text-[var(--color-error)]">
                          {pending}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs font-medium leading-relaxed text-[var(--color-muted-foreground)]">
                      {flow.description}
                    </span>
                  </span>
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-x-1.5 gap-y-1 text-caption">
                  {flow.steps.map((step, index) => (
                    <span key={step.id} className="flex items-center gap-1.5">
                      {index > 0 && <span className="text-[var(--color-subtle-foreground)]">›</span>}
                      {step.label}
                    </span>
                  ))}
                  <ArrowRight
                    size={14}
                    className="ml-auto shrink-0 text-[var(--color-primary)] transition-transform group-hover:translate-x-1"
                  />
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
