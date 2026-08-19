import { useEffect, useMemo, useCallback, useState } from 'react'
import {
  ReactFlow, Controls, Background, useNodesState, useEdgesState,
  MarkerType, Handle, Position, type Node, type Edge, type NodeProps, type NodeTypes, type Connection,
} from '@xyflow/react'
import dagre from 'dagre'
import '@xyflow/react/dist/style.css'
import { useAuthStore } from '@/store/authStore'
import { useStrategyMap, useRelationMutations } from '../hooks/useBsc'
import { useObjectives } from '@/features/okr/hooks/useOkr'
import { Layers, Target, AlertTriangle, Lightbulb } from 'lucide-react'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import type { StrategyMapResponse } from '../types'

const NODE_W = 200
const NODE_H = 64

type Kind = 'perspective' | 'category' | 'objective' | 'kr' | 'kpi'
type NodeData = { label: string; sub?: string; color?: string; kind: Kind; mismatch?: boolean }
type AppNode = Node<NodeData>

function StrategyNode({ data }: NodeProps<AppNode>) {
  const color = data.color || '#6366f1'
  const base = 'rounded-2xl border shadow-sm px-4 py-2.5 text-left bg-white dark:bg-slate-900'
  if (data.kind === 'perspective') {
    return (
      <div className="rounded-2xl px-4 py-3 shadow-md text-white font-black" style={{ backgroundColor: color, width: NODE_W }}>
        <Handle type="source" position={Position.Right} className="!bg-white/70" />
        <div className="flex items-center gap-2"><Layers size={16} /> <span className="truncate">{data.label}</span></div>
      </div>
    )
  }
  if (data.kind === 'category') {
    return (
      <div className="rounded-2xl px-4 py-2.5 shadow-sm border-2 bg-white dark:bg-slate-900" style={{ width: NODE_W, borderColor: color }}>
        <Handle type="target" position={Position.Left} className="!bg-slate-400" />
        <Handle type="source" position={Position.Right} className="!bg-slate-400" />
        <div className="flex items-center gap-2" style={{ color }}><Layers size={14} className="shrink-0" /> <span className="text-[12px] font-black truncate">{data.label}</span></div>
      </div>
    )
  }
  return (
    <div className={base} style={{ width: NODE_W, borderColor: data.kind === 'objective' ? color : '#e2e8f0', borderLeftWidth: 4, borderLeftColor: color }}>
      <Handle type="target" position={Position.Left} className="!bg-slate-400" />
      <Handle type="source" position={Position.Right} className="!bg-slate-400" />
      <div className="flex items-center gap-1.5">
        {data.kind === 'objective' && <Target size={13} style={{ color }} className="shrink-0" />}
        {data.mismatch && <AlertTriangle size={12} className="text-amber-500 shrink-0" />}
        <span className={`text-[12px] font-black truncate ${data.kind === 'kpi' ? 'text-slate-700 dark:text-slate-200' : 'text-slate-900 dark:text-white'}`}>{data.label}</span>
      </div>
      {data.sub && <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5 truncate">{data.sub}</p>}
    </div>
  )
}

const nodeTypes: NodeTypes = { strategy: StrategyNode }

function layout(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 24, ranksep: 90 })
  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
  // Chỉ layout theo cạnh phân cấp (không tính cạnh nhân-quả để tránh xáo trộn thứ hạng)
  edges.filter(e => e.data?.hierarchy).forEach(e => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return nodes.map(n => {
    const p = g.node(n.id)
    return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 }, targetPosition: Position.Left, sourcePosition: Position.Right } as Node
  })
}

function buildGraph(map: StrategyMapResponse): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const objKind = new Map<string, boolean>() // id -> is objective

  const FIXED_ORDER = ['FINANCIAL', 'CUSTOMER', 'INTERNAL_PROCESS', 'LEARNING_GROWTH']
  type Lane = StrategyMapResponse['perspectives'][number]
  const byFixed = new Map<string, { name: string; color?: string; lanes: Lane[] }>()
  map.perspectives.forEach(lane => {
    const key = lane.fixedPerspective || 'INTERNAL_PROCESS'
    if (!byFixed.has(key)) byFixed.set(key, { name: lane.fixedPerspectiveName || key, color: lane.fixedPerspectiveColor, lanes: [] })
    byFixed.get(key)!.lanes.push(lane)
  })

  FIXED_ORDER.filter(k => byFixed.has(k)).forEach(fkey => {
    const grp = byFixed.get(fkey)!
    const fid = `fp:${fkey}`
    nodes.push({ id: fid, type: 'strategy', position: { x: 0, y: 0 }, data: { label: grp.name, kind: 'perspective', color: grp.color } })

    grp.lanes.forEach(lane => {
      const pid = `p:${lane.perspectiveId}`
      nodes.push({ id: pid, type: 'strategy', position: { x: 0, y: 0 }, data: { label: lane.name, kind: 'category', color: lane.color || grp.color } })
      edges.push({ id: `${fid}-${pid}`, source: fid, target: pid, data: { hierarchy: true }, style: { stroke: grp.color || lane.color, strokeWidth: 1.5 } })

      lane.objectives.forEach(obj => {
        const oid = `o:${obj.id}`
        objKind.set(obj.id, true)
        nodes.push({ id: oid, type: 'strategy', position: { x: 0, y: 0 }, data: { label: obj.name, sub: obj.code, kind: 'objective', color: lane.color || grp.color } })
        edges.push({ id: `${pid}-${oid}`, source: pid, target: oid, data: { hierarchy: true }, style: { stroke: lane.color || grp.color, strokeWidth: 1.5 } })
        obj.keyResults.forEach(kr => {
          const kid = `k:${kr.id}`
          nodes.push({ id: kid, type: 'strategy', position: { x: 0, y: 0 }, data: { label: kr.name, sub: 'KR', kind: 'kr', color: lane.color || grp.color } })
          edges.push({ id: `${oid}-${kid}`, source: oid, target: kid, data: { hierarchy: true }, style: { stroke: '#cbd5e1', strokeWidth: 1.5 } })
          kr.kpis.forEach(kpi => {
            const kpid = `kpi:${kpi.id}`
            nodes.push({ id: kpid, type: 'strategy', position: { x: 0, y: 0 }, data: { label: kpi.name, sub: 'KPI', kind: 'kpi', color: lane.color || grp.color, mismatch: kpi.perspectiveMismatch } })
            edges.push({ id: `${kid}-${kpid}`, source: kid, target: kpid, data: { hierarchy: true }, style: { stroke: '#e2e8f0', strokeWidth: 1.5 } })
          })
        })
      })
      // KPI gán trực tiếp hạng mục (không qua OKR)
      map.directKpis.filter(k => k.perspectiveId === lane.perspectiveId).forEach(kpi => {
        const kpid = `kpi:${kpi.id}`
        nodes.push({ id: kpid, type: 'strategy', position: { x: 0, y: 0 }, data: { label: kpi.name, sub: 'KPI trực tiếp', kind: 'kpi', color: lane.color || grp.color } })
        edges.push({ id: `${pid}-${kpid}`, source: pid, target: kpid, data: { hierarchy: true }, style: { stroke: lane.color || grp.color, strokeWidth: 1.5, strokeDasharray: '4 3' } })
      })
    })
  })

  // Cạnh nhân-quả giữa Objective (nét đứt đỏ, có nhãn, xoá được)
  map.relations.forEach(rel => {
    edges.push({
      id: `rel:${rel.id}`,
      source: `o:${rel.sourceObjectiveId}`,
      target: `o:${rel.targetObjectiveId}`,
      label: rel.label || 'nhân-quả',
      animated: true,
      data: { relation: true, relationId: rel.id },
      style: { stroke: '#f43f5e', strokeWidth: 2 },
      labelStyle: { fontSize: 10, fontWeight: 700, fill: '#f43f5e' },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#f43f5e' },
    })
  })

  return { nodes: layout(nodes, edges), edges }
}

export default function BscStrategyMapPage() {
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: map, isLoading } = useStrategyMap(organizationId)
  const { createRelation, deleteRelation } = useRelationMutations()

  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const graph = useMemo(() => map ? buildGraph(map) : { nodes: [], edges: [] }, [map])

  // Quan hệ nhân-quả nối 2 Mục tiêu ⇒ dưới 2 Mục tiêu thì không thể vẽ được cạnh nào.
  const objectiveCount = useMemo(
    () => (map?.perspectives || []).reduce((sum, lane) => sum + lane.objectives.length, 0),
    [map]
  )
  const relationCount = map?.relations?.length ?? 0

  // Objective CHƯA gán hạng mục bị BscStrategyMapService loại khỏi bản đồ (không thuộc làn nào).
  // Đếm riêng để nói đúng việc cần làm là "gán hạng mục", không phải "tạo thêm Mục tiêu".
  const { data: allObjectives } = useObjectives(organizationId)
  const unassignedCount = Math.max((allObjectives?.length ?? 0) - objectiveCount, 0)
  useEffect(() => {
    setNodes(graph.nodes as AppNode[])
    setEdges(graph.edges)
  }, [graph, setNodes, setEdges])

  // Nối 2 Objective ⇒ tạo quan hệ nhân-quả
  const onConnect = useCallback((c: Connection) => {
    if (!organizationId || !c.source || !c.target) return
    if (!c.source.startsWith('o:') || !c.target.startsWith('o:')) {
      toast.error('Chỉ được nối quan hệ nhân-quả giữa hai Mục tiêu (Objective)')
      return
    }
    createRelation.mutate({
      organizationId,
      data: { sourceObjectiveId: c.source.slice(2), targetObjectiveId: c.target.slice(2) },
    })
  }, [organizationId, createRelation])

  // Click cạnh nhân-quả ⇒ mở hộp xác nhận (cạnh phân cấp không xoá được nên bỏ qua)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; from: string; to: string } | null>(null)

  const onEdgeClick = useCallback((_: any, edge: Edge) => {
    if (!edge.data?.relation || !edge.data?.relationId) return
    const nameOf = (nodeId: string) => nodes.find(n => n.id === nodeId)?.data.label || 'Mục tiêu'
    setPendingDelete({
      id: edge.data.relationId as string,
      from: nameOf(edge.source),
      to: nameOf(edge.target),
    })
  }, [nodes])

  return (
    // h-full + flex-col: trang lấp đúng chiều cao <main> (đã trừ header & padding của AppLayout)
    // nên không sinh thanh cuộn dọc; canvas bên dưới hút phần cao còn lại.
    <div className="max-w-full flex flex-col gap-4">
      <WorkspaceHeader
        className="shrink-0"
        description="Viễn cảnh → Hạng mục → Mục tiêu → Kết quả then chốt → KPI, và quan hệ nhân-quả giữa các mục tiêu."
        actions={
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-[var(--color-muted-foreground)]">
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-slate-300" /> Phân cấp</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 border-t-2 border-dashed border-rose-500" /> Nhân-quả</span>
            <span className="flex items-center gap-1.5"><AlertTriangle size={12} className="text-amber-500" /> Lệch hạng mục</span>
          </div>
        }
      />

      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 overflow-hidden h-[calc(100vh-320px)] min-h-[420px]">
        {isLoading ? (
          <div className="h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
        ) : (
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} onEdgeClick={onEdgeClick}
            nodeTypes={nodeTypes} fitView minZoom={0.2}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} className="!bg-transparent" />
            <Controls showInteractive={false} />
          </ReactFlow>
        )}
      </div>
      {!isLoading && (objectiveCount < 2 ? (
        // Chưa đủ 2 Mục tiêu ⇒ không thể vẽ cạnh nào, nói rõ để khỏi tưởng bấm đường nào cũng xóa được.
        <div className="shrink-0 flex items-start gap-2.5 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10 px-4 py-2.5">
          <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
            Cần ít nhất <b className="font-black">2 Mục tiêu</b> trên bản đồ để vẽ quan hệ nhân-quả — hiện có <b className="font-black">{objectiveCount}</b>.
            {unassignedCount > 0 ? (
              <> Bạn đang có <b className="font-black">{unassignedCount} Mục tiêu chưa gán hạng mục</b> nên <b className="font-black">không hiện ở đây</b>. Vào <b className="font-black">Quản lý OKR</b> → sửa Mục tiêu → chọn <b className="font-black">Hạng mục BSC</b>, chúng sẽ xuất hiện ngay.</>
            ) : (
              <> Hãy tạo thêm Mục tiêu ở trang <b className="font-black">Quản lý OKR</b> và nhớ gán <b className="font-black">Hạng mục BSC</b> — chưa gán hạng mục thì Mục tiêu không lên bản đồ.</>
            )}
          </p>
        </div>
      ) : (
        <div className="shrink-0 flex items-start gap-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5">
          <Lightbulb size={14} className="text-indigo-500 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
            Kéo từ <b className="font-black text-slate-900 dark:text-white">chấm tròn mép phải của một Mục tiêu</b> sang <b className="font-black text-slate-900 dark:text-white">một Mục tiêu khác</b> để tạo quan hệ nhân-quả (VD: Học hỏi → Quy trình → Khách hàng → Tài chính).{' '}
            {relationCount > 0 ? (
              <>Bấm vào <b className="font-black text-rose-600 dark:text-rose-400">cạnh nhân-quả màu đỏ có mũi tên</b> để xóa — <b className="font-black text-slate-900 dark:text-white">cạnh phân cấp màu xám không xóa được</b>.</>
            ) : (
              <>Chỉ nối được giữa <b className="font-black text-slate-900 dark:text-white">hai Mục tiêu</b> — kéo vào <b className="font-black text-slate-900 dark:text-white">KR hoặc KPI</b> sẽ báo lỗi.</>
            )}
            {unassignedCount > 0 && (
              <> <span className="text-amber-600 dark:text-amber-400">Còn <b className="font-black">{unassignedCount} Mục tiêu chưa gán hạng mục</b> nên chưa hiện trên bản đồ — gán hạng mục ở Quản lý OKR để đưa lên.</span></>
            )}
          </p>
        </div>
      ))}

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return
          deleteRelation.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) })
        }}
        title="Xóa quan hệ nhân-quả"
        description={pendingDelete
          ? `Xóa liên kết nhân-quả "${pendingDelete.from}" → "${pendingDelete.to}"? Chỉ quan hệ này bị gỡ, hai Mục tiêu vẫn giữ nguyên.`
          : ''}
        confirmLabel="Xóa ngay"
        loading={deleteRelation.isPending}
      />
    </div>
  )
}
