import type { TreeNode } from '@/components/charts/primitives/HierarchicalTreemap'
import type { OrgUnitKpiDetail } from '@/features/dashboard/api/orgUnitKpiApi'

export interface UnitGroup {
  id: string
  name: string
  kpis: OrgUnitKpiDetail[]
}

export interface PeriodGroup {
  key: string
  name: string
  startMs: number
  /** Các cây phân cấp — gốc có ít nhất một con nằm trong tập đang xem. */
  trees: TreeNode[]
  /** KPI độc lập, gom theo đơn vị sở hữu. */
  units: Map<string, UnitGroup>
  kpiCount: number
}

/**
 * Một dòng KPI → một nút treemap, mang theo ĐỦ thông tin nhận diện loại.
 *
 * <p>Bản trước chỉ chuyển id/tên/trọng số/tiến độ/đơn vị/quan hệ, nên biểu đồ không có cách nào
 * vẽ ra KPI thưởng, định tính, chung hay thay thế dù dữ liệu nằm sẵn trong tay.
 */
export function toTreeNode(
  k: OrgUnitKpiDetail,
  kids: OrgUnitKpiDetail[],
  childrenOf: Map<string, OrgUnitKpiDetail[]>,
): TreeNode {
  return {
    id: k.kpiId,
    name: k.kpiName,
    value: k.weight ?? 0,
    achievement: k.progress,
    unitName: k.orgUnitName,
    relation: k.parentRelationType ?? null,
    isBonus: !!k.isBonusKpi,
    isQualitative: k.kpiType === 'QUALITATIVE',
    isReverse: !!k.isReverseKpi,
    isShared: !!k.shared,
    replacedKpiName: k.replacedKpiName ?? null,
    replacementReason: k.replacementReason ?? null,
    targetValue: k.targetValue,
    actualValue: k.actualValue,
    unit: k.unit,
    periodName: k.periodName ?? null,
    children: kids.length
      ? kids.map(c => toTreeNode(c, childrenOf.get(c.kpiId) ?? [], childrenOf))
      : undefined,
  }
}

/**
 * Gom KPI theo đợt, rồi trong mỗi đợt tách thành cây phân cấp và KPI độc lập theo đơn vị.
 *
 * <p>Khoá theo đợt là BẮT BUỘC dù nơi gọi có hiện đợt ra hay không: quan hệ cha-con luôn nằm gọn
 * trong một đợt, dựng cây xuyên đợt sẽ nối KPI tháng 6 vào cha tháng 5.
 *
 * <p>Cha không nằm trong tập đang xem thì con được coi như gốc — nếu không, KPI đó biến mất khỏi
 * hình mà không ai biết.
 */
export function groupKpisByPeriod(rows: OrgUnitKpiDetail[]): PeriodGroup[] {
  const byPeriod = new Map<string, OrgUnitKpiDetail[]>()
  rows.forEach(k => {
    const key = k.periodName ?? 'Không rõ đợt'
    if (!byPeriod.has(key)) byPeriod.set(key, [])
    byPeriod.get(key)!.push(k)
  })

  return [...byPeriod.entries()]
    .map(([key, periodRows]) => {
      const ids = new Set(periodRows.map(r => r.kpiId))
      const childrenOf = new Map<string, OrgUnitKpiDetail[]>()
      periodRows.forEach(r => {
        if (r.parentId && ids.has(r.parentId)) {
          if (!childrenOf.has(r.parentId)) childrenOf.set(r.parentId, [])
          childrenOf.get(r.parentId)!.push(r)
        }
      })
      const roots = periodRows.filter(r => !r.parentId || !ids.has(r.parentId))

      const trees: TreeNode[] = []
      const units = new Map<string, UnitGroup>()
      roots.forEach(r => {
        const kids = childrenOf.get(r.kpiId) ?? []
        if (kids.length > 0) {
          trees.push(toTreeNode(r, kids, childrenOf))
        } else {
          const uKey = r.orgUnitId ?? r.orgUnitName
          if (!units.has(uKey)) units.set(uKey, { id: uKey, name: r.orgUnitName, kpis: [] })
          units.get(uKey)!.kpis.push(r)
        }
      })

      return {
        key,
        name: key,
        startMs: periodRows[0]?.periodStart ? new Date(periodRows[0].periodStart!).getTime() : 0,
        trees,
        units,
        kpiCount: periodRows.length,
      }
    })
    .sort((a, b) => b.startMs - a.startMs)
}

/**
 * Bọc các KPI độc lập của một đơn vị vào một nút tổng hợp mang tên đơn vị.
 *
 * <p>`id` để trống là có chủ ý: nút này KHÔNG phải một KPI nên không được bấm mở chi tiết. Nhờ nó
 * mà khung ngoài có nhãn — đúng dáng sơ đồ phân cấp — thay vì một mảng ô rời không rõ thuộc về ai.
 */
export function unitAsTreeNode(unit: UnitGroup): TreeNode {
  return {
    name: unit.name,
    value: 0, // diện tích lấy tổng con, xem `nodeValue`
    children: unit.kpis.map(k => toTreeNode(k, [], new Map())),
  }
}
