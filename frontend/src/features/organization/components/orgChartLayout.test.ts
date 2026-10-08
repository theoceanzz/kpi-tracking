import { describe, expect, it } from 'vitest'
import { RELATION_EDGE_STYLE, flattenOrgTree, layoutOrgChart, orthogonalRoute, ORG_NODE_WIDTH, ORG_NODE_HEIGHT, type RoutePoint } from './orgChartLayout'
import type { OrgUnitRelationType, OrgUnitTreeResponse } from '../types/org-unit'

const unit = (id: string, children: OrgUnitTreeResponse[] = [], parentRelation?: OrgUnitRelationType): OrgUnitTreeResponse => ({
  id, name: id, code: id, parentId: null, type: 'Phòng', path: `/${id}/`, level: 1, status: 'ACTIVE', logoUrl: null,
  parentRelation, children,
})

const build = (roots: OrgUnitTreeResponse[]) => flattenOrgTree(roots, u => ({ name: u.name }))
const edgeTo = (chart: ReturnType<typeof build>, id: string) => chart.edges.find(e => e.target === id)!

describe('sơ đồ cơ cấu — kiểu nét theo quan hệ với cấp trên', () => {
  it('đơn vị cũ (không có parentRelation, như dữ liệu trước V38) vẽ nét liền, không chạy nét đứt', () => {
    const chart = build([unit('root', [unit('it'), unit('hr')])])

    for (const e of chart.edges) {
      expect(e.style).toEqual(RELATION_EDGE_STYLE.DIRECT)
      expect(e.style?.strokeDasharray).toBeUndefined()
      expect(e.animated).toBeFalsy()
    }
    expect(chart.hasSideUnits).toBe(false)
  })

  it('ADVISORY và SUPERVISORY vẽ nét đứt, khác màu nhau và khác nét trực tuyến', () => {
    const chart = build([unit('root', [unit('it', [], 'DIRECT'), unit('adv', [], 'ADVISORY'), unit('sup', [], 'SUPERVISORY')])])

    const direct = edgeTo(chart, 'it').style!
    const advisory = edgeTo(chart, 'adv').style!
    const supervisory = edgeTo(chart, 'sup').style!
    expect(direct.strokeDasharray).toBeUndefined()
    expect(advisory.strokeDasharray).toBeTruthy()
    expect(supervisory.strokeDasharray).toBeTruthy()
    expect(advisory.stroke).not.toBe(supervisory.stroke)
    expect(direct.stroke).not.toBe(advisory.stroke)
    expect(Number(direct.strokeWidth)).toBeGreaterThan(Number(advisory.strokeWidth))
    expect(chart.hasSideUnits).toBe(true)
  })

  it('mũi tên cùng màu với nét', () => {
    const chart = build([unit('root', [unit('sup', [], 'SUPERVISORY')])])
    const e = edgeTo(chart, 'sup')
    expect((e.markerEnd as { color?: string }).color).toBe(RELATION_EDGE_STYLE.SUPERVISORY.stroke)
  })
})

describe('sơ đồ cơ cấu — bố cục nhánh bên (minlen)', () => {
  const xOf = (nodes: { id: string; position: { x: number } }[], id: string) => nodes.find(n => n.id === id)!.position.x

  it('không có đơn vị tham mưu/giám sát: mỗi cấp cách nhau đúng 1 cột như trước', () => {
    const { nodes } = layoutOrgChart(build([unit('root', [unit('it', [unit('be')])])]))
    const step1 = xOf(nodes, 'it') - xOf(nodes, 'root')
    const step2 = xOf(nodes, 'be') - xOf(nodes, 'it')
    expect(step1).toBeGreaterThanOrEqual(ORG_NODE_WIDTH)
    expect(step2).toBeCloseTo(step1)
  })

  it('đơn vị tham mưu nằm ở nửa cấp: giữa đơn vị cha và các con trực tuyến', () => {
    const { nodes } = layoutOrgChart(build([unit('root', [unit('it'), unit('adv', [], 'ADVISORY')])]))
    const root = xOf(nodes, 'root')
    const adv = xOf(nodes, 'adv')
    const it = xOf(nodes, 'it')
    expect(adv).toBeGreaterThan(root)
    expect(adv).toBeLessThan(it)
  })

  it('đồ thị dựng mới mỗi lần — đơn vị đã xoá không còn trong lần xếp sau', () => {
    layoutOrgChart(build([unit('root', [unit('old')])]))
    const { nodes } = layoutOrgChart(build([unit('root', [unit('new')])]))
    expect(nodes.map(n => n.id).sort()).toEqual(['new', 'root'])
  })
})

describe('sơ đồ cơ cấu — đường nối không chui qua ô đơn vị khác', () => {
  // Cây giống DEMO1 sau khi seed: chi nhánh có 2 phòng trực tuyến (mỗi phòng 2 team) + Ban Cố vấn + Ban Kiểm soát.
  const demo = () => [unit('branch', [
    unit('it', [unit('be'), unit('fe')]),
    unit('media', [unit('content'), unit('design')]),
    unit('adv', [], 'ADVISORY'),
    unit('sup', [], 'SUPERVISORY'),
  ])]

  /** Đoạn thẳng (ngang hoặc dọc) có cắt vào phần trong của hình chữ nhật không. */
  const crosses = (a: RoutePoint, b: RoutePoint, box: { x: number; y: number }) => {
    const [x1, x2] = [Math.min(a.x, b.x), Math.max(a.x, b.x)]
    const [y1, y2] = [Math.min(a.y, b.y), Math.max(a.y, b.y)]
    const eps = 1
    return x2 > box.x + eps && x1 < box.x + ORG_NODE_WIDTH - eps && y2 > box.y + eps && y1 < box.y + ORG_NODE_HEIGHT - eps
  }

  it('cạnh trực tuyến/nhánh bên dùng đường đi riêng, không cắt ô nào ngoài nguồn và đích', () => {
    const { nodes, edges } = layoutOrgChart(build(demo()))
    const byId = new Map(nodes.map(n => [n.id, n]))
    expect(edges.every(e => e.type === 'orgRoute')).toBe(true)

    for (const e of edges) {
      const s = byId.get(e.source)!.position
      const t = byId.get(e.target)!.position
      const d = e.data as { relation: OrgUnitRelationType; via: RoutePoint[] }
      const pts = orthogonalRoute(
        { x: s.x + ORG_NODE_WIDTH, y: s.y + ORG_NODE_HEIGHT / 2 },
        { x: t.x, y: t.y + ORG_NODE_HEIGHT / 2 },
        d.via, d.relation === 'DIRECT' ? 0.5 : 0.75)
      for (let i = 1; i < pts.length; i++) {
        for (const n of nodes) {
          if (n.id === e.source || n.id === e.target) continue
          expect(crosses(pts[i - 1]!, pts[i]!, n.position), `${e.source}→${e.target} cắt qua ${n.id}`).toBe(false)
        }
      }
    }
  })

  it('không có nhánh bên: giữ smoothstep như cũ', () => {
    const { edges } = layoutOrgChart(build([unit('root', [unit('it', [unit('be')])])]))
    expect(edges.every(e => e.type === 'smoothstep')).toBe(true)
  })

  it('orthogonalRoute chỉ bẻ góc trong khe, đi ngang qua cột trung gian đúng làn', () => {
    const pts = orthogonalRoute({ x: 0, y: 0 }, { x: 600, y: 100 }, [{ x: 400, y: 200 }], 0.5, 220)
    // khe 1: 0 → 290 (mép trái cột trung gian), bẻ ở 145; khe 2: 510 → 600, bẻ ở 555.
    expect(pts).toEqual([
      { x: 0, y: 0 }, { x: 145, y: 0 }, { x: 145, y: 200 }, { x: 510, y: 200 },
      { x: 555, y: 200 }, { x: 555, y: 100 }, { x: 600, y: 100 },
    ])
  })
})
