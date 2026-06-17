import type { KpiCriteria } from '@/types/kpi'

export interface KpiTreeRow {
  kpi: KpiCriteria
  depth: number
}

// Group child KPIs (parentId pointing to another KPI in the same list) directly under their parent,
// so table/card views can render a collapsible parent → children hierarchy instead of a flat list.
export function buildKpiRows(list: KpiCriteria[], collapsedParents: Set<string>) {
  const byId = new Map(list.map(k => [k.id, k]))
  const childrenMap = new Map<string, KpiCriteria[]>()
  list.forEach(k => {
    if (k.parentId && byId.has(k.parentId)) {
      const arr = childrenMap.get(k.parentId) || []
      arr.push(k)
      childrenMap.set(k.parentId, arr)
    }
  })
  const topLevel = list.filter(k => !k.parentId || !byId.has(k.parentId))
  const rows: KpiTreeRow[] = []
  topLevel.forEach(k => {
    rows.push({ kpi: k, depth: 0 })
    const children = childrenMap.get(k.id)
    if (children && !collapsedParents.has(k.id)) {
      children.forEach(c => rows.push({ kpi: c, depth: 1 }))
    }
  })
  return { rows, childrenByParentId: childrenMap }
}
