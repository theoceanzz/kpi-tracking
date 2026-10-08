import { MarkerType, Position, type Edge, type Node } from '@xyflow/react'
import dagre from 'dagre'
import type { OrgUnitRelationType, OrgUnitTreeResponse } from '../types/org-unit'

export const ORG_NODE_WIDTH = 220
export const ORG_NODE_HEIGHT = 80

/**
 * Kiểu nét theo quy ước sơ đồ tổ chức: nét liền = trực tuyến (chỉ đạo trực tiếp), nét đứt = tham mưu
 * hoặc giám sát độc lập — hai loại nét đứt khác màu. Nét chấm để dành cho quan hệ phối hợp chéo (chưa
 * làm). Màu là token theme nên đúng cả nền tối. Chú thích trên sơ đồ đọc cùng bảng này.
 */
export const RELATION_EDGE_STYLE: Record<OrgUnitRelationType, { stroke: string; strokeWidth: number; strokeDasharray?: string }> = {
  DIRECT: { stroke: 'var(--color-muted-foreground)', strokeWidth: 2.5 },
  ADVISORY: { stroke: 'var(--color-info)', strokeWidth: 2, strokeDasharray: '6 4' },
  SUPERVISORY: { stroke: 'var(--color-warning)', strokeWidth: 2, strokeDasharray: '6 4' },
}

export const relationOf = (unit: Pick<OrgUnitTreeResponse, 'parentRelation'>): OrgUnitRelationType =>
  unit.parentRelation ?? 'DIRECT'

/** Node của sơ đồ: luôn kiểu 'custom' (CustomNode trong OrgMindmapView). */
export type OrgChartNode<D extends Record<string, unknown>> = Node<D, 'custom'>

export interface FlatOrgChart<D extends Record<string, unknown>> {
  nodes: OrgChartNode<D>[]
  edges: Edge[]
  /** Có ít nhất một đơn vị tham mưu / giám sát — sơ đồ khi đó dùng bố cục nửa cấp. */
  hasSideUnits: boolean
}

/** Cây đơn vị → node + cạnh của XY Flow (chưa có toạ độ). `toData` dựng phần data của node. */
export function flattenOrgTree<D extends Record<string, unknown>>(
  roots: OrgUnitTreeResponse[],
  toData: (unit: OrgUnitTreeResponse) => D,
): FlatOrgChart<D> {
  const nodes: OrgChartNode<D>[] = []
  const edges: Edge[] = []
  let hasSideUnits = false

  const visit = (unit: OrgUnitTreeResponse, parentId: string | null) => {
    nodes.push({ id: unit.id, type: 'custom', data: toData(unit), position: { x: 0, y: 0 } })
    if (parentId) {
      const relation = relationOf(unit)
      if (relation !== 'DIRECT') hasSideUnits = true
      const style = RELATION_EDGE_STYLE[relation]
      edges.push({
        id: `${parentId}-${unit.id}`,
        source: parentId,
        target: unit.id,
        type: 'smoothstep',
        style,
        data: { relation },
        markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: style.stroke },
      })
    }
    unit.children?.forEach(child => visit(child, unit.id))
  }
  roots.forEach(root => visit(root, null))
  return { nodes, edges, hasSideUnits }
}

/**
 * Xếp chỗ bằng dagre (trái → phải). Có đơn vị tham mưu/giám sát thì cạnh trực tuyến dài 2 cấp
 * (`minlen: 2`) còn cạnh tham mưu/giám sát dài 1 cấp: đơn vị tham mưu/giám sát rơi vào "nửa cấp"
 * giữa đơn vị cha và các con trực tuyến — nhánh bên như sơ đồ tổ chức truyền thống. Không có đơn vị
 * nào như vậy thì mọi cạnh 1 cấp, bố cục y như trước.
 *
 * Đồ thị dagre tạo mới mỗi lần: bản cũ dùng chung một đồ thị cấp module nên đơn vị đã xoá vẫn chiếm chỗ.
 */
export function layoutOrgChart<D extends Record<string, unknown>>(chart: FlatOrgChart<D>): { nodes: OrgChartNode<D>[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR' })
  chart.nodes.forEach(n => g.setNode(n.id, { width: ORG_NODE_WIDTH, height: ORG_NODE_HEIGHT }))
  chart.edges.forEach(e => {
    const relation = (e.data as { relation?: OrgUnitRelationType } | undefined)?.relation ?? 'DIRECT'
    g.setEdge(e.source, e.target, { minlen: chart.hasSideUnits && relation === 'DIRECT' ? 2 : 1 })
  })
  dagre.layout(g)

  const nodes = chart.nodes.map(n => {
    const p = g.node(n.id)
    return {
      ...n,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: { x: p.x - ORG_NODE_WIDTH / 2, y: p.y - ORG_NODE_HEIGHT / 2 },
    }
  })
  if (!chart.hasSideUnits) return { nodes, edges: chart.edges }

  // Có nhánh bên: cạnh trực tuyến dài 2 cấp phải đi qua cột nửa cấp. `smoothstep` của XY Flow bẻ góc
  // ở giữa đoạn nên đường chui ngay qua các ô tham mưu/giám sát (trông như phòng ban trực thuộc Ban
  // Kiểm soát). Dagre đã chừa một làn trống trong cột đó (điểm "dummy") — vẽ đi đúng làn ấy.
  // Dagre còn chèn điểm "nhãn" nằm giữa khe hai cột — bỏ, chỉ giữ điểm nằm đúng tâm một cột có ô.
  const columnXs = new Set(nodes.map(n => Math.round(n.position.x + ORG_NODE_WIDTH / 2)))
  const edges = chart.edges.map(e => {
    const via = (g.edge(e.source, e.target)?.points ?? []).slice(1, -1)
      .filter(pt => columnXs.has(Math.round(pt.x)))
      .map(pt => ({ x: pt.x, y: pt.y }))
    const relation = (e.data as { relation?: OrgUnitRelationType } | undefined)?.relation ?? 'DIRECT'
    return { ...e, type: 'orgRoute', data: { ...e.data, relation, via } }
  })
  return { nodes, edges }
}

export interface RoutePoint { x: number; y: number }

/**
 * Đường gấp khúc vuông góc từ tay nắm nguồn (bên phải đơn vị cha) tới tay nắm đích (bên trái đơn vị
 * con), đi qua các làn dagre chừa (`via`, mỗi điểm là tâm làn ở một cột trung gian). Chỉ bẻ góc trong
 * KHE giữa hai cột — không bao giờ trong một cột có ô — và đi ngang qua cột trung gian ở đúng làn.
 *
 * `bendAt` (0–1): vị trí bẻ góc trong khe. Cạnh nhánh bên bẻ muộn hơn cạnh trực tuyến để hai đường
 * thẳng đứng không chồng lên nhau ngay sau đơn vị cha.
 */
export function orthogonalRoute(
  source: RoutePoint, target: RoutePoint, via: RoutePoint[], bendAt = 0.5, columnWidth = ORG_NODE_WIDTH,
): RoutePoint[] {
  const pts: RoutePoint[] = [source]
  let cur = source
  const half = columnWidth / 2
  const stops = [...via.map(v => ({ left: v.x - half, right: v.x + half, y: v.y })), { left: target.x, right: target.x, y: target.y }]
  for (const stop of stops) {
    const bendX = cur.x + (stop.left - cur.x) * bendAt
    if (stop.y !== cur.y) {
      pts.push({ x: bendX, y: cur.y }, { x: bendX, y: stop.y })
    }
    pts.push({ x: stop.right, y: stop.y })
    cur = { x: stop.right, y: stop.y }
  }
  return pts
}

/** Điểm → thuộc tính `d` của SVG path. */
export function toSvgPath(points: RoutePoint[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}
