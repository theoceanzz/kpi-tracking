import { Joyride, STATUS, type EventData, type Step, type TooltipRenderProps } from 'react-joyride'
import { useEffect, useMemo, useState } from 'react'
import { X, ArrowRight, ArrowLeft } from 'lucide-react'
import { useTourStore, type TourKey } from '@/store/tourStore'
import { useAuthStore } from '@/store/authStore'
import { availableTourChain, getTour } from './tours'

/* ========== TOOLTIP ========== */
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
      /* Kích thước chốt bằng khung nhìn chứ không để nội dung tự đẩy ra: bước dài nhất
         (danh sách gạch đầu dòng + ô lưu ý) cao hơn màn 768px, mà floating-ui chỉ dịch
         được hộp chứ không thu nhỏ nó — hộp cao quá thì phần cuối, tức hai nút điều
         hướng, nằm ngoài màn hình và người dùng kẹt lại ở bước đó. Chặn trần rồi cho
         thân bài tự cuộn thì đầu và chân bài luôn thấy được. */
      className="flex flex-col w-[min(400px,calc(100vw-2rem))] max-h-[min(80vh,34rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl shadow-indigo-500/20 border border-slate-100 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-300"
    >
      <div className="h-1 w-full shrink-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

      <div className="shrink-0 px-5 pt-5 pb-3 space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest w-fit">
            <span>Bước {index + 1}</span>
            <span className="opacity-30">/</span>
            <span className="opacity-60">{size}</span>
          </div>
          <button
            {...closeProps}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
          >
            <X size={16} />
          </button>
        </div>

        {step.title && (
          <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            {step.title}
          </h3>
        )}
      </div>

      {/* Chỉ thân bài cuộn. `overscroll-contain` để cuộn hết bài thì dừng, không đẩy
          tiếp trang phía sau — trang cuộn là điểm neo trôi đi và vùng tô sáng lệch. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-3 text-[13px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
        {step.content}
      </div>

      <div className="shrink-0 flex items-center justify-between gap-4 px-5 py-3 border-t border-slate-100 dark:border-slate-800/50">
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

      <div className="shrink-0 h-0.5 bg-indigo-100 dark:bg-slate-800 w-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 transition-all duration-500"
          style={{ width: `${((index + 1) / size) * 100}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Một chỗ duy nhất chạy mọi hướng dẫn của app, đặt trong `AppLayout`.
 *
 * Trước đây mỗi trang tự gắn `<PageTour/>` của mình. Khi các màn hình gộp lại thành mục
 * trong trang thì hai `PageTour` cùng sống một lúc — của trang gộp và của mục đang mở —
 * và cái nào chạy trước thì chặn cái kia bằng chốt "đang có bài khác chạy". Kết quả là
 * vào mục lần đầu thường không được hướng dẫn gì. Một host duy nhất biết cả chuỗi nên
 * chạy được lần lượt từ ngoài vào trong.
 */
export default function TourHost() {
  const { user } = useAuthStore()
  const scope = useTourStore((s) => s.scope)
  const activeTour = useTourStore((s) => s.activeTour)
  const seenToursByUser = useTourStore((s) => s.seenToursByUser)
  const { markSeen, startTour, stopTour } = useTourStore()

  // `armed` là khoá đã được dựng xong DOM và sẵn sàng chạy. Tách khỏi `activeTour` để
  // Joyride chỉ bật sau khi màn hình kịp vẽ các phần tử mà bước đầu tiên trỏ tới.
  const [armed, setArmed] = useState<TourKey | null>(null)
  const [armedSteps, setArmedSteps] = useState<Step[]>([])
  const [stepIndex, setStepIndex] = useState(0)
  // Bài mà màn hình hiện tại không có neo nào để trỏ vào. Giữ trong bộ nhớ phiên chứ
  // KHÔNG đánh dấu đã-xem: quyền và cờ tính năng khác đi thì bài lại có chỗ để chạy.
  const [unanchored, setUnanchored] = useState<Set<TourKey>>(() => new Set())

  const chain = useMemo(() => availableTourChain(scope), [scope])

  // Đổi màn hình thì dừng bài đang chạy: các bước của nó neo vào phần tử của màn cũ.
  useEffect(() => {
    stopTour()
  }, [scope.navId, scope.sectionId, scope.tabKey, stopTour])

  // Tự chạy bài NGOÀI CÙNG chưa xem. Xem xong bài đó, effect chạy lại và bắt sang bài
  // trong hơn — nhờ vậy vào một mục lần đầu thì được dẫn cả trang lẫn mục, đúng thứ tự.
  useEffect(() => {
    if (!user?.id || !user.hasSeenOnboarding) return
    if (activeTour) return

    const seen = seenToursByUser[user.id] ?? {}
    const next = chain.find((key) => !seen[key] && !unanchored.has(key))
    if (!next) return

    const timer = setTimeout(() => startTour(next), 400)
    return () => clearTimeout(timer)
  }, [chain, activeTour, seenToursByUser, startTour, unanchored, user?.id, user?.hasSeenOnboarding])

  // Bài vừa được chọn (tự chạy hoặc bấm xem lại) — lọc bước rồi dựng lại từ bước đầu.
  useEffect(() => {
    if (!activeTour) return
    const timer = setTimeout(() => {
      const all = getTour(activeTour)?.steps ?? []
      // Bỏ những bước trỏ vào phần tử KHÔNG có trên màn hình lúc này. Chuyện này xảy ra
      // thường xuyên chứ không phải ngoại lệ: thẻ bị ẩn vì thiếu quyền, hàng tab biến mất
      // khi cụm chỉ còn một mục, mục bị tắt theo cờ tính năng. Không lọc thì Joyride
      // dừng ở một bước không có gì để tô sáng và người dùng kẹt lại đó.
      const anchored = all.filter(
        (step) =>
          typeof step.target !== 'string' ||
          step.target === 'body' ||
          !!document.querySelector(step.target)
      )

      if (anchored.length === 0) {
        setUnanchored((prev) => new Set(prev).add(activeTour))
        stopTour()
        return
      }

      setArmedSteps(anchored)
      setStepIndex(0)
      setArmed(activeTour)
    }, 150)
    return () => clearTimeout(timer)
  }, [activeTour, stopTour])

  const handleJoyrideEvent = (data: EventData) => {
    const { status, action, index, type } = data

    if (type === 'step:after') {
      if (action === 'next') setStepIndex(index + 1)
      else if (action === 'prev') setStepIndex(index - 1)
    }

    const bailedOut = status === STATUS.SKIPPED || action === 'close'
    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status) || action === 'close') {
      setArmed(null)
      if (activeTour && user?.id) {
        markSeen(activeTour, user.id)
        // "Bỏ qua" nghĩa là bỏ qua CẢ chuỗi. Chỉ đánh dấu bài đang chạy thì đóng bài của
        // mục xong là bài của tab bật lên ngay sau đó — đúng thứ người dùng vừa nói là
        // không muốn xem.
        if (bailedOut) {
          for (const key of chain) markSeen(key, user.id)
        }
      }
      stopTour()
    }
  }

  const run = !!activeTour && armed === activeTour
  if (armedSteps.length === 0) return null

  return (
    <Joyride
      steps={armedSteps}
      run={run}
      stepIndex={stepIndex}
      continuous
      options={{
        primaryColor: '#3b82f6',
        textColor: '#1e293b',
        zIndex: 40,
        backgroundColor: '#fff',
        arrowColor: '#fff',
        showProgress: false,
        spotlightRadius: 16,
        overlayColor: 'rgba(0, 0, 0, 0.3)',
        scrollOffset: 120,
      }}
      onEvent={handleJoyrideEvent}
      tooltipComponent={CustomTooltip}
      floatingOptions={{
        hideArrow: true,
        // `crossAxis` cho phép dịch hộp theo cả chiều vuông góc với hướng đặt. Mặc định
        // của floating-ui chỉ dịch theo chiều dọc trục canh lề, nên một bước đặt
        // `placement: 'top'` neo vào phần tử sát mép trên màn hình vẫn bị đẩy lên trên
        // khung nhìn: lật xuống dưới thì che mất chính phần tử đang tô sáng, mà lật lên
        // thì không còn chỗ. Cho dịch chéo thì hộp trượt vào trong màn hình.
        shiftOptions: { padding: 16, crossAxis: true },
        flipOptions: { padding: 16 },
      }}
    />
  )
}
