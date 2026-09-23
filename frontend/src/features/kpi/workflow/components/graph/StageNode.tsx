import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { AlertTriangle, Check, Lock, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { stageIcon, STAGE_ACTORS } from '../../workflowStageIcons'
import {
  NODE_HEADER_HEIGHT,
  NODE_WIDTH,
  OUTCOME_PADDING,
  OUTCOME_ROW_HEIGHT,
  outcomeHandleTop,
  type StageFlowNode,
} from './workflowGraphModel'

/**
 * Thẻ một bước trên sơ đồ.
 *
 * Kích thước cố định (xem hằng ở `workflowGraphModel`) vì hai lý do: lưới cần biết trước để xếp,
 * và handle của từng dòng kết quả đặt bằng toạ độ tuyệt đối theo chỉ số dòng.
 *
 * Công tắc nằm ngay trên thẻ để bật/tắt không cần mở bảng chi tiết; `nodrag nopan` +
 * `stopPropagation` để ReactFlow không nuốt cú bấm thành chọn nút.
 */
function StageNodeImpl({ data }: NodeProps<StageFlowNode>) {
  const { stage, outcomes, selected, warning, readOnly, onToggle } = data
  const off = !stage.enabled

  return (
    <div
      title={warning}
      style={{ width: NODE_WIDTH }}
      className={cn(
        'rounded-card border bg-[var(--color-card)] text-left shadow-sm transition-[box-shadow,border-color,opacity]',
        selected
          ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20'
          : warning
            ? 'border-[var(--color-warning)] ring-2 ring-[var(--color-warning)]/20'
            : 'border-[var(--color-border)]',
        off && 'border-dashed opacity-55',
      )}
    >
      {/* Vào chính: cạnh trái. Vào từ cạnh trên: đường quay lui và nhánh phụ — để đường vòng
          không cắt qua xương sống. */}
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-2 !border-[var(--color-card)] !bg-[var(--color-border-strong)]" />
      <Handle type="target" position={Position.Top} id="top" className="!h-2 !w-2 !border-2 !border-[var(--color-card)] !bg-[var(--color-border-strong)]" />

      <div className="flex items-center gap-3 px-3" style={{ height: NODE_HEADER_HEIGHT }}>
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-card',
            off ? 'bg-[var(--color-muted)] text-[var(--color-subtle-foreground)]' : 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
          )}
        >
          {stageIcon(stage.code, 18)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-[var(--color-foreground)]">{stage.label}</p>
            {warning && <AlertTriangle size={13} className="shrink-0 text-[var(--color-warning)]" />}
          </div>
          <p className="truncate text-xs font-medium text-[var(--color-muted-foreground)]">
            {off ? 'Đã tắt' : STAGE_ACTORS[stage.code]}
          </p>
        </div>

        {!readOnly && (
          <span
            className="nodrag nopan shrink-0"
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            title={stage.required ? 'Bước lõi của luồng, không thể tắt' : stage.enabled ? 'Tắt bước này' : 'Bật bước này'}
          >
            {stage.required ? (
              <Lock size={14} className="text-[var(--color-subtle-foreground)]" />
            ) : (
              <Switch size="sm" checked={stage.enabled} onCheckedChange={() => onToggle?.(stage.code)} />
            )}
          </span>
        )}
      </div>

      {outcomes.length > 0 && (
        <div className="border-t border-[var(--color-border)]" style={{ padding: OUTCOME_PADDING }}>
          {outcomes.map((o, i) => (
            <div
              key={o.id}
              style={{ height: OUTCOME_ROW_HEIGHT }}
              className={cn(
                'flex items-center gap-2 rounded-control px-3 text-[13px] font-semibold',
                o.tone === 'ok'
                  ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                  : 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
                i > 0 && 'mt-1',
              )}
            >
              {o.tone === 'ok' ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
              {o.label}
              {/* Handle của kết quả này: ra ở mép phải, ngang hàng với dòng. `backTo: null` thì
                  không có cạnh nào xuất phát nên cũng không cần handle. */}
              {o.backTo !== null && (
                <Handle
                  type="source"
                  position={Position.Right}
                  id={o.id}
                  style={{ top: outcomeHandleTop(i) }}
                  className={cn(
                    '!h-2 !w-2 !border-2 !border-[var(--color-card)]',
                    o.tone === 'ok' ? '!bg-[var(--color-success)]' : '!bg-[var(--color-danger)]',
                  )}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ra chính (bước không có quyết định) và ra nhánh phụ ở cạnh dưới. */}
      {outcomes.length === 0 && (
        <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-2 !border-[var(--color-card)] !bg-[var(--color-border-strong)]" />
      )}
      <Handle type="source" position={Position.Bottom} id="side" className="!h-2 !w-2 !border-2 !border-[var(--color-card)] !bg-[var(--color-border-strong)]" />
    </div>
  )
}

const StageNode = memo(StageNodeImpl)
export default StageNode
