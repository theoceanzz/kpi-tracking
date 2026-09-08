import { useLocation, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useKpiWorkflow } from '../hooks/useKpiWorkflow'
import { useWorkflowNavigator, WORKFLOW_PARAMS } from '../hooks/useWorkflowNavigator'
import type { WorkflowStageCode } from '../types'

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
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5',
        'dark:border-emerald-900/50 dark:bg-emerald-900/20',
        className,
      )}
    >
      <CheckCircle2 size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />

      <p className="min-w-0 flex-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
        Đã xong bước <span className="font-black">{fromStage.label}</span>
        {currentStage && (
          <>
            {' '}— bạn đang ở <span className="font-black">{currentStage.label}</span>
          </>
        )}
      </p>

      <button
        type="button"
        onClick={goBack}
        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800"
      >
        <ArrowLeft size={13} />
        Quay lại {fromStage.label.toLowerCase()}
      </button>

      <button
        type="button"
        onClick={dismiss}
        title="Ẩn thông báo này"
        className="shrink-0 rounded-lg p-1 text-emerald-600 transition-colors hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/40"
      >
        <X size={14} />
      </button>
    </div>
  )
}
