import { useLocation, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useKpiWorkflow } from '../hooks/useKpiWorkflow'
import { useWorkflowNavigator, WORKFLOW_PARAMS } from '../hooks/useWorkflowNavigator'
import type { WorkflowStageCode } from '../types'
import { Button } from '@/components/ui/button'

/**
 * Lối quay lại sau khi hệ thống tự nhảy sang bước kế tiếp.
 *
 * Nhảy thẳng làm luồng nhanh nhưng bẫy đúng một nhóm người: ai muốn tạo nhiều đợt liền tay sẽ bị
 * ném sang bước giao chỉ tiêu ngay sau đợt đầu tiên. Dải này cho họ đường về bằng một cú nhấp, và
 * tự biến mất khi họ bấm Ẩn — nên người đi xuôi luồng không phải nhìn thấy nó lần thứ hai.
 *
 * Chỉ hiện khi URL có `?from=<mã bước>`, tức là chỉ ngay sau một lần nhảy tự động.
 */
export default function WorkflowHandoffBar({ className }: { className?: string }) {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { byCode, stageForPath } = useKpiWorkflow()
  const { goToStage } = useWorkflowNavigator()

  const fromCode = searchParams.get(WORKFLOW_PARAMS.from) as WorkflowStageCode | null
  if (!fromCode) return null

  const fromStage = byCode.get(fromCode)
  const currentStage = stageForPath(location.pathname)
  if (!fromStage) return null

  const dismiss = () => {
    setSearchParams(
      (prev) => {
        prev.delete(WORKFLOW_PARAMS.from)
        return prev
      },
      { replace: true },
    )
  }

  const goBack = () => {
    // Mang theo bối cảnh hiện có để quay về đúng chỗ vừa rời, không phải một trang trắng.
    goToStage(
      fromCode,
      {
        periodId: searchParams.get(WORKFLOW_PARAMS.period),
        cycleId: searchParams.get(WORKFLOW_PARAMS.cycle),
      },
      { openCreate: true },
    )
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-[var(--color-success-border)] bg-[var(--color-success-bg)] px-4 py-2.5',
        'dark:border-[var(--color-success-border)] dark:bg-[var(--color-success-bg)]',
        className,
      )}
    >
      <CheckCircle2 size={16} className="shrink-0 text-[var(--color-success)]" />

      <p className="min-w-0 flex-1 text-xs font-medium text-[var(--color-success)]">
        Đã xong bước <span className="font-semibold">{fromStage.label}</span>
        {currentStage && (
          <>
            {' '}— bạn đang ở <span className="font-semibold">{currentStage.label}</span>
          </>
        )}
      </p>

      <Button variant="ghost" size="sm" className="shrink-0" type="button" onClick={goBack}>
        <ArrowLeft aria-hidden="true" />
        Quay lại {fromStage.label.toLowerCase()}
      </Button>

      <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label="Ẩn thông báo này" type="button" onClick={dismiss} title="Ẩn thông báo này">
        <X aria-hidden="true" />
      </Button>
    </div>
  )
}
