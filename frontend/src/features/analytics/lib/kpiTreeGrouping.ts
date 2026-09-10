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
  /**
   * KPI độc lập, gom theo đơn vị sở hữu.
   *
   * <p>Chỉ còn dùng để ĐẾM ở tiêu đề đợt. Không dựng thành khung bọc quanh KPI nữa: hình chỉ
   * được phép có KPI lồng KPI, mọi hộp khác đều là tầng thừa che mất cấu trúc thật.
   */
  units: Map<string, UnitGroup>
  /** Chính những KPI độc lập đó, để phẳng — nằm ngang hàng với `trees` trong cùng một treemap. */
  leaves: TreeNode[]
  kpiCount: number
}

/**
 * Một dòng KPI → một nút treemap, mang theo ĐỦ thông tin nhận diện loại.
 *
 * <p>Đệ quy theo `k.children` — chính cái cây mà API đã lồng sẵn. Xem `groupKpisByPeriod` để
 * biết vì sao không dựng cây bằng cách nối `parentId` giữa các dòng.
 */
export function toTreeNode(k: OrgUnitKpiDetail): TreeNode {
  const kids = k.children ?? []
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
    children: kids.length ? kids.map(toTreeNode) : undefined,
  }
}

/**
 * Gom KPI theo đợt, rồi trong mỗi đợt tách thành cây phân cấp và KPI độc lập.
 *
 * <p>Cây dựng từ `children` mà API trả về, KHÔNG phải bằng cách nối `parentId` giữa các dòng.
 * Endpoint `/stats/org-unit/kpis/details` chỉ liệt kê KPI cấp cao nhất — nó lọc `parent == null`
 * rồi lồng con vào trường `children`. Nên mọi dòng trả về đều có `parentId` rỗng, và bản trước
 * quét `parentId` giữa các dòng anh em thì không bao giờ khớp: `trees` luôn rỗng và phần lồng
 * nhau chưa từng hiển thị, dù dữ liệu có sẵn cả cây ba tầng.
 *
 * <p>Vẫn khoá theo đợt vì tiêu đề accordion đếm theo đợt; bản thân cây thì không cần — con luôn
 * cùng đợt với cha, do chính API dựng.
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
      const trees: TreeNode[] = []
      const units = new Map<string, UnitGroup>()
      periodRows.forEach(r => {
        if (r.children?.length) {
          trees.push(toTreeNode(r))
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
        leaves: [...units.values()].flatMap(u => u.kpis.map(toTreeNode)),
        kpiCount: periodRows.length,
      }
    })
    .sort((a, b) => b.startMs - a.startMs)
}
