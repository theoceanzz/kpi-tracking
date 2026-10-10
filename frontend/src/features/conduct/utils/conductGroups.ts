import type { ConductItem } from '../api/conductApi'

/** Một nhóm tiêu chí trên phiếu, gom từ các dòng có cùng `groupPosition`. */
export interface ConductItemGroup {
  key: string
  name: string
  /** % của nhóm trên tổng. */
  weight: number
  position: number
  items: ConductItem[]
}

/**
 * Gom dòng phiếu theo nhóm (bộ → nhóm → tiêu chí). `null` khi phiếu không chia nhóm — chỗ vẽ giữ
 * nguyên bố cục phẳng như trước. Thứ tự: theo vị trí nhóm, trong nhóm theo vị trí tiêu chí.
 */
export function groupConductItems(items: ConductItem[]): ConductItemGroup[] | null {
  if (!items.some(i => i.groupName != null)) return null
  const byKey = new Map<string, ConductItemGroup>()
  for (const item of [...items].sort((a, b) => a.position - b.position)) {
    const key = `${item.groupPosition ?? 0}:${item.groupName ?? ''}`
    let g = byKey.get(key)
    if (!g) {
      g = { key, name: item.groupName ?? '', weight: item.groupWeight ?? 0, position: item.groupPosition ?? 0, items: [] }
      byKey.set(key, g)
    }
    g.items.push(item)
  }
  return [...byKey.values()].sort((a, b) => a.position - b.position)
}

/**
 * Điểm của MỘT nhóm trên thang chấm = Σ(điểm × % trong nhóm) / 100 — dòng "Total" của từng nhóm.
 * Tổng phiếu = Σ(điểm nhóm × % nhóm) / 100, trùng với tổng cộng theo trọng số trên tổng.
 * `null` khi chưa dòng nào trong nhóm được chấm.
 */
export function groupScore(items: ConductItem[], scoreOf: (item: ConductItem) => number | null): number | null {
  let sum = 0
  let any = false
  for (const i of items) {
    const s = scoreOf(i)
    if (s == null) continue
    any = true
    sum += (s * (i.weightInGroup ?? i.weight)) / 100
  }
  return any ? Math.round(sum * 100) / 100 : null
}

/** Ký hiệu nhóm a, b, c… như phiếu giấy ("Total - 5 giá trị cốt lõi (a)"). */
export const groupLetter = (index: number) => String.fromCharCode(97 + (index % 26))
