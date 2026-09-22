import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { CheckCircle2 } from 'lucide-react'
import { END_NODE_HEIGHT, END_NODE_WIDTH } from './workflowGraphModel'

/** Nút kết thúc — chỉ để mắt thấy luồng có điểm dừng, không mang dữ liệu. */
function EndNodeImpl() {
  return (
    <div
      style={{ width: END_NODE_WIDTH, height: END_NODE_HEIGHT }}
      className="flex items-center gap-2.5 rounded-card border border-[var(--color-success-border)] bg-[var(--color-card)] px-3 shadow-sm"
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-2 !border-[var(--color-card)] !bg-[var(--color-success)]" />
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-card bg-[var(--color-success-bg)] text-[var(--color-success)]">
        <CheckCircle2 size={16} />
      </span>
      <span className="text-sm font-semibold text-[var(--color-foreground)]">Hoàn thành</span>
    </div>
  )
}

const EndNode = memo(EndNodeImpl)
export default EndNode
