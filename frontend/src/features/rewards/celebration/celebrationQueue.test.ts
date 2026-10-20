import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCelebrationQueue } from './celebrationQueue'
import type { CelebrationShow } from './celebrationPlan'

describe('createCelebrationQueue', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const setup = (opts: { blocked?: () => boolean; showMs?: number } = {}) => {
    const shown: CelebrationShow[] = []
    const queue = createCelebrationQueue({
      isBlocked: opts.blocked ?? (() => false),
      onShow: (show) => {
        shown.push(show)
        return new Promise<void>((resolve) => setTimeout(resolve, opts.showMs ?? 0))
      },
      debounceMs: 1500,
      maxWaitMs: 4000,
    })
    return { queue, shown }
  }

  it('lượt thưởng về liên tiếp được gộp sau nhịp chờ', () => {
    const { queue, shown } = setup()
    queue.push({ kind: 'POINTS', points: 10 })
    vi.advanceTimersByTime(1000)
    queue.push({ kind: 'POINTS', points: 20 })
    vi.advanceTimersByTime(1000)
    expect(shown).toHaveLength(0)
    vi.advanceTimersByTime(600)
    expect(shown).toHaveLength(1)
    expect(shown[0]!.totalPoints).toBe(30)
  })

  it('luồng thưởng liên tục không bị giữ quá trần chờ', () => {
    const { queue, shown } = setup()
    for (let i = 0; i < 6; i++) {
      queue.push({ kind: 'POINTS', points: 1 })
      vi.advanceTimersByTime(900)
    }
    // 4s trần: đã phải hiện dù sự kiện vẫn đang về.
    expect(shown.length).toBeGreaterThanOrEqual(1)
  })

  it('sự kiện người dùng tự bấm đi ngay, không chờ', () => {
    const { queue, shown } = setup()
    queue.push({ kind: 'CHECKIN', points: 5 }, { immediate: true })
    expect(shown).toHaveLength(1)
  })

  it('cổng chặn (tab ẩn / bài hướng dẫn) giữ lại tới khi resume', () => {
    let blocked = true
    const { queue, shown } = setup({ blocked: () => blocked })
    queue.push({ kind: 'GIFT', points: 100 }, { immediate: true })
    queue.push({ kind: 'POINTS', points: 50 })
    vi.advanceTimersByTime(5000)
    expect(shown).toHaveLength(0)

    blocked = false
    queue.resume()
    expect(shown.map((s) => s.kind)).toEqual(['GIFT'])
  })

  it('mỗi lần một hộp: hộp sau chờ hộp trước xong', async () => {
    const { queue, shown } = setup({ showMs: 2000 })
    queue.push({ kind: 'CHECKIN', points: 5 }, { immediate: true })
    queue.push({ kind: 'GIFT', points: 100 }, { immediate: true })
    expect(shown).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(2000)
    expect(shown).toHaveLength(2)
  })

  it('onShow ném lỗi không làm kẹt hàng', async () => {
    const shown: string[] = []
    const queue = createCelebrationQueue({
      isBlocked: () => false,
      onShow: (show) => {
        shown.push(show.kind)
        if (show.kind === 'CHECKIN') throw new Error('boom')
      },
    })
    queue.push({ kind: 'CHECKIN', points: 5 }, { immediate: true })
    queue.push({ kind: 'GIFT', points: 1 }, { immediate: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(shown).toEqual(['CHECKIN', 'GIFT'])
  })

  it('dispose bỏ mọi thứ đang chờ', () => {
    const { queue, shown } = setup()
    queue.push({ kind: 'POINTS', points: 10 })
    queue.dispose()
    vi.advanceTimersByTime(5000)
    expect(shown).toHaveLength(0)
  })
})
