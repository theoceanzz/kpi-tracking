import { Joyride, Step, STATUS, EventData, TooltipRenderProps } from 'react-joyride'
import { useAuthStore } from '@/store/authStore'
import { useEffect, useState, useMemo } from 'react'
import { authApi } from '@/features/auth/api/authApi'
import { X, ArrowRight } from 'lucide-react'

/* ========== PREMIUM CUSTOM TOOLTIP COMPONENT ========== */
function WelcomeTooltip({
  step,
  primaryProps,
  closeProps,
  tooltipProps,
}: TooltipRenderProps) {
  return (
    <div
      {...tooltipProps}
      /* Chặn trần theo khung nhìn rồi cho phần thân cuộn: hộp chào mừng đặt ở giữa màn
         hình, mà floating-ui tính chỗ đặt bằng `(innerHeight - height) / 2` — hộp cao
         hơn màn thì tràn đều cả hai đầu và nút "Bắt đầu khám phá" nằm ngoài tầm bấm. */
      className="flex flex-col max-w-[min(480px,calc(100vw-2rem))] max-h-[min(85vh,40rem)] bg-[var(--color-card)] rounded-card shadow-2xl border border-[var(--color-border)] overflow-hidden animate-in fade-in zoom-in-95 duration-300 relative"
    >
      {/* Decorative Top Accent */}
      <div className="h-1.5 w-full shrink-0 bg-[var(--color-primary)]"/>

      <div className="min-h-0 flex flex-col p-8 gap-6">
        {/* Close button */}
        <div className="flex justify-end shrink-0">
          <button {...closeProps} className="text-[var(--color-subtle-foreground)] hover:text-[var(--color-muted-foreground)] transition-colors p-1 hover:bg-[var(--color-muted)] rounded-control">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-3">
          {step.title && (
            <h3 className="text-section-title text-[var(--color-foreground)] tracking-tight leading-tight">
              {step.title}
            </h3>
          )}
          <div className="text-[15px] text-[var(--color-muted-foreground)] font-medium leading-relaxed">
            {step.content}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-4 shrink-0 border-t border-[var(--color-border)]">
          <button
            {...primaryProps}
            className="flex items-center gap-3 px-8 py-3 rounded-card bg-[var(--color-primary)] text-[var(--color-primary-foreground)] text-xs font-semibold uppercase tracking-wider shadow-lg hover:bg-[var(--color-primary-hover)] transition-all group"
          >
            <span>Bắt đầu khám phá</span>
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Welcome onboarding — only shows a welcome message on FIRST login.
 * Hướng dẫn của từng màn hình do TourHost lo, chạy tập trung ở AppLayout.
 */
export default function OnboardingTour() {
  const { user } = useAuthStore()
  const [run, setRun] = useState(false)

  const steps: Step[] = useMemo(() => [
    {
      target: 'body',
      title: `Chào mừng ${user?.fullName}!`,
      content: (
        <div className="space-y-4">
          <div className="w-16 h-16 bg-[var(--color-primary-soft)] rounded-card flex items-center justify-center text-3xl mb-2 animate-bounce">👋</div>
          <p>Chào mừng bạn đến với <strong>Hệ thống Quản trị KPI</strong>.</p>
          <p className="text-sm">Mỗi trang sẽ có hướng dẫn riêng khi bạn truy cập lần đầu. Bạn cũng có thể xem lại hướng dẫn bất kỳ lúc nào bằng nút <strong>💡</strong> trên thanh tiêu đề.</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
  ], [user])

  useEffect(() => {
    if (user && !user.hasSeenOnboarding) {
      const timer = setTimeout(() => setRun(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [user])

  const handleJoyrideEvent = async (data: EventData) => {
    const { status, action } = data

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status) || action === 'close') {
      setRun(false)

      if (user?.hasSeenOnboarding) return

      try {
        await authApi.completeOnboarding()
        const updatedUser = { ...user, hasSeenOnboarding: true }
        useAuthStore.getState().setUser(updatedUser as any)
      } catch (error) {
        console.error('Failed to mark onboarding as complete:', error)
        const updatedUser = { ...user, hasSeenOnboarding: true }
        useAuthStore.getState().setUser(updatedUser as any)
      }
    }
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      onEvent={handleJoyrideEvent}
      tooltipComponent={WelcomeTooltip}
      floatingOptions={{
        hideArrow: true,
      }}
      options={{
        primaryColor: '#3b82f6',
        textColor: '#1e293b',
        zIndex: 200,
        backgroundColor: '#fff',
        arrowColor: '#fff',
        showProgress: false,
        spotlightRadius: 24,
        overlayColor: 'rgba(0, 0, 0, 0.3)',
      }}
    />
  )
}
