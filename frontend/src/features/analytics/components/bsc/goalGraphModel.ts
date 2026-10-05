import type { BscGoalGraph, GoalStatus, GoalThresholds, GraphObjective } from '../../api/bscGoalGraphApi'

/**
 * Phần tính toán dùng chung của ba cách xem đồ thị mục tiêu (bản đồ, cây, xương cá).
 *
 * <p>Không có công thức nghiệp vụ nào ở đây: %đạt, trạng thái và ngưỡng đều do server cấp. Chỗ này
 * chỉ lo quan hệ cha–con để làm nổi nhánh liên quan, và màu theo ngưỡng server gửi kèm.
 */

/** Màu theo trạng thái. Ngưỡng ĐỌC TỪ payload, không hard-code ở client. */
export function statusTone(status: GoalStatus): { text: string; ring: string; dot: string } {
  switch (status) {
    case 'GOOD':   return { text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-400/60', dot: 'bg-emerald-500' }
    case 'WARN':   return { text: 'text-amber-600 dark:text-amber-400',     ring: 'ring-amber-400/60',   dot: 'bg-amber-500' }
    case 'BEHIND': return { text: 'text-rose-600 dark:text-rose-400',       ring: 'ring-rose-400/60',    dot: 'bg-rose-500' }
    default:       return { text: 'text-slate-400',                          ring: 'ring-slate-300/60',   dot: 'bg-slate-300' }
  }
}

export function statusLabelKey(status: GoalStatus): string {
  return `goalGraph.status${status.charAt(0)}${status.slice(1).toLowerCase()}`
}

/** Mô tả ngưỡng để người đọc biết màu dựa trên cái gì — ngưỡng do server quyết. */
export function thresholdHint(t: GoalThresholds): string {
  return `≥ ${t.good}% · ${t.warn}–${t.good}% · < ${t.warn}%`
}

/** Quan hệ cha–con, dựng một lần cho mỗi payload. */
export interface GoalAdjacency {
  parentOf: Map<string, string | undefined>
  childrenOf: Map<string, string[]>
}

export function buildAdjacency(graph?: BscGoalGraph): GoalAdjacency {
  const parentOf = new Map<string, string | undefined>()
  const childrenOf = new Map<string, string[]>()
  for (const o of graph?.objectives ?? []) {
    parentOf.set(o.id, o.parentId ?? undefined)
    if (o.parentId) {
      const list = childrenOf.get(o.parentId) ?? []
      list.push(o.id)
      childrenOf.set(o.parentId, list)
    }
  }
  return { parentOf, childrenOf }
}

/**
 * Nhánh liên quan tới một mục tiêu: chính nó + tổ tiên + hậu duệ.
 *
 * <p>Rê chuột làm nổi đúng nhánh này và làm mờ phần còn lại — BRD muốn thấy quan hệ mà không vẽ
 * sẵn mọi đường nối thành "mạng nhện".
 */
export function relatedIds(id: string | null, adj: GoalAdjacency): Set<string> {
  const out = new Set<string>()
  if (!id) return out
  out.add(id)
  let cur = adj.parentOf.get(id)
  let guard = 0
  while (cur && guard++ < 50) {
    out.add(cur)
    cur = adj.parentOf.get(cur)
  }
  const stack = [id]
  while (stack.length) {
    const next = stack.pop() as string
    for (const child of adj.childrenOf.get(next) ?? []) {
      if (out.has(child)) continue
      out.add(child)
      stack.push(child)
    }
  }
  return out
}

/** Nhãn nguồn gốc mục tiêu (BRD: phân biệt cascade từ công ty với mục tiêu đơn vị tự đặt). */
export function originKey(origin?: string | null): string | null {
  if (origin === 'ASSIGNED') return 'goalGraph.originAssigned'
  if (origin === 'SELF') return 'goalGraph.originSelf'
  return null
}

/** Mục tiêu xếp theo lĩnh vực, giữ đúng thứ tự dải mà server gửi. */
export function objectivesByPerspective(graph?: BscGoalGraph): Map<string, GraphObjective[]> {
  const byId = new Map((graph?.objectives ?? []).map(o => [o.id, o]))
  const out = new Map<string, GraphObjective[]>()
  for (const p of graph?.perspectives ?? []) {
    out.set(p.code, p.objectiveIds.map(id => byId.get(id)).filter((o): o is GraphObjective => !!o))
  }
  return out
}
