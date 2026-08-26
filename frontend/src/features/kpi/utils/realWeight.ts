// Trọng số THẬT của KPI = trọng số form × %hạng_mục, với %hạng_mục lấy từ bộ tiêu chí áp dụng cho
// đơn vị của KPI (resolve đơn vị → cha → bộ tiêu chí mặc định), khớp cơ chế chấm điểm của backend.
// Không bật BSC / KPI chưa gán hạng mục / kỳ chưa có bộ tiêu chí ⇒ trả null (hiển thị trọng số form như cũ).

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

// ---------------------------------------------------------------------------
// Tổng trọng số — bám đúng KpiCriteriaService.calculateTotalWeightByOrgUnit /
// sumEffectiveForUser ở backend, để con số trên header nhóm khớp với con số
// backend dùng khi chặn gửi duyệt ("phải bằng chính xác 100%").
// ---------------------------------------------------------------------------

type WeighableKpi = {
  id: string
  weight: number | null
  isBonusKpi?: boolean
  parentId?: string | null
  parentRelationType?: string | null
  assigneeIds?: string[] | null
}

/**
 * KPI có được tính vào tổng trọng số không. Backend bỏ qua hai loại:
 * KPI thưởng (không nằm trong 100%) và KPI cha có con phân rã — cha chỉ là nhãn gộp,
 * trọng số thật nằm ở các con.
 */
function countsTowardTotal(kpi: WeighableKpi, decompositionParentIds: Set<string>): boolean {
  if (kpi.isBonusKpi) return false
  if (decompositionParentIds.has(kpi.id)) return false
  return true
}

/**
 * Id các KPI cha có ít nhất một con kiểu DECOMPOSITION.
 *
 * <p>Phải tính trên TOÀN danh sách đã tải rồi truyền xuống, đừng tính lại trong từng nhóm:
 * cha giao cho người này mà con giao cho người khác thì nhìn riêng nhóm của người cha sẽ
 * không thấy con nào, và cha bị cộng nhầm vào tổng.
 */
export function findDecompositionParentIds(kpis: WeighableKpi[]): Set<string> {
  const set = new Set<string>()
  for (const kpi of kpis || []) {
    if (kpi.parentId && kpi.parentRelationType === 'DECOMPOSITION') set.add(kpi.parentId)
  }
  return set
}

const effectiveOf = (kpi: WeighableKpi, realWeightById?: Map<string, number>) =>
  realWeightById?.get(kpi.id) ?? kpi.weight ?? 0

/** Tổng trọng số THẬT của MỘT người — khớp `sumEffectiveForUser` ở backend. */
export function sumWeightForPerson(
  kpis: WeighableKpi[],
  realWeightById?: Map<string, number>,
  decompositionParentIds?: Set<string>,
): number {
  const parents = decompositionParentIds ?? findDecompositionParentIds(kpis)
  return kpis.reduce(
    (sum, kpi) => countsTowardTotal(kpi, parents) ? sum + effectiveOf(kpi, realWeightById) : sum,
    0,
  )
}

/**
 * Tổng trọng số của MỘT ĐƠN VỊ — khớp `calculateTotalWeightByOrgUnit` ở backend:
 * KPI chưa giao cho ai + trọng số của người CAO NHẤT trong đơn vị (không cộng dồn mọi người).
 * Nhờ vậy một đơn vị đã cấu hình xong luôn ra đúng 100%, bất kể có bao nhiêu nhân sự.
 */
export function totalWeightForUnit(
  kpis: WeighableKpi[],
  realWeightById?: Map<string, number>,
  decompositionParentIds?: Set<string>,
): number {
  const decompositionParents = decompositionParentIds ?? findDecompositionParentIds(kpis)
  let unassigned = 0
  const perUser = new Map<string, number>()

  for (const kpi of kpis) {
    if (!countsTowardTotal(kpi, decompositionParents)) continue
    const weight = effectiveOf(kpi, realWeightById)
    const assignees = kpi.assigneeIds ?? []
    if (assignees.length === 0) {
      unassigned += weight
      continue
    }
    for (const id of assignees) perUser.set(id, (perUser.get(id) ?? 0) + weight)
  }

  if (perUser.size === 0) return unassigned
  return unassigned + Math.max(...perUser.values())
}
