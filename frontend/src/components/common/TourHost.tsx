import { Joyride, EVENTS, type EventData } from 'react-joyride'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTourStore, tourSeenStatus, type TourKey } from '@/store/tourStore'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/store/authStore'
import { availableTourChain, getTour, hasTour, tourTitleOf, tourVersionOf } from './tours'
import {
  armSteps, isEditableTarget, isTargetVisible, pruneAbsentAhead, resolveTarget, seekStep, toJoyrideStep, waitForTarget, type ArmedStep,
} from './tours/engine'
import { TourResumePrompt, TourTooltip } from './TourTooltip'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { TOUR_NARROW_QUERY, TourControlsContext, type TourControls } from './tours/controls'

/** Trên Dialog/Drawer (1000), Select/Popover (1100) và nút K.AI nổi (1300): bài phải tô sáng được thứ nằm trong modal và không bị gì đè lên. */
const TOUR_Z_INDEX = 1400
const DEFAULT_WAIT_MS = 2500

type Probe = (step: ArmedStep) => Promise<boolean>

/**
 * Một chỗ duy nhất chạy mọi hướng dẫn của app, đặt trong `AppLayout`.
 *
 * Trước đây mỗi trang tự gắn `<PageTour/>` của mình. Khi các màn hình gộp lại thành mục
 * trong trang thì hai `PageTour` cùng sống một lúc — của trang gộp và của mục đang mở —
 * và cái nào chạy trước thì chặn cái kia bằng chốt "đang có bài khác chạy". Kết quả là
 * vào mục lần đầu thường không được hướng dẫn gì. Một host duy nhất biết cả chuỗi nên
 * chạy được lần lượt từ ngoài vào trong.
 *
 * Joyride chạy ở chế độ controlled và CHỈ để vẽ (vùng tô sáng + hộp). Chuyển bước do host làm:
 * chạy `prepare` của bước đích (mở panel, chuyển tab), chờ neo xuất hiện, bước nào không có neo
 * thì gỡ khỏi danh sách — nên "Bước x / y" luôn khớp với số bước thật sự còn lại.
 */
export default function TourHost() {
  const { user } = useAuthStore()
  const scope = useTourStore((s) => s.scope)
  const activeTour = useTourStore((s) => s.activeTour)
  const seenToursByUser = useTourStore((s) => s.seenToursByUser)
  const { markSeen, startTour, stopTour, saveProgress, clearProgress } = useTourStore()

  // `armed` là khoá đang hiện trên màn hình. Tách khỏi `activeTour` để Joyride chỉ bật sau khi
  // bước đầu tiên đã được chuẩn bị xong và neo của nó đã có.
  const [armed, setArmed] = useState<TourKey | null>(null)
  const [steps, setSteps] = useState<ArmedStep[]>([])
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [resume, setResume] = useState<{ key: TourKey; index: number } | null>(null)
  // Bài mà màn hình hiện tại không có neo nào để trỏ vào. Giữ trong bộ nhớ phiên chứ
  // KHÔNG đánh dấu đã-xem: quyền và cờ tính năng khác đi thì bài lại có chỗ để chạy.
  const [unanchored, setUnanchored] = useState<Set<TourKey>>(() => new Set())

  const chain = useMemo(() => availableTourChain(scope), [scope])
  const narrow = useMediaQuery(TOUR_NARROW_QUERY)

  /** Khoá của bài đã đụng vào màn hình (đã chạy `prepare`) — để biết phải `cleanup` bài nào. */
  const runningRef = useRef<TourKey | null>(null)
  /** Mỗi lượt chuyển bước một số; lượt cũ còn đang chờ neo thì bỏ kết quả. */
  const seqRef = useRef(0)
  const stepsRef = useRef(steps)
  const indexRef = useRef(index)
  const commit = (rawSteps: ArmedStep[], nextIndex: number) => {
    const nextSteps = pruneAbsentAhead(rawSteps, nextIndex, queryClient.isFetching() > 0)
    stepsRef.current = nextSteps
    indexRef.current = nextIndex
    setSteps(nextSteps)
    setIndex(nextIndex)
  }

  const markUnanchored = (key: TourKey) => setUnanchored((prev) => new Set(prev).add(key))

  const probeFor = (seq: number): Probe => {
    const signal = { get cancelled() { return seqRef.current !== seq } }
    // `prepare` đã chạy mà neo của bước vẫn không có (vd. hộp chọn KPI rỗng nên form không mở
    // được): các bước sau dùng CÙNG `prepare` thì màn hình cũng sẽ y như vậy — chỉ nhìn qua, không
    // chạy lại và chờ hết giờ từng bước (sáu bước × vài giây là người dùng tưởng bài bị treo).
    const failedPrepares = new Set<unknown>()
    // Cùng lý do cho bước tĩnh (không `prepare`): đã chờ hết giờ một bước mà neo không đến thì các
    // bước tĩnh sau trong lượt này chỉ nhìn qua. Thiếu cái này, trang còn đang tải dữ liệu thì MỖI
    // thẻ không có ở vai này lại chờ trọn 10 giây — bấm Tiếp theo mà đứng im cả chục giây.
    let staticMissed = false
    return async (step) => {
      if (signal.cancelled) return false
      if (step.prepare ? failedPrepares.has(step.prepare) : staticMissed) return isTargetVisible(step.target)
      await step.prepare?.()
      const ok = await waitForTarget(step.target, step.waitTimeout ?? DEFAULT_WAIT_MS, signal, () => queryClient.isFetching() > 0)
      if (!ok) {
        if (step.prepare) failedPrepares.add(step.prepare)
        else staticMissed = true
      }
      return ok
    }
  }

  /** Bắt đầu (hoặc học tiếp) bài `key` từ bước `from`. */
  const begin = async (key: TourKey, list: ArmedStep[], from: number) => {
    const seq = ++seqRef.current
    setResume(null)
    setBusy(true)
    const probe = probeFor(seq)
    let found = await seekStep(list, from, 1, probe)
    // Học tiếp mà từ bước đó trở đi không còn gì hiện được: học lại từ đầu thay vì im lặng.
    if (found.index === -1 && from > 0) found = await seekStep(found.steps, 0, 1, probe)
    if (seqRef.current !== seq) return
    setBusy(false)
    if (found.index === -1) {
      markUnanchored(key)
      stopTour()
      // Bài nối không có gì để chỉ trên màn hình này (vd. không có KPI nào còn điều chỉnh được):
      // đừng cắt đứt cả luồng — chạy luôn bài kế của nó.
      const next = getTour(key)?.next
      if (key.includes('+') && next && hasTour(next)) setTimeout(() => startTour(next), 30)
      return
    }
    commit(found.steps, found.index)
    setArmed(key)
  }

  /** Kết thúc bài đang chạy. Dọn màn hình (`cleanup`) nằm ở effect theo dõi `activeTour`. */
  const end = (reason: 'finished' | 'skipped') => {
    const key = runningRef.current
    if (!key || !user?.id) {
      stopTour()
      return
    }
    seqRef.current++
    markSeen(key, user.id, tourVersionOf(getTour(key)))
    if (reason === 'finished') clearProgress(key, user.id)
    // "Bỏ qua" nghĩa là bỏ qua CẢ chuỗi. Chỉ đánh dấu bài đang chạy thì đóng bài của mục xong là
    // bài của tab bật lên ngay sau đó — đúng thứ người dùng vừa nói là không muốn xem. Bước đang
    // dở thì vẫn giữ: mở lại từ nút Hướng dẫn sẽ được hỏi học tiếp.
    else for (const k of chain) markSeen(k, user.id, tourVersionOf(getTour(k)))
    stopTour()
  }

  /** Bài kế tiếp của luồng (nếu có và đang có bài viết). */
  const nextKey = armed ? getTour(armed)?.next : undefined
  const continuation = nextKey && hasTour(nextKey) ? nextKey : undefined

  /** Xong bài này; bài có `next` thì chạy luôn bài kế (sau khi bài này dọn màn hình xong). */
  const finish = () => {
    end('finished')
    if (continuation) setTimeout(() => startTour(continuation), 30)
  }

  const go = async (dir: 1 | -1) => {
    if (!armed || busy) return
    const from = indexRef.current + dir
    if (dir === 1 && from >= stepsRef.current.length) return finish()
    if (dir === -1 && from < 0) return

    const seq = ++seqRef.current
    setBusy(true)
    const current = stepsRef.current[indexRef.current]
    const found = await seekStep(stepsRef.current, from, dir, probeFor(seq))
    if (seqRef.current !== seq) return
    setBusy(false)

    if (found.index !== -1) return commit(found.steps, found.index)
    if (dir === 1) return finish()
    // Lùi mà phía trước không còn bước nào hiện được: đứng lại bước hiện tại, dựng lại màn hình
    // của nó (vừa chạy `prepare` của các bước trước).
    const at = current ? found.steps.indexOf(current) : -1
    commit(found.steps, Math.max(0, at))
    await current?.prepare?.()
  }

  /** Neo của bước đang hiện biến mất (Joyride báo): gỡ bước đó, đi tiếp. */
  const dropCurrent = async () => {
    const seq = ++seqRef.current
    const list = stepsRef.current.filter((_, i) => i !== indexRef.current)
    setBusy(true)
    const found = await seekStep(list, indexRef.current, 1, probeFor(seq))
    if (seqRef.current !== seq) return
    setBusy(false)
    if (found.index === -1) return end('finished')
    commit(found.steps, found.index)
  }

  const controls: TourControls = {
    index,
    total: steps.length,
    busy,
    nextTourTitle: continuation ? tourTitleOf(continuation) : undefined,
    next: () => void go(1),
    prev: () => void go(-1),
    close: () => end('skipped'),
  }
  // Listener bàn phím/chuột gắn một lần mỗi bước nhưng phải gọi bản hàm mới nhất.
  const latest = useRef(controls)
  useLayoutEffect(() => {
    latest.current = controls
  })

  // Đổi màn hình thì dừng bài đang chạy: các bước của nó neo vào phần tử của màn cũ.
  useEffect(() => {
    stopTour()
  }, [scope.navId, scope.sectionId, scope.tabKey, stopTour])

  // Bài rời khỏi `activeTour` vì BẤT KỲ lý do gì (xong, bỏ qua, chuyển màn hình, bấm xem lại bài
  // khác, đặt lại toàn bộ): một chỗ duy nhất trả màn hình về như trước bài.
  useEffect(() => {
    const prevKey = runningRef.current
    if (!prevKey || prevKey === activeTour) return
    runningRef.current = null
    seqRef.current++
    setArmed(null)
    setResume(null)
    setBusy(false)
    commit([], 0)
    void Promise.resolve(getTour(prevKey)?.cleanup?.()).catch((err) => console.warn('[tours] cleanup lỗi:', err))
  }, [activeTour])

  // Tự chạy bài NGOÀI CÙNG chưa xem bản nào. Xem xong bài đó, effect chạy lại và bắt sang bài
  // trong hơn. Bài đã xem bản cũ rồi được viết lại thì không tự chạy — nút Hướng dẫn hiện chấm.
  useEffect(() => {
    if (!user?.id || !user.hasSeenOnboarding) return
    if (activeTour) return

    const seen = seenToursByUser[user.id] ?? {}
    const next = chain.find(
      (key) => tourSeenStatus(seen[key], tourVersionOf(getTour(key))) === 'unseen' && !unanchored.has(key),
    )
    if (!next) return

    const timer = setTimeout(() => startTour(next), 400)
    return () => clearTimeout(timer)
  }, [chain, activeTour, seenToursByUser, startTour, unanchored, user?.id, user?.hasSeenOnboarding])

  // Bài vừa được chọn (tự chạy hoặc bấm xem lại): lọc bước theo quyền, hỏi học tiếp nếu đang dở.
  useEffect(() => {
    if (!activeTour || !user?.id) return
    const key = activeTour
    const userId = user.id
    const permissions = user.permissions ?? []
    const timer = setTimeout(() => {
      const def = getTour(key)
      const list = armSteps(def?.steps ?? [], permissions)
      if (list.length === 0) {
        markUnanchored(key)
        stopTour()
        return
      }
      runningRef.current = key
      const progress = useTourStore.getState().progressByUser[userId]?.[key]
      const at = progress && progress.version === tourVersionOf(def)
        ? list.findIndex((s) => s.id === progress.stepId)
        : -1
      if (at > 0) {
        commit(list, 0)
        setResume({ key, index: at })
      } else {
        void begin(key, list, 0)
      }
    }, 150)
    return () => clearTimeout(timer)
    // `begin`/`commit` đọc state qua ref; chỉ chạy lại khi đổi bài.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTour])

  // Lưu bước đang học để lần sau hỏi "Học tiếp từ bước x?".
  useEffect(() => {
    if (!armed || !user?.id) return
    const step = steps[index]
    if (!step) return
    if (index === 0) clearProgress(armed, user.id)
    else saveProgress(armed, user.id, { stepId: step.id, version: tourVersionOf(getTour(armed)) })
  }, [armed, index, steps, user?.id, saveProgress, clearProgress])

  // Phím tắt: ← → chuyển bước, Esc thoát. Trong ô nhập thì ← → thuộc về ô nhập — nhưng chỉ ở bước
  // cho bấm vào phần tử (`interactive` / `advanceOnClick`). Bước thường chặn bấm, nên con trỏ đang
  // nằm trong một ô là do hộp thoại tự focus ô đầu tiên lúc mở, không phải người dùng đang gõ;
  // nhường phím cho ô đó thì trong mọi bài đi qua form, bấm → không sang bước.
  const tourOpen = !!armed || !!resume
  const typingAllowedRef = useRef(false)
  useEffect(() => {
    if (!tourOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        latest.current.close()
        return
      }
      if (!armed || (typingAllowedRef.current && isEditableTarget(e.target))) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        latest.current.next()
      } else if (e.key === 'ArrowLeft' && latest.current.index > 0) {
        e.preventDefault()
        latest.current.prev()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [tourOpen, armed])

  // Bước "bấm vào đây để tiếp tục": người dùng tự bấm đúng phần tử thì sang bước kế. Đợi một nhịp
  // để chính nút đó chạy việc của nó trước (mở thư viện…), rồi bước kế mới chờ neo.
  const current = armed ? steps[index] : undefined
  typingAllowedRef.current = !!(current?.interactive || current?.advanceOnClick)

  // Bước chặn bấm mà con trỏ vẫn nằm trong một ô dưới lớp phủ (hộp thoại tự focus ô đầu): bỏ focus,
  // để phím người dùng bấm không gõ nhầm vào form đang được giới thiệu.
  useEffect(() => {
    if (!current || current.interactive || current.advanceOnClick) return
    const timer = setTimeout(() => {
      const el = document.activeElement
      if (el instanceof HTMLElement && isEditableTarget(el)) el.blur()
    }, 50)
    return () => clearTimeout(timer)
  }, [current])

  useEffect(() => {
    if (!current?.advanceOnClick) return
    const target = current.target
    const onClick = (e: MouseEvent) => {
      const el = resolveTarget(target)
      if (el && e.target instanceof Node && el.contains(e.target)) setTimeout(() => latest.current.next(), 0)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [current])

  // Cờ trên <body> cho CSS: hiện các nút vốn chỉ hiện khi rê chuột (xem `[data-tour-reveal]`).
  useEffect(() => {
    if (!armed) return
    document.body.dataset.tourActive = 'true'
    return () => {
      delete document.body.dataset.tourActive
    }
  }, [armed])

  const joyrideSteps = useMemo(() => steps.map(toJoyrideStep), [steps])

  const handleJoyrideEvent = (data: EventData) => {
    if (data.type === EVENTS.TARGET_NOT_FOUND && armed) void dropCurrent()
  }

  const run = !!activeTour && armed === activeTour

  return (
    <TourControlsContext.Provider value={controls}>
      {resume && activeTour === resume.key && (
        <TourResumePrompt
          title={tourTitleOf(resume.key)}
          current={resume.index + 1}
          total={steps.length}
          onResume={() => void begin(resume.key, stepsRef.current, resume.index)}
          onRestart={() => {
            if (user?.id) clearProgress(resume.key, user.id)
            void begin(resume.key, stepsRef.current, 0)
          }}
          onClose={() => end('skipped')}
        />
      )}
      {joyrideSteps.length > 0 && (
        <Joyride
          steps={joyrideSteps}
          run={run}
          stepIndex={index}
          continuous
          scrollToFirstStep
          options={{
            zIndex: TOUR_Z_INDEX,
            primaryColor: 'var(--color-primary)',
            backgroundColor: 'var(--color-card)',
            arrowColor: 'var(--color-card)',
            textColor: 'var(--color-foreground)',
            overlayColor: 'rgba(0, 0, 0, 0.55)',
            spotlightRadius: 10,
            spotlightPadding: 6,
            scrollOffset: 120,
            showProgress: false,
            // Esc, bấm nền tối và các nút đều do host xử lý — Joyride tự đóng bước là lệch bước.
            dismissKeyAction: false,
            overlayClickAction: false,
            buttons: [],
          }}
          styles={{
            spotlight: { style: { stroke: 'var(--color-primary)', strokeWidth: 2 } },
          }}
          onEvent={handleJoyrideEvent}
          tooltipComponent={TourTooltip}
          floatingOptions={{
            // Màn hẹp: hộp là dải ghim mép màn hình (xem `TourTooltip`), không còn chỉ vào neo.
            hideArrow: narrow,
            // `crossAxis` cho phép dịch hộp theo cả chiều vuông góc với hướng đặt: bước neo vào
            // phần tử sát mép màn hình thì hộp trượt vào trong thay vì tràn ra ngoài khung nhìn.
            shiftOptions: { padding: 12, crossAxis: true },
            flipOptions: { padding: 12 },
          }}
        />
      )}
    </TourControlsContext.Provider>
  )
}
