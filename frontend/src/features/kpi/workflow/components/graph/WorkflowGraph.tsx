import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Background,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStore,
  type Edge,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import type { WorkflowStage, WorkflowStageCode } from '../../types'
import StageNode from './StageNode'
import EndNode from './EndNode'
import OrthogonalEdge from './OrthogonalEdge'
import { buildWorkflowGraph, columnsForWidth, MIN_COLUMNS, type WorkflowFlowNode } from './workflowGraphModel'

const nodeTypes: NodeTypes = { stage: StageNode, end: EndNode }
const edgeTypes: EdgeTypes = { orthogonal: OrthogonalEdge }

/**
 * Vừa lại khung nhìn mỗi khi canvas đổi cỡ, và báo số cột vừa với bề ngang mới.
 *
 * `fitView` trên `<ReactFlow>` chỉ chạy đúng một lần lúc khởi tạo. Bật toàn màn hình hay thu cửa
 * sổ là canvas đổi cỡ mà sơ đồ vẫn giữ zoom cũ, bị cắt mất một cột. Đọc kích thước đã đo từ store
 * của ReactFlow rồi vừa lại theo. Số cột cũng suy từ đúng bề ngang đó — không đo lại lần hai.
 */
function FitOnResize({ columns, onColumns }: { columns: number; onColumns: (columns: number) => void }) {
  const { fitView } = useReactFlow()
  const width = useStore(s => s.width)
  const height = useStore(s => s.height)

  useEffect(() => {
    if (width) onColumns(columnsForWidth(width))
  }, [width, onColumns])

  // Vừa lại theo cả `columns`, không chỉ theo kích thước: đổi cỡ làm số cột đổi, mà số cột đổi
  // thì sơ đồ mới có hình dạng mới — vừa theo hình dạng cũ là cắt mất một cột. Đợi một nhịp ngắn
  // để ReactFlow kịp nhận vị trí nút mới trước khi đo. KHÔNG đưa bản nháp vào deps: bật/tắt bước
  // không được làm khung nhìn nhúc nhích.
  useEffect(() => {
    if (!width || !height) return
    const id = window.setTimeout(() => void fitView({ padding: 0.12, duration: 200 }), 60)
    return () => window.clearTimeout(id)
  }, [width, height, columns, fitView])

  return null
}

interface Props {
  stages: WorkflowStage[]
  selected: WorkflowStageCode | null
  onSelect: (code: WorkflowStageCode | null) => void
  warnings: Partial<Record<WorkflowStageCode, string>>
  readOnly: boolean
  onToggle?: (code: WorkflowStageCode) => void
  /** Chiều cao/bo góc do chủ trang quyết — thường và toàn màn hình khác nhau. */
  className?: string
  /**
   * Lớp phủ nổi trên canvas (cảnh báo), giữa cạnh dưới. Là overlay để không bao giờ đẩy canvas đi.
   * Không đặt ở góc: góc trên-trái là thẻ đầu tiên, góc dưới-phải là bong bóng chat K.AI.
   */
  overlay?: ReactNode
}

/**
 * Canvas sơ đồ luồng.
 *
 * Nút không kéo được và không nối được: vị trí không lưu ở đâu cả, cho kéo chỉ tạo ra một trạng
 * thái biến mất khi tải lại. Pan/zoom vẫn giữ để xem sơ đồ dài trên màn hẹp.
 *
 * Chủ trang truyền chiều cao qua `className`, và phải là `calc(100vh-…)` hoặc `flex-1` trong một
 * khung có chiều cao xác định — KHÔNG `h-full` trần: canvas nằm trong trang Thiết lập công ty, mà
 * height:100% chỉ giải được khi MỌI tổ tiên có chiều cao xác định (cùng cái bẫy `OrgMindmapView`
 * đã ghi lại).
 */
export default function WorkflowGraph({ stages, selected, onSelect, warnings, readOnly, onToggle, className, overlay }: Props) {
  const isDark = useThemeStore(s => s.isDark)
  const [columns, setColumns] = useState(MIN_COLUMNS + 1)

  const built = useMemo(
    () => buildWorkflowGraph({ stages, columns, selected, warnings, readOnly, onToggle }),
    [stages, columns, selected, warnings, readOnly, onToggle],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowFlowNode>(built.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(built.edges)

  // Đồng bộ lại khi bản nháp đổi. Không đặt thẳng `nodes={built.nodes}` vì ReactFlow cần state
  // riêng để giữ được kích thước đã đo của từng nút giữa các lần render.
  useEffect(() => {
    setNodes(built.nodes)
    setEdges(built.edges)
  }, [built, setNodes, setEdges])

  return (
    <div className={cn('relative w-full overflow-hidden bg-[var(--color-muted)]', className)}>
      <style>{`
        .kpi-workflow-graph .react-flow__node { cursor: pointer; }
        .kpi-workflow-graph .react-flow__handle { pointer-events: none; }
        .kpi-workflow-graph .react-flow__attribution { display: none; }
        .kpi-workflow-graph .react-flow__controls { box-shadow: none; border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; }
        .kpi-workflow-graph .react-flow__controls-button { background: var(--color-card); border-bottom: 1px solid var(--color-border); fill: var(--color-foreground); }
        .kpi-workflow-graph .react-flow__controls-button:hover { background: var(--color-muted); }
      `}</style>
      <ReactFlow
        className="kpi-workflow-graph"
        colorMode={isDark ? 'dark' : 'light'}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onSelect(node.type === 'stage' ? (node.id as WorkflowStageCode) : null)}
        onPaneClick={() => onSelect(null)}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.3}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--color-border-strong)" gap={20} size={1} />
        <Controls showInteractive={false} />
        <FitOnResize columns={columns} onColumns={setColumns} />
      </ReactFlow>

      {overlay && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 max-w-xl -translate-x-1/2">
          {overlay}
        </div>
      )}
    </div>
  )
}
