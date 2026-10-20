import { describe, expect, it, vi } from 'vitest'
import { createCelebrationSync, toCelebrationEvent, type CelebrationSyncDeps } from './celebrationSync'
import { RedemptionStatus, type RewardCelebration, type RewardGrant } from '../types'

const item = (refId: string, over: Partial<RewardCelebration> = {}): RewardCelebration => ({
  source: 'GRANT',
  refId,
  points: 10,
  certificate: false,
  ...over,
})

/** Mutex giống Web Locks: lượt sau chờ lượt trước chạy XONG (kể cả ack) mới bắt đầu. */
function sharedLock() {
  let tail = Promise.resolve()
  return (run: () => Promise<void>) => {
    const next = tail.then(run)
    tail = next.catch(() => {})
    return next
  }
}

/** Máy chủ giả: GET trả lượt chưa ack, ack đánh dấu (idempotent). */
function fakeServer(ids: string[]) {
  const acked = new Set<string>()
  return {
    acked,
    fetchMine: vi.fn(async () => {
      await Promise.resolve()
      return ids.filter((id) => !acked.has(id)).map((id) => item(id))
    }),
    ack: vi.fn(async (refIds: string[]) => {
      await Promise.resolve()
      refIds.forEach((id) => acked.add(id))
    }),
  }
}

const deps = (over: Partial<CelebrationSyncDeps> = {}): CelebrationSyncDeps => ({
  fetchMine: async () => [],
  ack: async () => {},
  celebrate: () => 'large',
  toEvent: (c) => ({ kind: 'POINTS', points: c.points, refId: c.refId }),
  isEnabled: () => true,
  isVisible: () => true,
  withLock: (run) => run(),
  ...over,
})

describe('createCelebrationSync', () => {
  it('ack hoàn tất BÊN TRONG lock, trước khi nhả lock', async () => {
    const log: string[] = []
    const sync = createCelebrationSync(deps({
      withLock: async (run) => {
        log.push('lock')
        await run()
        log.push('unlock')
      },
      fetchMine: async () => {
        log.push('get')
        return [item('a')]
      },
      celebrate: () => {
        log.push('celebrate')
        return 'large'
      },
      ack: async () => {
        await Promise.resolve()
        log.push('ack')
      },
    }))
    await sync.sync()
    expect(log).toEqual(['lock', 'get', 'celebrate', 'ack', 'unlock'])
  })

  it('hai tab đồng bộ cùng lúc: mỗi lượt chỉ được ăn mừng một lần', async () => {
    const server = fakeServer(['a', 'b'])
    const lock = sharedLock()
    const celebratedA = vi.fn(() => 'large' as const)
    const celebratedB = vi.fn(() => 'large' as const)
    const tabA = createCelebrationSync(deps({ ...server, withLock: lock, celebrate: celebratedA }))
    const tabB = createCelebrationSync(deps({ ...server, withLock: lock, celebrate: celebratedB }))

    await Promise.all([tabA.sync(), tabB.sync()])

    expect(celebratedA.mock.calls.length + celebratedB.mock.calls.length).toBe(2)
    expect(server.acked).toEqual(new Set(['a', 'b']))
  })

  it('tab đang ẩn không lấy; hiện lại sau tín hiệu thì lấy', async () => {
    let visible = false
    const fetchMine = vi.fn(async () => [])
    const sync = createCelebrationSync(deps({ fetchMine, isVisible: () => visible }))

    await sync.sync()
    expect(fetchMine).not.toHaveBeenCalled()

    visible = true
    sync.onVisible()
    await vi.waitFor(() => expect(fetchMine).toHaveBeenCalledTimes(1))
  })

  it('hiện lại khi KHÔNG có tín hiệu nào lúc ẩn thì không gọi thừa', () => {
    const fetchMine = vi.fn(async () => [])
    const sync = createCelebrationSync(deps({ fetchMine }))
    sync.onVisible()
    expect(fetchMine).not.toHaveBeenCalled()
  })

  it('tắt hiệu ứng ở máy này thì không lấy, không ack (để máy khác còn ăn mừng)', async () => {
    const fetchMine = vi.fn(async () => [item('a')])
    const ack = vi.fn(async () => {})
    await createCelebrationSync(deps({ fetchMine, ack, isEnabled: () => false })).sync()
    expect(fetchMine).not.toHaveBeenCalled()
    expect(ack).not.toHaveBeenCalled()
  })

  it('chỉ ack lượt thật sự đã vào hàng hiệu ứng', async () => {
    const ack = vi.fn(async () => {})
    await createCelebrationSync(deps({
      fetchMine: async () => [item('a'), item('b')],
      celebrate: (e) => (e.refId === 'a' ? 'large' : null),
      ack,
    })).sync()
    expect(ack).toHaveBeenCalledWith(['a'])
  })

  it('không có gì để ăn mừng thì không gọi ack', async () => {
    const ack = vi.fn(async () => {})
    await createCelebrationSync(deps({ ack })).sync()
    expect(ack).not.toHaveBeenCalled()
  })

  it('tín hiệu dồn dập trong lúc đang chạy gộp thành đúng một lượt chạy thêm', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const fetchMine = vi.fn(async () => {
      await gate
      return []
    })
    const sync = createCelebrationSync(deps({ fetchMine }))
    void sync.sync()
    void sync.sync()
    void sync.sync()
    release()
    await vi.waitFor(() => expect(fetchMine).toHaveBeenCalledTimes(2))
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchMine).toHaveBeenCalledTimes(2)
  })

  it('lỗi mạng: không ném, không ack', async () => {
    const ack = vi.fn(async () => {})
    await expect(createCelebrationSync(deps({
      fetchMine: async () => { throw new Error('offline') },
      ack,
    })).sync()).resolves.toBeUndefined()
    expect(ack).not.toHaveBeenCalled()
  })
})

describe('toCelebrationEvent', () => {
  const t = (key: string, o?: Record<string, unknown>) => `${key}:${JSON.stringify(o ?? {})}`

  it('thưởng tay kèm giấy khen mang theo đề nghị để vẽ giấy khen', () => {
    const grant = { id: 'g' } as RewardGrant
    const e = toCelebrationEvent(item('g', { certificate: true, grant, grantorName: 'A', reason: 'R' }), t)
    expect(e).toMatchObject({ kind: 'POINTS', certificate: grant, grantorName: 'A', reason: 'R', refId: 'g' })
  })

  it('thưởng tay không giấy khen thì không có certificate', () => {
    expect(toCelebrationEvent(item('g', { certificate: false, grant: { id: 'g' } as RewardGrant }), t).certificate).toBeNull()
  })

  it('chương trình tự động: tên chương trình đứng chỗ người thưởng, lý do là hạng', () => {
    const e = toCelebrationEvent(item('r', { source: 'PROGRAM_RUN', programName: 'Top KPI', rank: 2 }), t)
    expect(e).toMatchObject({ kind: 'POINTS', grantorName: 'Top KPI', reason: 'Celebration.programRank:{"rank":2}' })
  })

  it('đổi quà được giao / được duyệt là cấp quà với câu tương ứng', () => {
    const delivered = toCelebrationEvent(item('x', { source: 'REDEMPTION', giftName: 'Bình', redemptionStatus: RedemptionStatus.DELIVERED }), t)
    const approved = toCelebrationEvent(item('y', { source: 'REDEMPTION', giftName: 'Bình', redemptionStatus: RedemptionStatus.APPROVED }), t)
    expect(delivered.kind).toBe('GIFT')
    expect(delivered.title).toContain('Celebration.giftDelivered')
    expect(approved.title).toContain('Celebration.giftApproved')
  })
})
