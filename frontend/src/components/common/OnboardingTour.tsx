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
      className="max-w-[480px] bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl shadow-indigo-500/20 border border-slate-100 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-300 relative"
    >
      {/* Decorative Top Accent */}
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
      
      <div className="p-8 space-y-6">
        {/* Close button */}
        <div className="flex justify-end">
          <button {...closeProps} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3">
          {step.title && (
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              {step.title}
            </h3>
          )}
          <div className="text-[15px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            {step.content}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-4 border-t border-slate-50 dark:border-slate-800/50">
          <button
            {...primaryProps}
            className="flex items-center gap-3 px-8 py-3 rounded-2xl bg-indigo-600 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-95 group"
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
 * Per-page tutorials are now handled by PageTour components on each page.
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
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-3xl mb-2 animate-bounce">👋</div>
          <p>Chào mừng bạn đến với <strong>Hệ thống Quản trị KPI</strong>.</p>
          <p className="text-sm">Mỗi trang sẽ có hướng dẫn riêng khi bạn truy cập lần đầu. Bạn cũng có thể xem lại hướng dẫn bất kỳ lúc nào bằng cách nhấn nút <strong>💡</strong> trên thanh sidebar.</p>
        </div>
      ),
      placement: 'center',
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
        primaryColor: '#6366f1',
        textColor: '#1e293b',
        zIndex: 10000,
        backgroundColor: '#fff',
        arrowColor: '#fff',
        showProgress: false,
        spotlightRadius: 24,
        overlayColor: 'rgba(15, 23, 42, 0.7)',
      }}
    />
  )
}
