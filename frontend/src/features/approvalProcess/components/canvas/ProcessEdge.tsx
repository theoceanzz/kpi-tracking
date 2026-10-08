import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type Edge, type EdgeProps } from '@xyflow/react'
import { Check, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProcessBranch } from '../../types'

export interface ProcessEdgeData extends Record<string, unknown> {
  branch: ProcessBranch
  /** Sơ đồ trong đối tượng: cạnh thuộc đường đã đi. */
  highlighted?: boolean
  dimmed?: boolean
  onDelete?: () => void
  deleteLabel?: string
}

export type ProcessFlowEdge = Edge<ProcessEdgeData, 'process'>

/**
 * Cạnh vuông góc bo tròn. Nhánh ✓ / ✗ của điều kiện có dấu ngay sau điểm rời điều kiện (như
 * 1Office); cạnh "không duyệt" nét đứt đỏ. Chọn một cạnh thì hiện nút xoá giữa cạnh.
 */
function ProcessEdgeImpl({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, selected,
}: EdgeProps<ProcessFlowEdge>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 10, offset: 24,
  })
  const branch = data?.branch ?? 'NEXT'
  const reject = branch === 'REJECT'

  // Dấu nhánh đặt sát điểm rời điều kiện: ✓ phía trên đường ngang, ✗ bên trái đường dọc.
  const marker = branch === 'YES'
    ? { x: sourceX + 22, y: sourceY - 14 }
    : branch === 'NO'
      ? { x: sourceX - 16, y: sourceY + 20 }
      : null

  // Màu nét đặt qua `style`: BaseEdge gắn className thẳng lên <path>, nên selector `[&>path]` không
  // bao giờ khớp và cạnh cứ xám mặc định.
  const stroke = selected || data?.highlighted
    ? 'var(--color-primary)'
    : reject ? 'var(--color-error)' : 'var(--color-muted-foreground)'

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke,
          strokeWidth: data?.highlighted || selected ? 2.25 : 1.5,
          strokeDasharray: reject ? '5 4' : undefined,
          opacity: data?.dimmed ? 0.3 : 1,
        }}
        className={reject ? 'ap-edge ap-edge-reject' : 'ap-edge'}
        interactionWidth={18}
      />
      <EdgeLabelRenderer>
        {marker && (
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute flex items-center justify-center',
              branch === 'YES' ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]',
              data?.dimmed && 'opacity-30',
            )}
            style={{ transform: `translate(-50%, -50%) translate(${marker.x}px, ${marker.y}px)` }}
          >
            {branch === 'YES' ? <Check size={18} strokeWidth={3} /> : <X size={18} strokeWidth={3} />}
          </span>
        )}
        {selected && data?.onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); data.onDelete?.() }}
            aria-label={data.deleteLabel}
            title={data.deleteLabel}
            className="nodrag nopan pointer-events-auto absolute flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-error-border)] bg-[var(--color-card)] text-[var(--color-error)] shadow-sm hover:bg-[var(--color-error-bg)]"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            <Trash2 size={12} aria-hidden="true" />
          </button>
        )}
      </EdgeLabelRenderer>
    </>
  )
}

const ProcessEdge = memo(ProcessEdgeImpl)
export default ProcessEdge
