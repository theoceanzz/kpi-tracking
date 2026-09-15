import { useNavigate } from 'react-router-dom'
import { ArrowRight, Workflow } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotificationDots } from '@/hooks/useNotificationDots'
import { useKpiWorkflow } from '../hooks/useKpiWorkflow'
import { useWorkflowNavigator } from '../hooks/useWorkflowNavigator'
import { stageIcon } from '../workflowStageIcons'

/**
 * Lối vào luồng KPI từ trang chủ.
 *
 * Bấm một lần là vào bước đầu tiên với form tạo mở sẵn, rồi các bước sau tự nối tiếp — thay vì
 * phải tự mở sidebar và đoán xem chuỗi kỳ → đợt → chỉ tiêu bắt đầu từ đâu.
 *
 * Tự ẩn với người không có quyền ở bước đầu tiên, nên nhân viên không thấy một nút mà họ bấm vào
 * chỉ nhận lại trang 403.
 */
export default function WorkflowStartCard({ className }: { className?: string }) {
  const navigate = useNavigate()
  const { enabledStages, isLoading } = useKpiWorkflow()
  const { firstReachableStage } = useWorkflowNavigator()
  const { counts } = useNotificationDots()

  const first = firstReachableStage()
  if (isLoading || !first) return null

  const preview = enabledStages.slice(0, 3)
  // Tổng việc đang chờ chính người này, gộp từ mọi luồng — trả lời ngay "có gì cần tôi không"
  // mà không bắt họ mở từng màn hình ra dò.
  const waiting = counts.pendingKpis + counts.pendingSubmissions + counts.pendingAdjustments + counts.myPendingTasks

  return (
    <button
      // Dẫn vào trình thiết lập toàn màn hình chứ không vào trang quản lý: chỗ này là để BẮT ĐẦU,
      // mà trang quản lý là màn hình danh sách có bộ lọc và phân trang — không phải nơi để bắt đầu.
      onClick={() => navigate('/kpi-setup')}
      className={cn(
'group flex w-full items-center gap-4 rounded-card border border-[var(--color-border)] bg-[var(--color-primary-soft)] px-5 py-4 text-left transition-all',
        'hover:border-[var(--color-primary)]',
        '',
        className,
      )}
    >
      <div className="flex h-9 w-11 shrink-0 items-center justify-center rounded-card bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">
        <Workflow size={20} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-foreground)]">
          Bắt đầu thiết lập KPI
          {waiting > 0 && (
            <span className="rounded-full bg-[var(--color-error-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--color-error)] dark:bg-[var(--color-error-bg)] dark:text-[var(--color-error)]">
              {waiting} việc chờ bạn
            </span>
          )}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-caption">
          {preview.map((stage, index) => (
            <span key={stage.code} className="flex items-center gap-1.5">
              {index > 0 && <span className="text-[var(--color-subtle-foreground)]">›</span>}
              <span className="text-[var(--color-subtle-foreground)]">{stageIcon(stage.code, 12)}</span>
              {stage.label}
            </span>
          ))}
          {enabledStages.length > preview.length && (
            <span className="text-[var(--color-subtle-foreground)]">› …</span>
          )}
        </div>
      </div>

      <ArrowRight
        size={18}
        className="shrink-0 text-[var(--color-primary)] transition-transform group-hover:translate-x-1"
      />
    </button>
  )
}
