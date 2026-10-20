import { describe, expect, it } from 'vitest'
import { checkinBonusPoints, levelOf, planBatch, type CelebrationEvent } from './celebrationPlan'
import type { CheckinStatus, RewardGrant } from '../types'

const grant = { id: 'g1' } as RewardGrant

const status = (over: Partial<CheckinStatus>): CheckinStatus => ({
  enabled: true,
  exempt: false,
  today: '2026-10-19',
  checkedInToday: false,
  canCheckin: true,
  streakLength: 0,
  streakDay: 1,
  pointsPerDay: 5,
  streakBonuses: [],
  pointsThisMonth: 0,
  recentDays: [],
  ...over,
})

describe('levelOf', () => {
  it('điểm danh thường là cấp nhỏ', () => {
    expect(levelOf({ kind: 'CHECKIN', points: 5, streakLength: 3, bonusPoints: 0 })).toBe('small')
  })

  it('điểm danh chạm mốc thưởng chuỗi là cấp vừa', () => {
    expect(levelOf({ kind: 'CHECKIN', points: 55, streakLength: 12, bonusPoints: 50 })).toBe('medium')
  })

  it.each([7, 30, 100])('chuỗi tròn %i ngày là cấp vừa dù không có thưởng mốc', (days) => {
    expect(levelOf({ kind: 'CHECKIN', points: 5, streakLength: days, bonusPoints: 0 })).toBe('medium')
  })

  it('chuỗi không tròn, không thưởng mốc vẫn là cấp nhỏ', () => {
    expect(levelOf({ kind: 'CHECKIN', points: 5, streakLength: 8 })).toBe('small')
  })

  it('đổi quà xong là cấp vừa', () => {
    expect(levelOf({ kind: 'GIFT', points: 200 })).toBe('medium')
  })

  it.each([
    [1, 'small'], [49, 'small'],
    [50, 'medium'], [499, 'medium'],
    [500, 'large'], [5000, 'large'],
  ] as const)('thưởng %i điểm là cấp %s', (points, level) => {
    expect(levelOf({ kind: 'POINTS', points })).toBe(level)
  })

  it('kèm giấy khen thì luôn cả màn hình (lớn nhất), kể cả ít điểm', () => {
    expect(levelOf({ kind: 'POINTS', points: 1, certificate: grant })).toBe('grand')
    expect(levelOf({ kind: 'POINTS', points: 1000, certificate: grant })).toBe('grand')
  })

  it('điểm danh tối đa cấp vừa dù thưởng mốc rất lớn', () => {
    expect(levelOf({ kind: 'CHECKIN', points: 5000, streakLength: 100, bonusPoints: 4995 })).toBe('medium')
  })
})

describe('planBatch', () => {
  const points = (p: number, extra: Partial<CelebrationEvent> = {}): CelebrationEvent => ({ kind: 'POINTS', points: p, ...extra })

  it('gộp mọi lượt thưởng điểm thành MỘT hộp với tổng điểm', () => {
    const shows = planBatch([points(10), points(100), points(10)])
    expect(shows).toHaveLength(1)
    // Ba lượt nhỏ (10 + 100 + 10) cộng lại 120 ⇒ cấp theo TỔNG = vừa.
    expect(shows[0]).toMatchObject({ kind: 'POINTS', level: 'medium', totalPoints: 120 })
    expect(shows[0]!.events).toHaveLength(3)
  })

  it('nhiều lượt nhỏ cộng lại vượt ngưỡng thì nhóm lên cả màn hình', () => {
    expect(planBatch([points(200), points(200), points(200)])[0]!.level).toBe('large')
  })

  it('có giấy khen trong nhóm thì cả hộp lên lớn nhất và giữ lại giấy khen', () => {
    const shows = planBatch([points(10), points(100, { certificate: grant, refId: 'g1' }), points(10)])
    expect(shows[0]!.level).toBe('grand')
    expect(shows[0]!.certificates.map((e) => e.refId)).toEqual(['g1'])
  })

  it('điểm danh và đổi quà giữ riêng, đúng thứ tự; hộp thưởng đứng chỗ lượt thưởng đầu tiên', () => {
    const shows = planBatch([
      { kind: 'CHECKIN', points: 5 },
      points(10),
      { kind: 'GIFT', points: 200 },
      points(20),
    ])
    expect(shows.map((s) => s.kind)).toEqual(['CHECKIN', 'POINTS', 'GIFT'])
    expect(shows[1]!.totalPoints).toBe(30)
  })

  it('danh sách rỗng thì không có hộp nào', () => {
    expect(planBatch([])).toEqual([])
  })
})

describe('checkinBonusPoints', () => {
  it('lấy thưởng mốc máy chủ báo trước lần bấm', () => {
    expect(checkinBonusPoints(status({ canCheckin: true, nextBonusPoints: 50 }), status({ checkedInToday: true }))).toBe(50)
  })

  it('không có trạng thái cũ thì suy từ mốc đúng vị trí trong chu kỳ', () => {
    const next = status({ checkedInToday: true, canCheckin: false, streakDay: 7, streakBonuses: [{ day: 7, points: 30 }] })
    expect(checkinBonusPoints(undefined, next)).toBe(30)
  })

  it('đã qua mốc từ trước thì không tính là chạm mốc hôm nay', () => {
    const next = status({ checkedInToday: true, canCheckin: false, streakDay: 8, streakBonuses: [{ day: 7, points: 30 }] })
    expect(checkinBonusPoints(undefined, next)).toBe(0)
  })
})
