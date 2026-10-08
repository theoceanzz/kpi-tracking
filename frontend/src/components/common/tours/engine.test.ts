import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { armSteps, isEditableTarget, meetsRequirement, pruneAbsentAhead, seekStep, toJoyrideStep, waitForTarget } from './engine'
import type { TourStep } from './registry'

const step = (target: string, extra: Partial<TourStep> = {}): TourStep => ({ target, content: target, ...extra })

describe('meetsRequirement', () => {
  it('không khai điều kiện thì luôn có', () => {
    expect(meetsRequirement(undefined, [])).toBe(true)
  })

  it('mã quyền: có MỘT trong các mã là đủ', () => {
    expect(meetsRequirement('KPI:CREATE', ['KPI:CREATE'])).toBe(true)
    expect(meetsRequirement(['KPI:CREATE', 'KPI:APPROVE'], ['KPI:APPROVE'])).toBe(true)
    expect(meetsRequirement(['KPI:CREATE'], ['KPI:VIEW'])).toBe(false)
  })

  it('hàm điều kiện ném lỗi thì coi như không đạt, không làm vỡ bài', () => {
    expect(meetsRequirement(() => { throw new Error('x') }, [])).toBe(false)
  })
})

describe('armSteps', () => {
  it('gắn khoá theo vị trí trong bài ĐẦY ĐỦ rồi mới lọc — cùng một bước cùng khoá ở mọi vai', () => {
    const steps = [step('#a'), step('#b', { requires: 'KPI:APPROVE' }), step('#c'), step('#d', { id: 'fixed' })]
    const staff = armSteps(steps, [])
    const head = armSteps(steps, ['KPI:APPROVE'])

    expect(staff.map((s) => s.id)).toEqual(['s0', 's2', 'fixed'])
    expect(head.map((s) => s.id)).toEqual(['s0', 's1', 's2', 'fixed'])
  })
})

describe('toJoyrideStep', () => {
  it('gỡ các trường riêng của app và mặc định chặn bấm vào vùng tô sáng', () => {
    const armed = armSteps([step('#a', { requires: () => true, prepare: () => undefined, waitTimeout: 10 })], [])[0]!
    const out = toJoyrideStep(armed) as Record<string, unknown>

    expect(out).not.toHaveProperty('requires')
    expect(out).not.toHaveProperty('prepare')
    expect(out).not.toHaveProperty('waitTimeout')
    expect(out.blockTargetInteraction).toBe(true)
    expect(out.targetWaitTimeout).toBe(0)
  })

  it('bước interactive / advanceOnClick cho bấm xuyên', () => {
    const [a, b] = armSteps([step('#a', { interactive: true }), step('#b', { advanceOnClick: true })], [])
    expect(toJoyrideStep(a!).blockTargetInteraction).toBe(false)
    expect(toJoyrideStep(b!).blockTargetInteraction).toBe(false)
  })
})

describe('seekStep', () => {
  const present = (missing: string[]) => async (s: string) => !missing.includes(s)

  it('tiến: gỡ bước thiếu neo khỏi danh sách để tổng số bước tính lại, không nhảy cóc', async () => {
    const r = await seekStep(['a', 'b', 'c', 'd'], 1, 1, present(['b']))
    expect(r.steps).toEqual(['a', 'c', 'd'])
    expect(r.index).toBe(1) // "Bước 2 / 3" chứ không phải "Bước 3 / 4"
  })

  it('lùi: gỡ bước thiếu neo phía trước rồi dừng ở bước có neo', async () => {
    const r = await seekStep(['a', 'b', 'c', 'd'], 2, -1, present(['c', 'b']))
    expect(r.steps).toEqual(['a', 'd'])
    expect(r.index).toBe(0)
  })

  it('hết bước theo hướng đó thì trả -1', async () => {
    const r = await seekStep(['a', 'b'], 1, 1, present(['b']))
    expect(r).toEqual({ steps: ['a'], index: -1 })
  })
})

describe('pruneAbsentAhead', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="here"></div>'
  })
  const s = (target: string, prepare?: () => void) => ({ target, prepare })

  it('gỡ bước phía sau không có prepare mà neo không có trên trang', () => {
    const steps = [s('#here'), s('#gone'), s('#gone2', () => {}), s('body'), s('#here')]
    expect(pruneAbsentAhead(steps, 0, false).map((x) => x.target)).toEqual(['#here', '#gone2', 'body', '#here'])
  })

  it('không đụng bước hiện tại và các bước trước nó', () => {
    const steps = [s('#gone'), s('#here')]
    expect(pruneAbsentAhead(steps, 0, false)).toHaveLength(2)
  })

  it('bước có cùng prepare với bước hiện tại cũng được xét ngay', () => {
    const open = () => {}
    const steps = [s('#here', open), s('#gone', open), s('#gone2', () => {})]
    expect(pruneAbsentAhead(steps, 0, false).map((x) => x.target)).toEqual(['#here', '#gone2'])
  })

  it('trang còn đang tải thì không gỡ gì', () => {
    const steps = [s('#here'), s('#gone')]
    expect(pruneAbsentAhead(steps, 0, true)).toHaveLength(2)
  })
})

describe('isEditableTarget', () => {
  it('ô nhập giữ phím mũi tên cho chính nó', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true)
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true)
    expect(isEditableTarget(document.createElement('button'))).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
  })
})

describe('waitForTarget', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  /** jsdom không dàn trang: phần tử có `data-shown` coi là đang được vẽ. */
  const fakeLayout = () =>
    vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
      return (this.hasAttribute('data-shown') ? [{}] : []) as unknown as DOMRectList
    })

  it('chờ tới khi phần tử xuất hiện', async () => {
    fakeLayout()
    const pending = waitForTarget('#late', 2000)
    setTimeout(() => {
      const el = document.createElement('div')
      el.id = 'late'
      el.setAttribute('data-shown', '')
      document.body.appendChild(el)
    }, 500)
    await vi.advanceTimersByTimeAsync(600)
    await expect(pending).resolves.toBe(true)
  })

  it('có trong DOM nhưng bị ẩn hẳn (hidden md:flex) thì thôi sớm, không chờ hết giờ', async () => {
    fakeLayout()
    const el = document.createElement('div')
    el.id = 'hidden'
    document.body.appendChild(el)
    let settled = false
    const pending = waitForTarget('#hidden', 5000).then((v) => { settled = true; return v })
    await vi.advanceTimersByTimeAsync(500)
    expect(settled).toBe(true)
    await expect(pending).resolves.toBe(false)
  })

  it('hết giờ mà trang còn đang tải dữ liệu thì chờ tiếp (tối đa 10s)', async () => {
    fakeLayout()
    let loading = true
    const pending = waitForTarget('#slow', 1000, undefined, () => loading)
    setTimeout(() => {
      const el = document.createElement('div')
      el.id = 'slow'
      el.setAttribute('data-shown', '')
      document.body.appendChild(el)
      loading = false
    }, 4000)
    await vi.advanceTimersByTimeAsync(4100)
    await expect(pending).resolves.toBe(true)
  })

  it('trang tải mãi cũng chỉ chờ tới trần 10s', async () => {
    fakeLayout()
    let settled = false
    const pending = waitForTarget('#never', 1000, undefined, () => true).then((v) => { settled = true; return v })
    await vi.advanceTimersByTimeAsync(9000)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1200)
    await expect(pending).resolves.toBe(false)
  })

  it('bị huỷ thì trả false', async () => {
    fakeLayout()
    const signal = { cancelled: false }
    const pending = waitForTarget('#never', 5000, signal)
    signal.cancelled = true
    await vi.advanceTimersByTimeAsync(100)
    await expect(pending).resolves.toBe(false)
  })
})
