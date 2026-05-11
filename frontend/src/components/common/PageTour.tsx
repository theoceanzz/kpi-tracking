import { Joyride, Step, STATUS, EventData, TooltipRenderProps } from 'react-joyride'
import { useEffect, useState, useCallback } from 'react'
import { useTourStore, TourPageKey } from '@/store/tourStore'
import { useAuthStore } from '@/store/authStore'
import { X, ArrowRight, ArrowLeft } from 'lucide-react'

/* ========== PREMIUM CUSTOM TOOLTIP COMPONENT ========== */
function CustomTooltip({
  index,
  isLastStep,
  size,
  step,
  backProps,
  primaryProps,
  skipProps,
  closeProps,
  tooltipProps,
}: TooltipRenderProps) {
  return (
    <div
      {...tooltipProps}
      className="max-w-[400px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl shadow-indigo-500/20 border border-slate-100 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-300 relative"
    >
      {/* Decorative Top Accent */}
      <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
      
      <div className="p-5 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
             <div className="flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest w-fit">
              <span>Bước {index + 1}</span>
              <span className="opacity-30">/</span>
              <span className="opacity-60">{size}</span>
            </div>
          </div>
          <button {...closeProps} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-2">
          {step.title && (
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              {step.title}
            </h3>
          )}
          <div className="text-[13px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            {step.content}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 gap-4 border-t border-slate-100 dark:border-slate-800/50">
          <button
            {...skipProps}
            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors uppercase tracking-wider"
          >
            BỎ QUA
          </button>

          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                {...backProps}
                className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-95"
              >
                <ArrowLeft size={14} />
              </button>
            )}
            <button
              {...primaryProps}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-wider shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-95 group"
            >
              <span>{isLastStep ? 'XONG' : 'TIẾP TỤC'}</span>
              {!isLastStep && <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 h-0.5 bg-indigo-100 dark:bg-slate-800 w-full overflow-hidden">
          <div 
            className="h-full bg-indigo-500 transition-all duration-500" 
            style={{ width: `${((index + 1) / size) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}

/* ========== PAGE TOUR COMPONENT ========== */
interface PageTourProps {
  /** Unique key identifying this page's tour */
  pageKey: TourPageKey
  /** Steps for this page's tour */
  steps: Step[]
  /** Delay before auto-starting tour on first visit (ms) */
  autoStartDelay?: number
}

export default function PageTour({ pageKey, steps, autoStartDelay = 300 }: PageTourProps) {
  const { user } = useAuthStore()
  const { activeTour, hasSeen, markSeen, stopTour } = useTourStore()
  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  // Auto-start tour on first visit
  useEffect(() => {
    if (user?.id && !hasSeen(pageKey, user.id) && activeTour === null) {
      const timer = setTimeout(() => {
        useTourStore.getState().startTour(pageKey)
      }, autoStartDelay)
      return () => clearTimeout(timer)
    }
  }, [pageKey, hasSeen, activeTour, autoStartDelay, user?.id])

  // Sync run state with activeTour
  useEffect(() => {
    if (activeTour === pageKey) {
      setStepIndex(0)
      const timer = setTimeout(() => setRun(true), 150)
      return () => clearTimeout(timer)
    } else {
      setRun(false)
    }
  }, [activeTour, pageKey])

  const handleJoyrideEvent = useCallback((data: EventData) => {
    const { status, action, index, type } = data

    if (type === 'step:after') {
      if (action === 'next') {
        setStepIndex(index + 1)
      } else if (action === 'prev') {
        setStepIndex(index - 1)
      }
    }

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status) || action === 'close') {
      setRun(false)
      if (user?.id) markSeen(pageKey, user.id)
      stopTour()
    }
  }, [pageKey, markSeen, stopTour, user?.id])

  if (steps.length === 0) return null

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      scrollToFirstStep
      onEvent={handleJoyrideEvent}
      tooltipComponent={CustomTooltip}
      floatingOptions={{
        middleware: [],
        hideArrow: true,
      }}
      options={{
        primaryColor: '#6366f1',
        textColor: '#1e293b',
        zIndex: 10000,
        backgroundColor: '#fff',
        arrowColor: '#fff',
        showProgress: false,
        buttons: ['back', 'primary', 'skip'],
        spotlightRadius: 16,
        overlayColor: 'rgba(15, 23, 42, 0.65)',
        scrollOffset: 120,
      }}
    />
  )
}
