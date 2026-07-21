// Trọng số THẬT của KPI = trọng số form × %hạng_mục, với %hạng_mục lấy từ thẻ điểm áp dụng cho
// đơn vị của KPI (resolve đơn vị → cha → thẻ điểm mặc định), khớp cơ chế chấm điểm của backend.
// Không bật BSC / KPI chưa gán hạng mục / kỳ chưa có thẻ điểm ⇒ trả null (hiển thị trọng số form như cũ).

type Scorecard = {
  kpiPeriodId: string
  orgUnits?: { id: string }[] | null
  perspectives: { perspectiveId: string; weightPercentage?: number | null }[]
}
type TreeNode = { id: string; parentId?: string | null; children?: TreeNode[] }

function buildUnitParent(tree: TreeNode[] | undefined): Map<string, string | null> {
  const map = new Map<string, string | null>()
  const walk = (nodes: any[]) => (nodes || []).forEach((n: any) => { map.set(n.id, n.parentId ?? null); if (n.children) walk(n.children) })
  walk(tree || [])
  return map
}

function resolveScorecard(unitId: string | undefined | null, periodScs: Scorecard[], parent: Map<string, string | null>): Scorecard | null {
  if (unitId) {
    let cur: string | null = unitId, guard = 0
    while (cur && guard++ < 100) {
      const found = periodScs.find(s => (s.orgUnits || []).some(u => u.id === cur))
      if (found) return found
      cur = parent.get(cur) ?? null
    }
  }
  return periodScs.find(s => !s.orgUnits || s.orgUnits.length === 0) || null
}

function realWeightOf(kpi: any, scorecards: Scorecard[], parent: Map<string, string | null>): number | null {
  if (!kpi || kpi.weight == null || !kpi.effectivePerspectiveId || !kpi.kpiPeriodId) return null
  const periodScs = scorecards.filter(s => s.kpiPeriodId === kpi.kpiPeriodId)
  if (!periodScs.length) return null
  const sc = resolveScorecard(kpi.orgUnitId || kpi.orgUnitIds?.[0], periodScs, parent)
  if (!sc) return null
  const sp = sc.perspectives.find(p => p.perspectiveId === kpi.effectivePerspectiveId)
  if (!sp || sp.weightPercentage == null) return null
  return kpi.weight * sp.weightPercentage / 100
}

/** Trọng số thật cho MỘT KPI (null nếu không áp dụng). */
export function computeRealWeight(kpi: any, scorecards: Scorecard[] | undefined, orgUnitTree: TreeNode[] | undefined, enableBsc?: boolean): number | null {
  if (!enableBsc || !scorecards) return null
  return realWeightOf(kpi, scorecards, buildUnitParent(orgUnitTree))
}

/** Map id KPI → trọng số thật, cho danh sách KPI. */
export function buildRealWeightById(kpis: any[], scorecards: Scorecard[] | undefined, orgUnitTree: TreeNode[] | undefined, enableBsc?: boolean): Map<string, number> {
  const map = new Map<string, number>()
  if (!enableBsc || !scorecards) return map
  const parent = buildUnitParent(orgUnitTree)
  for (const kpi of kpis || []) {
    const rw = realWeightOf(kpi, scorecards, parent)
    if (rw != null) map.set(kpi.id, rw)
  }
  return map
}
