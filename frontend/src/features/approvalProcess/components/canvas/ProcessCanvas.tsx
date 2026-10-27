import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  CheckCircle2, GitBranch, LayoutGrid, Link2Off, ListPlus, Maximize2, Minimize2, Plus, Redo2, Scan,
  Settings2, Trash2, Undo2, XCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useThemeStore } from '@/store/themeStore'
import {
  NODE_SIZE,
  addConditionWithStep,
  addNodeAfter,
  autoLayout,
  canConnect,
  connect,
  moveNode,
  outEdge,
  removeEdge,
  removeIncomingEdges,
  removeNodeAndTail,
  removeNodeKeepTail,
  type GraphIssue,
} from '../../model/processGraphModel'
import type { ProcessBranch, ProcessGraph, ProcessNode } from '../../types'
import NodeMenu, { type MenuEntry } from './NodeMenu'
import {
  ApprovedNode, ConditionNode, RejectedNode, StartNode, StepNode, type ProcessFlowNode,
} from './ProcessNodes'
import ProcessEdge, { type ProcessFlowEdge } from './ProcessEdge'

const processNodeTypes = {
  START: StartNode,
  CONDITION: ConditionNode,
  STEP: StepNode,
  APPROVED: ApprovedNode,
  REJECTED: RejectedNode,
}
const processEdgeTypes = { process: ProcessEdge }

export interface ProcessCanvasEditing {
  /** Thay đổi rời rạc (thêm / xoá / nối) — ghi một bước hoàn tác. */
  onChange: (graph: ProcessGraph) => void
  /** Kéo node: bắt đầu → cập nhật liên tục → kết thúc ghi một bước. */
  onDragBegin: () => void
  onDragMove: (graph: ProcessGraph) => void
  onDragEnd: () => void
  onEditNode: (nodeId: string) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}

interface Props {
  graph: ProcessGraph
  stepCodes: Record<string, string>
  issues?: GraphIssue[]
  /** Không có = chỉ xem. */
  editing?: ProcessCanvasEditing
  /** Sơ đồ trong đối tượng: tô đường đã đi, đánh dấu bước đang chờ. */
  highlight?: { pathNodeIds: string[]; currentNodeId?: string | null }
  /**
   * Node cần đưa vào giữa khung nhìn (bấm một dòng trong danh sách lỗi). `seq` đổi mỗi lần bấm, để
   * bấm lại đúng node đó vẫn đưa về và nháy viền.
   */
  focusRequest?: { nodeId: string; seq: number } | null
  toolbarExtra?: ReactNode
  /** Chiều cao do chủ trang quyết: `h-[calc(100vh-…)]` hoặc `flex-1`, không `h-full` trần. */
  className?: string
  allowFullscreen?: boolean
}

/**
 * Phản hồi con trỏ (chỉ ở chế độ sửa — `.ap-editable`): viền ôm đúng hình node (tròn / vuông / thoi
 * nhờ `[data-shape]`), không phóng to / nhấc lên (DESIGN_SYSTEM §8).
 *  - rê chuột: viền primary nhạt, tên node đổi màu primary;
 *  - đang bấm / kéo, đang mở menu của node (`.ap-active`), focus bằng bàn phím: viền primary đậm;
 *  - cạnh nối: rê chuột thì đậm lên (cạnh thường chuyển primary, cạnh "không duyệt" giữ màu đỏ);
 *  - chấm nối: rê chuột thì tô primary kèm quầng, kéo tới đích hợp lệ thì xanh.
 * Màu nét của cạnh đặt bằng `style` nội tuyến nên luật hover phải `!important`.
 */
const STYLE = `
  .approval-process-canvas .react-flow__attribution { display: none; }
  .approval-process-canvas .react-flow__controls { box-shadow: none; border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; }
  .approval-process-canvas .react-flow__controls-button { background: var(--color-card); border-bottom: 1px solid var(--color-border); fill: var(--color-foreground); }
  .approval-process-canvas .react-flow__controls-button:hover { background: var(--color-muted); }
  .approval-process-canvas [data-shape] { transition: box-shadow 150ms, filter 150ms; }
  .approval-process-canvas .ap-label { transition: color 150ms; }

  .approval-process-canvas.ap-editable .react-flow__node { cursor: pointer; }
  .approval-process-canvas.ap-editable .react-flow__node:hover [data-shape] {
    box-shadow: 0 0 0 3px var(--color-muted), 0 0 0 5px color-mix(in srgb, var(--color-primary) 45%, transparent);
    filter: brightness(1.06);
  }
  .approval-process-canvas.ap-editable .react-flow__node:hover .ap-label { color: var(--color-primary); }
  .approval-process-canvas.ap-editable .react-flow__node:active [data-shape],
  .approval-process-canvas.ap-editable .react-flow__node:focus-visible [data-shape],
  .approval-process-canvas .react-flow__node.ap-active [data-shape],
  .approval-process-canvas .react-flow__node.ap-flash [data-shape] {
    box-shadow: 0 0 0 3px var(--color-muted), 0 0 0 6px var(--color-primary);
    filter: none;
  }
  .approval-process-canvas.ap-editable .react-flow__node:active [data-shape] { filter: brightness(0.94); }
  .approval-process-canvas .react-flow__node.ap-active .ap-label { color: var(--color-primary); }
  .approval-process-canvas.ap-editable .react-flow__node:focus-visible { outline: none; }

  .approval-process-canvas.ap-editable .react-flow__edge { cursor: pointer; }
  .approval-process-canvas.ap-editable .react-flow__edge:hover .ap-edge { stroke-width: 2.5px !important; }
  .approval-process-canvas.ap-editable .react-flow__edge:hover .ap-edge:not(.ap-edge-reject) { stroke: var(--color-primary) !important; }

  .approval-process-canvas.ap-editable .react-flow__handle { transition: background-color 150ms, box-shadow 150ms; cursor: crosshair; }
  .approval-process-canvas.ap-editable .react-flow__handle:hover {
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary) 30%, transparent);
  }
  .approval-process-canvas.ap-editable .react-flow__handle:not([data-handleid="REJECT"]):hover { background: var(--color-primary) !important; }
  .approval-process-canvas.ap-editable .react-flow__handle.connectingto.valid { background: var(--color-success) !important; }
`

function isEditableTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null
  if (!node) return false
  return node.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName)
}

function FocusOnNode({ graph, request }: { graph: ProcessGraph; request?: { nodeId: string; seq: number } | null }) {
  const { setCenter, getZoom } = useReactFlow()
  useEffect(() => {
    if (!request) return
    const n = graph.nodes.find((x) => x.id === request.nodeId)
    if (!n) return
    const s = NODE_SIZE[n.type]
    void setCenter(n.x + s.w / 2, n.y + s.h / 2, { zoom: Math.max(getZoom(), 1), duration: 300 })
    // Nháy viền node trong chốc lát để mắt bắt được chỗ cần sửa (lớp CSS đặt thẳng lên DOM của node).
    const el = document.querySelector(`.approval-process-canvas .react-flow__node[data-id="${CSS.escape(request.nodeId)}"]`)
    el?.classList.add('ap-flash')
    const t = window.setTimeout(() => el?.classList.remove('ap-flash'), 1600)
    return () => { window.clearTimeout(t); el?.classList.remove('ap-flash') }
    // Chỉ chạy khi người dùng bấm một dòng lỗi; sơ đồ đổi không được kéo khung nhìn đi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.seq])
  return null
}

function Toolbar({
  editing, fullscreen, onFullscreen, allowFullscreen, extra, onAutoLayout,
}: {
  editing?: ProcessCanvasEditing
  fullscreen: boolean
  onFullscreen: () => void
  allowFullscreen: boolean
  extra?: ReactNode
  onAutoLayout: () => void
}) {
  const { t } = useTranslation('approvalProcess')
  const { fitView } = useReactFlow()
  return (
    <Panel position="top-left" className="!m-3 flex flex-wrap items-center gap-1 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-1 shadow-sm">
      {editing && (
        <>
          <Button variant="ghost" size="icon-sm" onClick={editing.onUndo} disabled={!editing.canUndo}
                  aria-label={t('canvas.undo')} title={t('canvas.undoShortcut')}>
            <Undo2 aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={editing.onRedo} disabled={!editing.canRedo}
                  aria-label={t('canvas.redo')} title={t('canvas.redoShortcut')}>
            <Redo2 aria-hidden="true" />
          </Button>
          <span className="mx-0.5 h-5 w-px bg-[var(--color-border)]" aria-hidden="true" />
          <Button variant="ghost" size="sm" onClick={onAutoLayout} title={t('canvas.autoLayoutHint')}>
            <LayoutGrid aria-hidden="true" /> {t('canvas.autoLayout')}
          </Button>
        </>
      )}
      <Button variant="ghost" size="icon-sm" onClick={() => void fitView({ padding: 0.2, duration: 200 })}
              aria-label={t('canvas.fitView')} title={t('canvas.fitView')}>
        <Scan aria-hidden="true" />
      </Button>
      {allowFullscreen && (
        <Button variant="ghost" size="icon-sm" onClick={onFullscreen}
                aria-label={fullscreen ? t('canvas.exitFullscreen') : t('canvas.fullscreen')}
                title={fullscreen ? t('canvas.exitFullscreen') : t('canvas.fullscreen')}>
          {fullscreen ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
        </Button>
      )}
      {extra}
    </Panel>
  )
}

function CanvasInner({
  graph, stepCodes, issues = [], editing, highlight, focusRequest, toolbarExtra, className, allowFullscreen = true,
}: Props) {
  const { t } = useTranslation('approvalProcess')
  const isDark = useThemeStore((s) => s.isDark)
  const { fitView } = useReactFlow()
  const [menu, setMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null)
  const menuNodeId = menu?.nodeId ?? null
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const readOnly = !editing

  const labels = useMemo(() => ({ step: t('canvas.defaultStepName'), condition: t('canvas.defaultConditionName') }), [t])
  const errorNodes = useMemo(
    () => new Set(issues.filter((i) => i.severity === 'error' && i.nodeId).map((i) => i.nodeId!)),
    [issues],
  )
  const path = useMemo(() => (highlight ? highlight.pathNodeIds : null), [highlight])
  const currentNodeId = highlight?.currentNodeId ?? null

  const labelOf = useCallback((n: ProcessNode): string => {
    switch (n.type) {
      case 'START': return t('canvas.start')
      case 'APPROVED': return t('canvas.approved')
      case 'REJECTED': return t('canvas.rejected')
      case 'CONDITION': return n.name?.trim() || t('canvas.defaultConditionName')
      case 'STEP': return n.name?.trim() || t('canvas.defaultStepName')
    }
  }, [t])

  const nodes = useMemo<ProcessFlowNode[]>(() => graph.nodes.map((n) => {
    const size = NODE_SIZE[n.type]
    return {
      id: n.id,
      type: n.type,
      position: { x: n.x, y: n.y },
      width: size.w,
      height: size.h,
      measured: { width: size.w, height: size.h },
      deletable: false,
      draggable: !readOnly,
      // Node đang mở menu giữ viền primary cho tới khi menu đóng — người dùng biết menu thuộc node nào.
      className: menuNodeId === n.id ? 'ap-active' : undefined,
      data: {
        label: labelOf(n),
        code: stepCodes[n.id],
        configured: n.type === 'STEP' && !!n.name?.trim() && !!n.approvers?.length && !errorNodes.has(n.id),
        hasError: errorNodes.has(n.id),
        dimmed: path ? !path.includes(n.id) : false,
        current: !!currentNodeId && currentNodeId === n.id,
        readOnly,
      },
    }
  }), [graph.nodes, stepCodes, errorNodes, path, currentNodeId, readOnly, labelOf, menuNodeId])

  const edges = useMemo<ProcessFlowEdge[]>(() => graph.edges.map((e) => {
    const onPath = path ? path.indexOf(e.target) === path.indexOf(e.source) + 1 && path.includes(e.source) : false
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.branch,
      targetHandle: 'in',
      type: 'process',
      selected: e.id === selectedEdge,
      deletable: !readOnly,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: onPath ? 'var(--color-primary)' : e.branch === 'REJECT' ? 'var(--color-error)' : 'var(--color-muted-foreground)',
      },
      data: {
        branch: e.branch,
        highlighted: onPath,
        dimmed: path ? !onPath : false,
        onDelete: readOnly ? undefined : () => { editing?.onChange(removeEdge(graph, e.id)); setSelectedEdge(null) },
        deleteLabel: t('canvas.deleteLink'),
      },
    }
  }), [graph, path, selectedEdge, readOnly, editing, t])

  // ── Kéo node ──
  const onNodesChange = useCallback((changes: NodeChange<ProcessFlowNode>[]) => {
    if (!editing) return
    let next = graph
    for (const c of changes) {
      if (c.type === 'position' && c.position) next = moveNode(next, c.id, c.position.x, c.position.y)
    }
    if (next !== graph) editing.onDragMove(next)
  }, [editing, graph])

  const onEdgesChange = useCallback((changes: EdgeChange<ProcessFlowEdge>[]) => {
    for (const c of changes) {
      if (c.type === 'select') setSelectedEdge(c.selected ? c.id : null)
      if (c.type === 'remove' && editing) {
        editing.onChange(removeEdge(graph, c.id))
        setSelectedEdge(null)
      }
    }
  }, [editing, graph])

  const onConnect = useCallback((c: Connection) => {
    if (!editing || !c.sourceHandle) return
    editing.onChange(connect(graph, c.source, c.target, c.sourceHandle as ProcessBranch))
  }, [editing, graph])

  const isValidConnection = useCallback(
    (c: Connection | ProcessFlowEdge) =>
      !!c.sourceHandle && canConnect(graph, c.source, c.target, c.sourceHandle as ProcessBranch),
    [graph],
  )

  // ── Phím tắt hoàn tác ──
  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isEditableTarget(e.target)) return
      if (document.querySelector('[role="dialog"]')) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); editing.onUndo() }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); editing.onRedo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) setFullscreen(false) }
    window.addEventListener('keydown', onKey)
    const id = window.setTimeout(() => void fitView({ padding: 0.2, duration: 200 }), 60)
    return () => { window.removeEventListener('keydown', onKey); window.clearTimeout(id) }
  }, [fullscreen, fitView])

  // ── Menu ngữ cảnh ──
  const apply = useCallback((next: ProcessGraph) => editing?.onChange(next), [editing])
  const add = useCallback((sourceId: string, branch: ProcessBranch, type: ProcessNode['type']) => {
    const r = addNodeAfter(graph, sourceId, branch, type, labels)
    if (r.nodeId) apply(r.graph)
  }, [graph, labels, apply])
  const addWithCondition = useCallback((sourceId: string) => {
    const r = addConditionWithStep(graph, sourceId, labels)
    if (r.nodeId) apply(r.graph)
  }, [graph, labels, apply])

  const menuItems = useMemo<MenuEntry[]>(() => {
    if (!menu || !editing) return []
    const n = graph.nodes.find((x) => x.id === menu.nodeId)
    if (!n) return []
    const deletes: MenuEntry[] = [
      { kind: 'item', key: 'unlink', label: t('canvas.removeIncomingLinks'), icon: <Link2Off />, onSelect: () => apply(removeIncomingEdges(graph, n.id)), disabled: !graph.edges.some((e) => e.target === n.id) },
      { kind: 'item', key: 'del-keep', label: t('canvas.deleteKeepFollowing'), icon: <Trash2 />, danger: true, onSelect: () => apply(removeNodeKeepTail(graph, n.id)) },
      { kind: 'item', key: 'del-all', label: t('canvas.deleteWithFollowing'), icon: <Trash2 />, danger: true, onSelect: () => apply(removeNodeAndTail(graph, n.id)) },
    ]
    const branchItems = (branch: ProcessBranch): MenuEntry[] => {
      const taken = !!outEdge(graph, n.id, branch)
      return [
        { kind: 'item', key: 'step', label: t('canvas.addStep'), icon: <Plus />, onSelect: () => add(n.id, branch, 'STEP') },
        { kind: 'item', key: 'cond', label: t('canvas.addCondition'), icon: <GitBranch />, onSelect: () => add(n.id, branch, 'CONDITION') },
        { kind: 'item', key: 'ok', label: t('canvas.toApproved'), icon: <CheckCircle2 />, onSelect: () => add(n.id, branch, 'APPROVED'), disabled: taken },
      ]
    }
    switch (n.type) {
      case 'START':
        return [{
          kind: 'submenu', key: 'add', label: t('canvas.addStep'), icon: <ListPlus />, items: [
            { kind: 'item', key: 'with', label: t('canvas.withCondition'), icon: <GitBranch />, onSelect: () => addWithCondition(n.id) },
            { kind: 'item', key: 'without', label: t('canvas.withoutCondition'), icon: <Plus />, onSelect: () => add(n.id, 'NEXT', 'STEP') },
          ],
        }]
      case 'CONDITION':
        return [
          ...deletes,
          { kind: 'separator', key: 's1' },
          { kind: 'submenu', key: 'yes', label: t('canvas.ifMet'), icon: <CheckCircle2 />, items: branchItems('YES') },
          { kind: 'submenu', key: 'no', label: t('canvas.ifNotMet'), icon: <XCircle />, items: branchItems('NO') },
          { kind: 'item', key: 'settings', label: t('canvas.conditionSettings'), icon: <Settings2 />, onSelect: () => editing.onEditNode(n.id) },
        ]
      case 'STEP': {
        const hasNext = !!outEdge(graph, n.id, 'NEXT')
        return [
          { kind: 'item', key: 'cond', label: t('canvas.addApprovalCondition'), icon: <GitBranch />, onSelect: () => addWithCondition(n.id) },
          { kind: 'item', key: 'step', label: t('canvas.addStep'), icon: <Plus />, onSelect: () => add(n.id, 'NEXT', 'STEP') },
          { kind: 'item', key: 'ok', label: t('canvas.addApprovedState'), icon: <CheckCircle2 />, onSelect: () => add(n.id, 'NEXT', 'APPROVED'), disabled: hasNext },
          { kind: 'item', key: 'no', label: t('canvas.addRejectedState'), icon: <XCircle />, onSelect: () => add(n.id, 'REJECT', 'REJECTED'), disabled: !!outEdge(graph, n.id, 'REJECT') },
          { kind: 'separator', key: 's1' },
          ...deletes,
          { kind: 'separator', key: 's2' },
          { kind: 'item', key: 'settings', label: t('canvas.stepSettings'), icon: <Settings2 />, onSelect: () => editing.onEditNode(n.id) },
        ]
      }
      case 'APPROVED':
      case 'REJECTED':
        return [
          { kind: 'item', key: 'unlink', label: t('canvas.removeIncomingLinks'), icon: <Link2Off />, onSelect: () => apply(removeIncomingEdges(graph, n.id)), disabled: !graph.edges.some((e) => e.target === n.id) },
          { kind: 'item', key: 'del', label: t('canvas.deleteState'), icon: <Trash2 />, danger: true, onSelect: () => apply(removeNodeKeepTail(graph, n.id)) },
        ]
    }
  }, [menu, editing, graph, t, apply, add, addWithCondition])

  const openMenu = (e: React.MouseEvent, node: ProcessFlowNode) => {
    if (!editing) return
    e.preventDefault()
    setSelectedEdge(null)
    setMenu({ nodeId: node.id, x: e.clientX, y: e.clientY })
  }

  return (
    <div
      className={cn(
        'approval-process-canvas relative w-full overflow-hidden bg-[var(--color-muted)]',
        !readOnly && 'ap-editable',
        fullscreen ? 'fixed inset-0 z-[900] h-auto rounded-none' : className,
      )}
    >
      <style>{STYLE}</style>
      <ReactFlow<ProcessFlowNode, ProcessFlowEdge>
        colorMode={isDark ? 'dark' : 'light'}
        nodes={nodes}
        edges={edges}
        nodeTypes={processNodeTypes}
        edgeTypes={processEdgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={() => editing?.onDragBegin()}
        onNodeDragStop={() => editing?.onDragEnd()}
        onNodeClick={openMenu}
        onNodeContextMenu={openMenu}
        onNodeDoubleClick={(_, node) => {
          if (editing && (node.type === 'STEP' || node.type === 'CONDITION')) { setMenu(null); editing.onEditNode(node.id) }
        }}
        onPaneClick={() => { setMenu(null); setSelectedEdge(null) }}
        onMoveStart={() => setMenu(null)}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        nodesConnectable={!readOnly}
        nodesDraggable={!readOnly}
        elementsSelectable={!readOnly}
        edgesFocusable={!readOnly}
        deleteKeyCode={readOnly ? null : ['Delete', 'Backspace']}
        snapToGrid
        snapGrid={[10, 10]}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1.1 }}
        minZoom={0.25}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Lines} color="var(--color-border)" gap={20} />
        <Controls showInteractive={false} position="bottom-left" />
        <Toolbar
          editing={editing}
          fullscreen={fullscreen}
          onFullscreen={() => setFullscreen((v) => !v)}
          allowFullscreen={allowFullscreen}
          extra={toolbarExtra}
          onAutoLayout={() => {
            apply(autoLayout(graph))
            window.setTimeout(() => void fitView({ padding: 0.25, duration: 250 }), 60)
          }}
        />
        <FocusOnNode graph={graph} request={focusRequest} />
        {editing && graph.nodes.length === 1 && (
          <Panel position="bottom-center" className="!mb-6">
            <p className="flex items-center gap-2 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm shadow-sm">
              <ListPlus size={16} aria-hidden="true" className="shrink-0 text-[var(--color-primary)]" />
              {t('editor.emptyCanvasHint')}
            </p>
          </Panel>
        )}
      </ReactFlow>
      {menu && menuItems.length > 0 && (
        <NodeMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}
    </div>
  )
}

/** Khung vẽ quy trình duyệt — dùng cho cả màn sửa và sơ đồ chỉ đọc trong đối tượng. */
export default function ProcessCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
