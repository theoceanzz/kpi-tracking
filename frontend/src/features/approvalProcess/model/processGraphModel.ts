import dagre from 'dagre'
import type {
  ApprovalObjectType,
  ApprovalProcessCatalog,
  ConditionRule,
  ProcessBranch,
  ProcessEdge,
  ProcessGraph,
  ProcessNode,
  ProcessNodeType,
} from '../types'

/**
 * Mô hình sơ đồ quy trình duyệt — hàm thuần trên {@link ProcessGraph}, không đụng React.
 *
 * Luật kiểm và cách đánh số bước ở đây PHẢI khớp `ProcessGraphValidator.java` /
 * `ProcessGraph.stepCodes()` ở backend: giao diện báo lỗi ngay trên khung vẽ, backend vẫn là bên
 * quyết định lúc lưu.
 */

/** Kích thước hình của từng loại node (không tính nhãn chữ nằm ngoài hình). */
export const NODE_SIZE: Record<ProcessNodeType, { w: number; h: number }> = {
  START: { w: 56, h: 56 },
  CONDITION: { w: 64, h: 64 },
  STEP: { w: 72, h: 72 },
  APPROVED: { w: 52, h: 52 },
  REJECTED: { w: 52, h: 52 },
}

/** Khoảng giữa tâm hai node liền nhau theo chiều ngang / dọc khi tự đặt node mới. */
const COL = 200
const ROW = 150
const MAX_NODES = 100
const MAX_NAME = 255

/** Nhánh mỗi loại node được phép đi ra. */
export const BRANCHES_OF: Record<ProcessNodeType, ProcessBranch[]> = {
  START: ['NEXT'],
  CONDITION: ['YES', 'NO'],
  STEP: ['NEXT', 'REJECT'],
  APPROVED: [],
  REJECTED: [],
}

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

export function emptyGraph(): ProcessGraph {
  return { schemaVersion: 1, nodes: [{ id: 'start', type: 'START', x: 0, y: 0 }], edges: [] }
}

// ── Truy vấn ────────────────────────────────────────────────────────────────

export function nodeById(graph: ProcessGraph, id: string): ProcessNode | undefined {
  return graph.nodes.find((n) => n.id === id)
}

export function outgoing(graph: ProcessGraph, id: string): ProcessEdge[] {
  return graph.edges.filter((e) => e.source === id)
}

export function incoming(graph: ProcessGraph, id: string): ProcessEdge[] {
  return graph.edges.filter((e) => e.target === id)
}

export function outEdge(graph: ProcessGraph, id: string, branch: ProcessBranch): ProcessEdge | undefined {
  return graph.edges.find((e) => e.source === id && e.branch === branch)
}

function center(n: ProcessNode) {
  const s = NODE_SIZE[n.type]
  return { x: n.x + s.w / 2, y: n.y + s.h / 2 }
}

/** Id các node đi tới được từ Bắt đầu; {@code skip} = coi như node đó không tồn tại. */
export function reachableFromStart(graph: ProcessGraph, skip?: string): Set<string> {
  const seen = new Set<string>()
  const start = graph.nodes.find((n) => n.type === 'START')
  if (!start || start.id === skip) return seen
  const stack = [start.id]
  while (stack.length) {
    const id = stack.pop()!
    if (seen.has(id) || id === skip) continue
    seen.add(id)
    for (const e of outgoing(graph, id)) if (!seen.has(e.target)) stack.push(e.target)
  }
  return seen
}

function descendants(graph: ProcessGraph, id: string): Set<string> {
  const seen = new Set<string>()
  const stack = outgoing(graph, id).map((e) => e.target)
  while (stack.length) {
    const cur = stack.pop()!
    if (seen.has(cur) || cur === id) continue
    seen.add(cur)
    for (const e of outgoing(graph, cur)) stack.push(e.target)
  }
  return seen
}

/** {@code from} có đi tới được {@code to} không. */
function reaches(graph: ProcessGraph, from: string, to: string): boolean {
  return from === to || descendants(graph, from).has(to)
}

/** Thứ tự topo của các node đi tới được; null khi có vòng. */
export function topologicalOrder(graph: ProcessGraph): string[] | null {
  const reach = reachableFromStart(graph)
  const indegree = new Map<string, number>()
  reach.forEach((id) => indegree.set(id, 0))
  for (const e of graph.edges) {
    if (reach.has(e.source) && reach.has(e.target)) indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1)
  }
  const ready = [...indegree.entries()].filter(([, d]) => d === 0).map(([id]) => id)
  const order: string[] = []
  while (ready.length) {
    const id = ready.shift()!
    order.push(id)
    for (const e of outgoing(graph, id)) {
      if (!indegree.has(e.target)) continue
      const d = indegree.get(e.target)! - 1
      indegree.set(e.target, d)
      if (d === 0) ready.push(e.target)
    }
  }
  return order.length === reach.size ? order : null
}

/**
 * Mã bước kiểu 1Office (1, 1.1, 1.2, 2): cấp = số bước duyệt trên đường dài nhất từ Bắt đầu tới
 * bước đó. Cấp có nhiều bước thì thêm ".k" theo vị trí (trên xuống, trái sang).
 */
export function stepCodes(graph: ProcessGraph): Record<string, string> {
  const order = topologicalOrder(graph)
  const codes: Record<string, string> = {}
  if (!order) return codes
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const before = new Map<string, number>()
  for (const id of order) {
    let b = 0
    for (const e of incoming(graph, id)) {
      const p = before.get(e.source)
      if (p === undefined) continue
      b = Math.max(b, p + (byId.get(e.source)?.type === 'STEP' ? 1 : 0))
    }
    before.set(id, b)
  }
  const byLevel = new Map<number, ProcessNode[]>()
  for (const id of order) {
    const n = byId.get(id)
    if (n?.type !== 'STEP') continue
    const level = before.get(id)! + 1
    byLevel.set(level, [...(byLevel.get(level) ?? []), n])
  }
  for (const [level, nodes] of byLevel) {
    if (nodes.length === 1) {
      codes[nodes[0]!.id] = String(level)
      continue
    }
    const sorted = [...nodes].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))
    sorted.forEach((n, i) => { codes[n.id] = `${level}.${i + 1}` })
  }
  return codes
}

// ── Sửa ─────────────────────────────────────────────────────────────────────

export interface NewNodeLabels {
  step: string
  condition: string
}

function blankNode(type: ProcessNodeType, x: number, y: number, labels: NewNodeLabels): ProcessNode {
  switch (type) {
    case 'STEP':
      return { id: newId('step'), type, x, y, name: labels.step, approvers: [] }
    case 'CONDITION':
      return {
        id: newId('cond'), type, x, y, name: labels.condition,
        groups: [{ rules: [{ field: null, operator: null, values: [] }] }],
      }
    default:
      return { id: newId(type === 'APPROVED' ? 'ok' : 'no'), type, x, y }
  }
}

function occupied(graph: ProcessGraph, cx: number, cy: number, except?: string): boolean {
  return graph.nodes.some((n) => {
    if (n.id === except) return false
    const c = center(n)
    return Math.abs(c.x - cx) < COL * 0.6 && Math.abs(c.y - cy) < ROW * 0.6
  })
}

/** Chỗ trống bên phải (nhánh chính) hoặc phía dưới-phải (nhánh phụ) của node nguồn. */
function slotAfter(graph: ProcessGraph, source: ProcessNode, branch: ProcessBranch, type: ProcessNodeType) {
  const c = center(source)
  const size = NODE_SIZE[type]
  const cx = c.x + COL
  let cy = c.y + (branch === 'NO' || branch === 'REJECT' ? ROW : 0)
  while (occupied(graph, cx, cy)) cy += ROW
  return { x: Math.round(cx - size.w / 2), y: Math.round(cy - size.h / 2) }
}

function shiftRight(graph: ProcessGraph, ids: Set<string>, dx: number): ProcessGraph {
  return { ...graph, nodes: graph.nodes.map((n) => (ids.has(n.id) ? { ...n, x: n.x + dx } : n)) }
}

/** Nhánh chính đi ra của node vừa chèn vào giữa — nối tiếp tới node cũ phía sau. */
const CONTINUE_BRANCH: Partial<Record<ProcessNodeType, ProcessBranch>> = { STEP: 'NEXT', CONDITION: 'YES' }

/**
 * Thêm node mới sau {@code sourceId} trên nhánh {@code branch}. Nhánh đó đã nối tới node khác thì
 * node mới chèn vào GIỮA (bước / điều kiện), phần phía sau dịch sang phải nhường chỗ. Trạng thái
 * kết thúc chỉ thêm được vào nhánh còn trống.
 */
export function addNodeAfter(
  graph: ProcessGraph,
  sourceId: string,
  branch: ProcessBranch,
  type: ProcessNodeType,
  labels: NewNodeLabels,
): { graph: ProcessGraph; nodeId: string | null } {
  const source = nodeById(graph, sourceId)
  if (!source || !BRANCHES_OF[source.type].includes(branch) || graph.nodes.length >= MAX_NODES) {
    return { graph, nodeId: null }
  }
  if (branch === 'REJECT' && type !== 'REJECTED') return { graph, nodeId: null }
  if (branch !== 'REJECT' && type === 'REJECTED') return { graph, nodeId: null }
  const existing = outEdge(graph, sourceId, branch)
  const continueBranch = CONTINUE_BRANCH[type]
  if (existing && !continueBranch) return { graph, nodeId: null }

  let g = graph
  if (existing) g = shiftRight(g, new Set([existing.target, ...descendants(g, existing.target)]), COL)
  const pos = existing
    ? (() => {
        const t = nodeById(g, existing.target)!
        const tc = center(t)
        const size = NODE_SIZE[type]
        return { x: Math.round(tc.x - COL - size.w / 2), y: Math.round(tc.y - size.h / 2) }
      })()
    : slotAfter(g, source, branch, type)
  const node = blankNode(type, pos.x, pos.y, labels)
  const edges = g.edges.filter((e) => e !== existing)
  edges.push({ id: newId('e'), source: sourceId, target: node.id, branch })
  if (existing && continueBranch) {
    edges.push({ id: newId('e'), source: node.id, target: existing.target, branch: continueBranch })
  }
  return { graph: { ...g, nodes: [...g.nodes, node], edges }, nodeId: node.id }
}

/** "Thêm bước duyệt kèm điều kiện" từ Bắt đầu / bước duyệt: một điều kiện, nhánh ✓ là một bước mới. */
export function addConditionWithStep(
  graph: ProcessGraph,
  sourceId: string,
  labels: NewNodeLabels,
): { graph: ProcessGraph; nodeId: string | null } {
  const cond = addNodeAfter(graph, sourceId, 'NEXT', 'CONDITION', labels)
  if (!cond.nodeId) return cond
  // Điều kiện chèn vào giữa thì nhánh ✓ đã nối tới phần cũ phía sau — không thêm bước nữa.
  if (outEdge(cond.graph, cond.nodeId, 'YES')) return cond
  const step = addNodeAfter(cond.graph, cond.nodeId, 'YES', 'STEP', labels)
  return { graph: step.graph, nodeId: cond.nodeId }
}

export function updateNode(graph: ProcessGraph, id: string, patch: Partial<ProcessNode>): ProcessGraph {
  return { ...graph, nodes: graph.nodes.map((n) => (n.id === id ? { ...n, ...patch, id: n.id, type: n.type } : n)) }
}

export function moveNode(graph: ProcessGraph, id: string, x: number, y: number): ProcessGraph {
  return updateNode(graph, id, { x: Math.round(x), y: Math.round(y) })
}

export function removeEdge(graph: ProcessGraph, edgeId: string): ProcessGraph {
  return { ...graph, edges: graph.edges.filter((e) => e.id !== edgeId) }
}

/** "Xóa tất cả liên kết đến bước". */
export function removeIncomingEdges(graph: ProcessGraph, nodeId: string): ProcessGraph {
  return { ...graph, edges: graph.edges.filter((e) => e.target !== nodeId) }
}

/**
 * "Xóa bước nhưng không xóa phía sau": các liên kết vào node được nối thẳng tới node kế tiếp trên
 * nhánh chính của nó (bước: tiếp theo; điều kiện: nhánh ✓). Nhánh phụ (✗, không duyệt) tách ra,
 * vẫn nằm trên khung vẽ để nối lại.
 */
export function removeNodeKeepTail(graph: ProcessGraph, nodeId: string): ProcessGraph {
  const node = nodeById(graph, nodeId)
  if (!node || node.type === 'START') return graph
  const branch = CONTINUE_BRANCH[node.type]
  const successor = branch ? outEdge(graph, nodeId, branch)?.target : undefined
  const successorNode = successor ? nodeById(graph, successor) : undefined
  const edges: ProcessEdge[] = []
  for (const e of graph.edges) {
    if (e.source === nodeId) continue
    if (e.target !== nodeId) {
      edges.push(e)
      continue
    }
    if (!successorNode || successorNode.id === e.source) continue
    const okTarget = e.branch === 'REJECT' ? successorNode.type === 'REJECTED' : successorNode.type !== 'REJECTED'
    if (okTarget) edges.push({ ...e, target: successorNode.id })
  }
  return { ...graph, nodes: graph.nodes.filter((n) => n.id !== nodeId), edges }
}

/** "Xóa bước và toàn bộ phía sau": bỏ node cùng mọi node chỉ đi tới được qua nó. */
export function removeNodeAndTail(graph: ProcessGraph, nodeId: string): ProcessGraph {
  const node = nodeById(graph, nodeId)
  if (!node || node.type === 'START') return graph
  const stillReachable = reachableFromStart(graph, nodeId)
  const doomed = new Set([nodeId])
  for (const id of descendants(graph, nodeId)) {
    if (!stillReachable.has(id) && nodeById(graph, id)?.type !== 'START') doomed.add(id)
  }
  return {
    ...graph,
    nodes: graph.nodes.filter((n) => !doomed.has(n.id)),
    edges: graph.edges.filter((e) => !doomed.has(e.source) && !doomed.has(e.target)),
  }
}

/** Nối tay hai node có sẵn được không (kéo từ chấm nối của node nguồn). */
export function canConnect(graph: ProcessGraph, sourceId: string, targetId: string, branch: ProcessBranch): boolean {
  if (sourceId === targetId) return false
  const source = nodeById(graph, sourceId)
  const target = nodeById(graph, targetId)
  if (!source || !target || target.type === 'START') return false
  if (!BRANCHES_OF[source.type].includes(branch)) return false
  if (outEdge(graph, sourceId, branch)) return false
  if ((branch === 'REJECT') !== (target.type === 'REJECTED')) return false
  return !reaches(graph, targetId, sourceId)
}

export function connect(graph: ProcessGraph, sourceId: string, targetId: string, branch: ProcessBranch): ProcessGraph {
  if (!canConnect(graph, sourceId, targetId, branch)) return graph
  return { ...graph, edges: [...graph.edges, { id: newId('e'), source: sourceId, target: targetId, branch }] }
}

/** Sắp lại toàn bộ sơ đồ từ trái sang phải (dagre). */
export function autoLayout(graph: ProcessGraph): ProcessGraph {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 70, ranksep: 110, marginx: 0, marginy: 0 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const n of graph.nodes) {
    const s = NODE_SIZE[n.type]
    // Chừa chỗ cho nhãn chữ dưới / trên hình.
    g.setNode(n.id, { width: Math.max(s.w, 140), height: s.h + 40 })
  }
  // Nhánh ✓ / tiếp theo trước, ✗ / không duyệt sau — để nhánh chính nằm trên.
  const order: Record<ProcessBranch, number> = { NEXT: 0, YES: 0, NO: 1, REJECT: 2 }
  for (const e of [...graph.edges].sort((a, b) => order[a.branch] - order[b.branch])) g.setEdge(e.source, e.target)
  dagre.layout(g)
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      const p = g.node(n.id)
      if (!p) return n
      const s = NODE_SIZE[n.type]
      return { ...n, x: Math.round(p.x - s.w / 2), y: Math.round(p.y - s.h / 2) }
    }),
  }
}

// ── Kiểm ────────────────────────────────────────────────────────────────────

export interface GraphIssue {
  severity: 'error' | 'warning'
  /** Khớp hậu tố key backend `approvalProcess.graph.<key>`. */
  key: string
  nodeId?: string
  edgeId?: string
  args?: Record<string, unknown>
}

type FieldInfo = ApprovalProcessCatalog['fields'][number]

function ruleIssues(rule: ConditionRule, objectType: ApprovalObjectType | null, fields: Map<string, FieldInfo>): string | null {
  if (!rule.field || !rule.operator) return 'ruleIncomplete'
  const info = fields.get(rule.field)
  if (!info) return null
  if (objectType && !info.objects.includes(objectType)) return 'ruleFieldNotForObject'
  if (!info.operators.includes(rule.operator)) return 'ruleBadOperator'
  if (rule.operator === 'IS_TRUE' || rule.operator === 'IS_FALSE') return null
  const values = rule.values.filter((v) => v && v.trim())
  if (values.length === 0) return 'ruleMissingValue'
  if (info.valueType === 'NUMBER' && (values.length !== 1 || !Number.isFinite(Number(values[0])))) return 'ruleBadNumber'
  return null
}

/** Cùng bộ luật với `ProcessGraphValidator.java`. */
export function validateGraph(
  graph: ProcessGraph,
  objectType: ApprovalObjectType | null,
  catalog?: ApprovalProcessCatalog,
): GraphIssue[] {
  const issues: GraphIssue[] = []
  const err = (key: string, nodeId?: string, args?: Record<string, unknown>) =>
    issues.push({ severity: 'error', key, nodeId, args })
  const warn = (key: string, nodeId?: string) => issues.push({ severity: 'warning', key, nodeId })
  const fields = new Map((catalog?.fields ?? []).map((f) => [f.code as string, f]))

  if (graph.nodes.length === 0) {
    err('empty')
    return issues
  }
  if (graph.nodes.length > MAX_NODES) err('tooManyNodes', undefined, { max: MAX_NODES })
  if (graph.nodes.filter((n) => n.type === 'START').length !== 1) {
    err('startCount')
    return issues
  }
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))

  for (const n of graph.nodes) {
    const out = outgoing(graph, n.id)
    switch (n.type) {
      case 'START':
        if (out.length !== 1 || out[0]!.branch !== 'NEXT') err('startNeedsOneNext', n.id)
        break
      case 'CONDITION': {
        if (out.filter((e) => e.branch === 'YES').length !== 1) err('conditionNeedsYes', n.id)
        if (out.filter((e) => e.branch === 'NO').length !== 1) err('conditionNeedsNo', n.id)
        const rules = (n.groups ?? []).flatMap((g) => g.rules)
        if (rules.length === 0) err('conditionEmpty', n.id)
        else if ((n.groups ?? []).some((g) => g.rules.length === 0)) err('conditionEmptyGroup', n.id)
        const first = rules.map((r) => ruleIssues(r, objectType, fields)).find(Boolean)
        if (first) err(first, n.id)
        break
      }
      case 'STEP': {
        if (!n.name?.trim()) err('stepNoName', n.id)
        if (!n.approvers?.length) err('stepNoApprover', n.id)
        else if (n.approvers.some((a) => (a.type === 'USER' && !a.userId) || (a.type === 'ROLE' && !a.roleId)
          || (a.type === 'ORG_UNIT_HEAD' && !a.orgUnitId))) err('stepBadApprover', n.id)
        for (const e of out) {
          if (e.branch === 'REJECT' && byId.get(e.target)?.type !== 'REJECTED') err('rejectEdgeTarget', n.id)
        }
        if (!out.some((e) => e.branch === 'NEXT')) warn('stepImplicitApproved', n.id)
        break
      }
      case 'APPROVED':
      case 'REJECTED':
        if (out.length) err('endHasOutgoing', n.id)
        break
    }
    if (n.type === 'REJECTED' && incoming(graph, n.id).some((e) => e.branch !== 'REJECT')) err('rejectedOnlyFromStep', n.id)
    if (n.name && n.name.length > MAX_NAME) err('nameTooLong', n.id, { max: MAX_NAME })
  }

  if (!topologicalOrder(graph)) err('cycle')
  else if (approvedWithoutStep(graph)) err('approvedWithoutStep')

  const reach = reachableFromStart(graph)
  for (const n of graph.nodes) if (!reach.has(n.id)) warn('unreachable', n.id)
  // Bắt đầu chưa nối đi đâu thì lỗi đó đã nói đủ; không báo thêm "cần ít nhất một bước" cho cùng một việc.
  if (!graph.nodes.some((n) => n.type === 'STEP') && !issues.some((i) => i.key === 'startNeedsOneNext')) err('noStep')
  return issues
}

function approvedWithoutStep(graph: ProcessGraph): boolean {
  const start = graph.nodes.find((n) => n.type === 'START')
  if (!start) return false
  const seen = new Set<string>()
  const stack = [start.id]
  while (stack.length) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    const n = nodeById(graph, id)
    if (!n || n.type === 'STEP') continue
    if (n.type === 'APPROVED') return true
    for (const e of outgoing(graph, id)) stack.push(e.target)
  }
  return false
}
