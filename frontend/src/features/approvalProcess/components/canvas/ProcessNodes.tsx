import { memo, type ReactNode } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { AlertTriangle, Check, CircleCheck, Filter, Play, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NODE_SIZE } from '../../model/processGraphModel'
import type { ProcessNodeType } from '../../types'

export interface ProcessNodeData extends Record<string, unknown> {
  label: string
  /** Mã bước "1", "1.1"… (chỉ bước duyệt). */
  code?: string
  /** Bước / điều kiện đã cấu hình đủ (dấu ✓ nhỏ góc phải). */
  configured?: boolean
  hasError?: boolean
  /** Sơ đồ chỉ đọc trong đối tượng: node nằm ngoài đường đã đi thì mờ đi. */
  dimmed?: boolean
  /** Bước đang chờ duyệt. */
  current?: boolean
  readOnly?: boolean
}

export type ProcessFlowNode = Node<ProcessNodeData, ProcessNodeType>

const handleCls = '!h-2.5 !w-2.5 !border-2 !border-[var(--color-card)] !bg-[var(--color-border-strong)]'

/** Khung chung: hình có kích thước cố định, nhãn chữ nằm ngoài hình (trên hoặc dưới). */
const ERROR_RING = 'ring-2 ring-[var(--color-error)] ring-offset-2 ring-offset-[var(--color-muted)]'
const CURRENT_RING = 'ring-[3px] ring-[var(--color-primary)] ring-offset-2 ring-offset-[var(--color-muted)]'

function Shell({
  type, data, labelAbove, children, className, handles, ringInside,
}: {
  type: ProcessNodeType
  data: ProcessNodeData
  labelAbove?: boolean
  children: ReactNode
  className?: string
  handles: ReactNode
  /** Viền lỗi / bước đang chờ do hình bên trong tự vẽ (hình thoi), không vẽ trên khung vuông. */
  ringInside?: boolean
}) {
  const size = NODE_SIZE[type]
  return (
    <div
      style={{ width: size.w, height: size.h }}
      className={cn('relative', data.dimmed && 'opacity-40')}
      title={data.label}
    >
      {handles}
      <div
        data-shape={ringInside ? undefined : ''}
        className={cn(
          'flex h-full w-full items-center justify-center text-white shadow-sm transition-shadow',
          !ringInside && data.hasError && ERROR_RING,
          !ringInside && data.current && CURRENT_RING,
          className,
        )}
      >
        {children}
      </div>
      <span
        className={cn(
          'ap-label pointer-events-none absolute left-1/2 w-[150px] -translate-x-1/2 text-center text-xs font-medium leading-4 text-[var(--color-foreground)] line-clamp-2',
          labelAbove ? 'bottom-full mb-2' : 'top-full mt-3',
        )}
      >
        {data.label}
      </span>
    </div>
  )
}

function StartNodeImpl({ data }: NodeProps<ProcessFlowNode>) {
  return (
    <Shell
      type="START"
      data={data}
      className="rounded-full bg-[var(--color-warning-solid)]"
      handles={<Handle type="source" id="NEXT" position={Position.Right} className={handleCls} isConnectable={!data.readOnly} />}
    >
      <Play size={22} aria-hidden="true" className="ml-0.5" />
    </Shell>
  )
}

function ConditionNodeImpl({ data }: NodeProps<ProcessFlowNode>) {
  return (
    <Shell
      type="CONDITION"
      data={data}
      labelAbove
      // Hình thoi = hình vuông xoay 45°; icon xoay ngược lại để đứng thẳng.
      className="bg-transparent shadow-none"
      ringInside
      handles={
        <>
          <Handle type="target" id="in" position={Position.Left} className={handleCls} isConnectable={!data.readOnly} />
          <Handle type="source" id="YES" position={Position.Right} className={handleCls} isConnectable={!data.readOnly} />
          <Handle type="source" id="NO" position={Position.Bottom} className={handleCls} isConnectable={!data.readOnly} />
        </>
      }
    >
      <span
        data-shape=""
        className={cn(
          'flex h-[46px] w-[46px] rotate-45 items-center justify-center rounded-control bg-[var(--color-warning-solid)] shadow-sm',
          data.hasError && ERROR_RING,
          data.current && CURRENT_RING,
        )}
      >
        <Filter size={18} aria-hidden="true" className="-rotate-45" />
      </span>
    </Shell>
  )
}

function StepNodeImpl({ data }: NodeProps<ProcessFlowNode>) {
  return (
    <Shell
      type="STEP"
      data={data}
      className="rounded-card bg-[var(--color-success-solid)]"
      handles={
        <>
          <Handle type="target" id="in" position={Position.Left} className={handleCls} isConnectable={!data.readOnly} />
          <Handle type="source" id="NEXT" position={Position.Right} className={handleCls} isConnectable={!data.readOnly} />
          {/* "Không duyệt" ra ở cạnh phải phía dưới (chấm đỏ): ra ở cạnh dưới thì cạnh nối cắt ngang tên bước. */}
          <Handle type="source" id="REJECT" position={Position.Right} className={cn(handleCls, '!top-[82%] !bg-[var(--color-error)]')} isConnectable={!data.readOnly} />
        </>
      }
    >
      <CircleCheck size={28} strokeWidth={1.75} aria-hidden="true" />
      {data.code && (
        <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 rounded-control border border-[var(--color-success-border)] bg-[var(--color-card)] px-1.5 text-xs font-semibold leading-4 text-[var(--color-success)] tabular-nums">
          {data.code}
        </span>
      )}
      <span
        className={cn(
          'absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border bg-[var(--color-card)]',
          data.configured
            ? 'border-[var(--color-success-border)] text-[var(--color-success)]'
            : 'border-[var(--color-warning-border)] text-[var(--color-warning)]',
        )}
        aria-hidden="true"
      >
        {data.configured ? <Check size={10} strokeWidth={3} /> : <AlertTriangle size={9} strokeWidth={2.5} />}
      </span>
    </Shell>
  )
}

function ApprovedNodeImpl({ data }: NodeProps<ProcessFlowNode>) {
  return (
    <Shell
      type="APPROVED"
      data={data}
      className="rounded-full bg-[var(--color-info-solid)]"
      handles={<Handle type="target" id="in" position={Position.Left} className={handleCls} isConnectable={!data.readOnly} />}
    >
      <Check size={22} strokeWidth={2.5} aria-hidden="true" />
    </Shell>
  )
}

function RejectedNodeImpl({ data }: NodeProps<ProcessFlowNode>) {
  return (
    <Shell
      type="REJECTED"
      data={data}
      className="rounded-full bg-[var(--color-error-solid)]"
      handles={<Handle type="target" id="in" position={Position.Left} className={handleCls} isConnectable={!data.readOnly} />}
    >
      <X size={22} strokeWidth={2.5} aria-hidden="true" />
    </Shell>
  )
}

export const StartNode = memo(StartNodeImpl)
export const ConditionNode = memo(ConditionNodeImpl)
export const StepNode = memo(StepNodeImpl)
export const ApprovedNode = memo(ApprovedNodeImpl)
export const RejectedNode = memo(RejectedNodeImpl)
