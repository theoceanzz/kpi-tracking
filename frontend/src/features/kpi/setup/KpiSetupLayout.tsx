import { useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { LayoutGrid, Loader2, Workflow, X } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import WizardStepper from './WizardStepper'
import { useKpiSetupFlow } from './useKpiSetupFlow'

/**
 * Khung của trình thiết lập KPI — một trang toàn màn hình, không sidebar, không header ứng dụng.
 *
 * Đứng NGOÀI `AppLayout` là có chủ đích: nhờ vậy dải bàn giao và bong bóng chat AI tự động không
 * render, không phải thêm một phép loại trừ theo đường dẫn nào trong layout chính.
 * `/force-password-change` là tiền lệ sẵn có của kiểu trang này.
 */
export default function KpiSetupLayout() {
  const navigate = useNavigate()
  const { currentFlow, steps, currentIndex, blockReason, goTo, isLoading } = useKpiSetupFlow()
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="animate-spin text-indigo-600" size={28} />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/85">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25">
              <Workflow size={20} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-tight text-slate-900 dark:text-white">
                {currentFlow?.label ?? 'Thiết lập KPI'}
              </p>
              <p className="truncate text-[11px] font-bold text-slate-400">
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
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <LayoutGrid size={14} />
                <span className="hidden sm:inline">Luồng khác</span>
              </Link>
            )}

            <button
              type="button"
              onClick={() => setShowExitConfirm(true)}
              title="Thoát trình thiết lập"
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <X size={14} />
              <span className="hidden sm:inline">Thoát</span>
            </button>
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
    </div>
  )
}
