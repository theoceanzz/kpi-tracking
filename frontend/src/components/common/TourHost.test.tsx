import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { TourDef } from './tours/registry'
import { useTourStore } from '@/store/tourStore'
import { useAuthStore } from '@/store/authStore'
import { useTourSandbox } from '@/hooks/useTourSandbox'
import type { UserInfo } from '@/types/auth'

// Chữ hiện ra = khoá + tham số, để assert "Bước x / y" mà không cần nạp i18n thật.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: object) => (o ? `${k}${JSON.stringify(o)}` : k) }),
}))

const tours: Record<string, TourDef> = {}
vi.mock('./tours', () => ({
  availableTourChain: (scope: { navId: string | null }) => (scope.navId && tours[scope.navId] ? [scope.navId] : []),
  getTour: (key: string) => tours[key],
  hasTour: (key: string) => !!tours[key],
  tourTitleOf: (key: string) => key,
  tourVersionOf: (def?: TourDef) => def?.version ?? 1,
}))

const { default: TourHost } = await import('./TourHost')

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const user = { id: 'u1', permissions: [], hasSeenOnboarding: true } as unknown as UserInfo

/** jsdom không dàn trang: phần tử có `data-shown` coi là đang được vẽ. */
function anchor(id: string) {
  const el = document.createElement('div')
  el.id = id
  el.setAttribute('data-shown', '')
  document.body.appendChild(el)
  return el
}

async function until(check: () => boolean, ms = 4000) {
  const started = Date.now()
  while (!check()) {
    if (Date.now() - started > ms) throw new Error(`Hết giờ chờ. Trang đang có: ${document.body.textContent}`)
    await act(() => new Promise((r) => setTimeout(r, 25)))
  }
}

const stepLabel = (current: number, total: number) => `TourHost.stepOf{"current":${current},"total":${total}}`
const showing = (current: number, total: number) => () => !!document.body.textContent?.includes(stepLabel(current, total))
const press = (key: string) => act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })) })

let root: Root
let container: HTMLElement

beforeEach(() => {
  document.body.innerHTML = ''
  for (const k of Object.keys(tours)) delete tours[k]
  vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
    return (this.hasAttribute('data-shown') || this === document.body ? [{}] : []) as unknown as DOMRectList
  })
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
  useAuthStore.setState({ user, isAuthenticated: true })
  useTourStore.setState({ seenToursByUser: {}, progressByUser: {}, activeTour: null, scope: { navId: null, sectionId: null, tabKey: null } })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
})

describe('TourHost', () => {
  it('lọc bước theo quyền ngay từ đầu, bỏ bước thiếu neo lúc chạy, phím ← → Esc, cleanup khi thoát', async () => {
    anchor('a')
    anchor('c')
    const prepareC = vi.fn()
    const cleanup = vi.fn()
    tours.page = {
      version: 2,
      cleanup,
      steps: [
        { target: '#a', title: 'A', content: 'a' },
        { target: '#locked', title: 'Khoá', content: 'x', requires: 'X:NOPE' },
        // Có `prepare` nên không bị "nhìn trước" gỡ sớm — chỉ lộ ra thiếu neo lúc chạy tới.
        { target: '#missing', title: 'Thiếu', content: 'm', waitTimeout: 100, prepare: () => {} },
        { target: '#c', title: 'C', content: 'c', prepare: prepareC },
      ],
    }

    act(() => root.render(<TourHost />))
    act(() => useTourStore.getState().setNavScope('page', null))

    // Bước khoá theo quyền bị lọc NGAY: 3 bước chứ không phải 4.
    await until(showing(1, 3))

    // → : bước #missing không có neo bị gỡ, tổng tính lại thành 2 — không nhảy cóc "3 / 4".
    await press('ArrowRight')
    await until(showing(2, 2))
    expect(prepareC).toHaveBeenCalled()
    expect(useTourStore.getState().progressByUser.u1?.page).toEqual({ stepId: 's3', version: 2 })

    await press('ArrowLeft')
    await until(showing(1, 2))

    await press('Escape')
    await until(() => useTourStore.getState().activeTour === null)
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(useTourStore.getState().seenToursByUser.u1?.page).toBe(2)
  })

  it('bài đang dở thì hỏi học tiếp và chạy tiếp đúng bước', async () => {
    anchor('a')
    anchor('b')
    const prepareB = vi.fn()
    tours.page = {
      steps: [
        { target: '#a', title: 'A', content: 'a' },
        { target: '#b', title: 'B', content: 'b', prepare: prepareB },
      ],
    }
    useTourStore.setState({
      seenToursByUser: { u1: { page: 1 } },
      progressByUser: { u1: { page: { stepId: 's1', version: 1 } } },
    })

    act(() => root.render(<TourHost />))
    act(() => useTourStore.getState().setNavScope('page', null))
    act(() => useTourStore.getState().startTour('page'))

    await until(() => !!document.body.textContent?.includes('TourHost.resumeTitle'))
    const resume = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('TourHost.resumeContinue'))!
    await act(async () => { resume.click() })

    await until(showing(2, 2))
    expect(prepareB).toHaveBeenCalled()
  })

  it('bài có `next`: bước cuối hiện "Tiếp: <tên>", bấm là chạy luôn bài kế', async () => {
    anchor('a')
    anchor('b')
    const cleanupA = vi.fn()
    tours.page = { next: 'page+2', cleanup: cleanupA, steps: [{ target: '#a', title: 'A', content: 'a' }] }
    tours['page+2'] = { steps: [{ target: '#b', title: 'B', content: 'b' }, { target: '#a', title: 'A2', content: 'a2' }] }

    act(() => root.render(<TourHost />))
    act(() => useTourStore.getState().setNavScope('page', null))
    await until(showing(1, 1))
    expect(document.body.textContent).toContain('TourHost.nextTour{"title":"page+2"}')

    await press('ArrowRight')
    await until(() => useTourStore.getState().activeTour === 'page+2' && showing(1, 2)())
    expect(cleanupA).toHaveBeenCalledTimes(1)
    expect(useTourStore.getState().seenToursByUser.u1?.page).toBe(1)
  })

  it('bài nối không có neo nào trên màn hình thì chạy luôn bài kế, không cắt luồng', async () => {
    anchor('a')
    anchor('c')
    tours.page = { next: 'page+2', steps: [{ target: '#a', title: 'A', content: 'a' }] }
    tours['page+2'] = { next: 'page+3', steps: [{ target: '#missing', title: 'M', content: 'm', waitTimeout: 50 }] }
    tours['page+3'] = { steps: [{ target: '#c', title: 'C', content: 'c' }] }

    act(() => root.render(<TourHost />))
    act(() => useTourStore.getState().setNavScope('page', null))
    await until(showing(1, 1))
    await press('ArrowRight')
    await until(() => useTourStore.getState().activeTour === 'page+3' && showing(1, 1)())
  })

  it('bài viết lại (bản mới) không tự chạy với người đã xem bản cũ', async () => {
    anchor('a')
    tours.page = { version: 2, steps: [{ target: '#a', title: 'A', content: 'a' }] }
    useTourStore.setState({ seenToursByUser: { u1: { page: true } } })

    act(() => root.render(<TourHost />))
    act(() => useTourStore.getState().setNavScope('page', null))
    await act(() => new Promise((r) => setTimeout(r, 800)))

    expect(useTourStore.getState().activeTour).toBeNull()
  })
})

describe('useTourSandbox', () => {
  it('chụp trạng thái lúc bài bắt đầu và trả lại khi bài kết thúc', () => {
    let value = 'gốc'
    const restored: string[] = []
    function Probe() {
      useTourSandbox(() => value, (saved) => { restored.push(saved) })
      return null
    }
    act(() => root.render(<Probe />))

    act(() => useTourStore.getState().startTour('page'))
    value = 'đổi trong lúc học'
    act(() => useTourStore.getState().stopTour())

    expect(restored).toEqual(['gốc'])
  })
})
