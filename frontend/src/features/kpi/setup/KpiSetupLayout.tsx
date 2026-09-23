import { useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { LayoutGrid, Loader2, Workflow, X } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import WizardStepper from './WizardStepper'
import { useKpiSetupFlow } from './useKpiSetupFlow'
import { Button } from '@/components/ui/button'
import AiAssistantWidget from '@/features/analytics/components/AiAssistantWidget'

/**
 * Khung của trình thiết lập KPI — một trang toàn màn hình, không sidebar, không header ứng dụng.
 *
 * Đứng NGOÀI `AppLayout` là có chủ đích: nhờ vậy dải bàn giao tự động không render, không phải
 * thêm một phép loại trừ theo đường dẫn nào trong layout chính. `/force-password-change` là tiền
 * lệ sẵn có của kiểu trang này. Bong bóng K.AI thì gắn riêng ở đây (từ 21/09/2026): nút "Gợi ý AI"
 * của biểu mẫu tạo chỉ tiêu mở khung chat và tự gửi câu hỏi, nên trang này phải có K.AI như mọi
 * trang khác.
 */
export default function KpiSetupLayout() {
  const navigate = useNavigate()
  const { currentFlow, steps, currentIndex, blockReason, goTo, isLoading } = useKpiSetupFlow()
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-muted)]">
        <Loader2 className="animate-spin text-[var(--color-primary)]" size={28} />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-muted)]">
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">
              <Workflow size={20} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-[var(--color-foreground)]">
                {currentFlow?.label ?? 'Thiết lập KPI'}
              </p>
              <p className="truncate text-caption">
                {currentFlow && currentIndex >= 0
                  ? `Bước ${currentIndex + 1} / ${steps.length} — ${steps[currentIndex]?.label}`
                  : 'Chọn việc bạn muốn làm'}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Đổi luồng giữa chừng: việc đã làm đều đã lưu nên quay ra không mất gì. */}
            {currentFlow && (
              <Link
                to="/kpi-setup"
                title="Chọn luồng khác"
                className="flex items-center gap-2 rounded-card border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
              >
                <LayoutGrid size={14} />
                <span className="hidden sm:inline">Luồng khác</span>
              </Link>
            )}

            <Button variant="outline" type="button" onClick={() => setShowExitConfirm(true)} title="Thoát trình thiết lập">
              <X aria-hidden="true" />
              <span className="hidden sm:inline">Thoát</span>
            </Button>
          </div>
        </div>

        {/* Chỉ có thanh bước khi đang ở trong một luồng — màn chọn luồng thì chưa có bước nào. */}
        {currentFlow && currentIndex >= 0 && (
          <div className="mx-auto max-w-5xl px-4 pb-4 md:px-8">
            <WizardStepper
              steps={steps}
              currentIndex={currentIndex}
              blockReason={blockReason}
              onJump={goTo}
            />
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-8">
        <Outlet />
      </main>

      <ConfirmDialog
        open={showExitConfirm}
        title="Thoát trình thiết lập?"
        description="Những gì bạn đã tạo vẫn được giữ lại — kỳ và đợt đã lưu, các chỉ tiêu nằm ở trạng thái NHÁP trong trang Quản lý chỉ tiêu. Bạn quay lại làm tiếp bất cứ lúc nào."
        confirmLabel="Thoát"
        onConfirm={() => navigate('/dashboard')}
        onClose={() => setShowExitConfirm(false)}
      />
      {/* Widget tự portal ra body và tự ẩn khi tổ chức tắt AI. */}
      <AiAssistantWidget />
    </div>
  )
}
