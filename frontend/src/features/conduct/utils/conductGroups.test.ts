import { describe, expect, it } from 'vitest'
import { groupConductItems, groupLetter, groupScore } from './conductGroups'
import type { ConductItem } from '../api/conductApi'

/** Dòng phiếu như backend trả: weight = % trên tổng = % trong nhóm × % nhóm. */
const item = (position: number, group: [string, number, number] | null, weightInGroup: number): ConductItem => ({
  name: `TC${position}`,
  position,
  weight: group ? (weightInGroup * group[1]) / 100 : weightInGroup,
  groupName: group?.[0] ?? null,
  groupWeight: group?.[1] ?? null,
  groupPosition: group?.[2] ?? null,
  weightInGroup: group ? weightInGroup : null,
})

const CORE: [string, number, number] = ['5 giá trị cốt lõi', 30, 1]
const TRAITS: [string, number, number] = ['10 đặc điểm nhân sự', 40, 2]
const GOLD: [string, number, number] = ['6 chữ vàng', 30, 3]

describe('groupConductItems', () => {
  it('phiếu không chia nhóm (phiếu cũ) → null, chỗ vẽ giữ bố cục phẳng', () => {
    expect(groupConductItems([item(1, null, 50), item(2, null, 50)])).toBeNull()
  })

  it('gom theo nhóm, đúng thứ tự nhóm và thứ tự tiêu chí', () => {
    const groups = groupConductItems([
      item(3, TRAITS, 100), item(1, CORE, 50), item(4, GOLD, 100), item(2, CORE, 50),
    ])!
    expect(groups.map(g => g.name)).toEqual(['5 giá trị cốt lõi', '10 đặc điểm nhân sự', '6 chữ vàng'])
    expect(groups[0]!.items.map(i => i.position)).toEqual([1, 2])
    expect(groups.map(g => g.weight)).toEqual([30, 40, 30])
  })
})

describe('groupScore — điểm nhóm trên thang chấm', () => {
  const core = [item(1, CORE, 20), item(2, CORE, 20), item(3, CORE, 20), item(4, CORE, 20), item(5, CORE, 20)]

  it('Σ(điểm × % trong nhóm)/100', () => {
    const scores: Record<number, number> = { 1: 5, 2: 4, 3: 4, 4: 3, 5: 4 }
    expect(groupScore(core, i => scores[i.position] ?? null)).toBe(4)
  })

  it('chưa chấm dòng nào → null (khác với 0 điểm)', () => {
    expect(groupScore(core, () => null)).toBeNull()
  })

  it('tổng phiếu = a×30% + b×40% + c×30%, trùng Σ(điểm × % trên tổng)', () => {
    const items = [
      ...core,
      ...Array.from({ length: 10 }, (_, k) => item(6 + k, TRAITS, 10)),
      ...Array.from({ length: 6 }, (_, k) => item(16 + k, GOLD, 100 / 6)),
    ]
    const score = (i: ConductItem) => (i.position % 3) + 2 // 2..4
    const groups = groupConductItems(items)!
    const byGroups = groups.reduce((s, g) => s + (groupScore(g.items, score)! * g.weight) / 100, 0)
    const byOverall = items.reduce((s, i) => s + (score(i) * i.weight) / 100, 0)
    expect(byGroups).toBeCloseTo(byOverall, 1)
  })
})

it('ký hiệu nhóm a, b, c như phiếu giấy', () => {
  expect([0, 1, 2].map(groupLetter)).toEqual(['a', 'b', 'c'])
})
