import { describe, it, expect } from 'vitest'
import { bscCoverage } from './scoring'
import type { PerspectiveScoreResponse } from '@/features/bsc/types'

const row = (weightPercentage: number, achievementPercent: number | null): PerspectiveScoreResponse => ({
  perspectiveId: String(Math.random()),
  name: 'x',
  weightPercentage,
  achievementPercent,
  weightedScore: achievementPercent != null ? (weightPercentage * achievementPercent) / 100 : null,
} as PerspectiveScoreResponse)

describe('bscCoverage', () => {
  // Ca thật: thẻ phòng 4 hạng mục, chỉ "Doanh thu" 20% có số (820/850).
  const rows = [row(20, 96.47), row(30, null), row(25, null), row(25, null)]

  it('bỏ qua hạng mục rỗng ⇒ điểm = % đạt của hạng mục duy nhất, đánh dấu renormalized', () => {
    const c = bscCoverage(rows, 96.47)
    expect(c.renormalized).toBe(true)
    expect(c.presentWeight).toBe(20)
    expect(c.totalWeight).toBe(100)
    expect(c.contribution).toBe(19.3)
    expect(c.present).toBe(1)
    expect(c.count).toBe(4)
  })

  it('thẻ "Tính 0" ⇒ điểm = Σ đóng góp, không cần ghi chú', () => {
    expect(bscCoverage(rows, 19.29).renormalized).toBe(false)
  })

  it('đủ số mọi hạng mục ⇒ không ghi chú', () => {
    const full = [row(50, 80), row(50, 100)]
    expect(bscCoverage(full, 90).renormalized).toBe(false)
  })

  it('chưa có điểm BSC ⇒ không ghi chú', () => {
    expect(bscCoverage(rows, null).renormalized).toBe(false)
  })
})
