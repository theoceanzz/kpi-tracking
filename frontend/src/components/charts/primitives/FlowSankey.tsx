import { Sankey, Tooltip, ResponsiveContainer, Layer, Rectangle } from 'recharts'
import { AXIS_COLORS, NEUTRAL_COLOR } from '../chartPalette'

export interface SankeyNodeDatum {
  name: string
  depth: number
  color?: string | null
}

export interface SankeyLinkDatum {
  source: number
  target: number
  value: number
  note?: string | null
}

interface Props {
  nodes: SankeyNodeDatum[]
  links: SankeyLinkDatum[]
  /** Đơn vị đo của độ dày dải, hiện trong tooltip. */
  valueLabel: string
  height?: number
}

/**
 * Sankey: dòng chảy giữa các nút, độ dày dải tỉ lệ với lượng chảy qua.
 *
 * <p>Dùng khi câu hỏi là "cái này đi đâu" chứ không phải "cái này lớn bao nhiêu". Một bảng đếm
 * theo trạng thái nói được có bao nhiêu KPI ở mỗi ô, nhưng không nói được ô nào là ngõ cụt và
 * bao nhiêu đã chảy tới đó.
 *
 * <p>Recharts nối nút bằng CHỈ SỐ mảng nên server dựng sẵn chỉ số; component này không tự đánh
 * số lại để tránh lệch.
 */
export default function FlowSankey({ nodes, links, valueLabel, height = 360 }: Props) {
  if (!nodes.length || !links.length) {
    return (
      <div className="w-full flex items-center justify-center text-sm text-slate-400 font-medium" style={{ height }}>
        Chưa có luồng nào trong phạm vi này
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Sankey
        data={{ nodes, links }}
        nodePadding={26}
        nodeWidth={12}
        margin={{ top: 12, right: 140, bottom: 12, left: 12 }}
        link={{ stroke: NEUTRAL_COLOR, strokeOpacity: 0.28 }}
        node={<SankeyNodeShape />}
      >
        <Tooltip content={<SankeyTooltip nodes={nodes} valueLabel={valueLabel} />} />
      </Sankey>
    </ResponsiveContainer>
  )
}

interface NodeShapeProps {
  x?: number
  y?: number
  width?: number
  height?: number
  index?: number
  payload?: SankeyNodeDatum & { value?: number }
  containerWidth?: number
}

function SankeyNodeShape({ x = 0, y = 0, width = 0, height = 0, payload, containerWidth = 0 }: NodeShapeProps) {
  if (!payload) return null
  // Nhãn nút ở rìa phải phải quay vào trong, không thì bị cắt mất khỏi khung.
  const nearRightEdge = x + width + 140 > containerWidth
  return (
    <Layer>
      <Rectangle
        x={x} y={y} width={width} height={height}
        fill={payload.color ?? '#6366f1'}
        fillOpacity={0.92}
        radius={2}
      />
      <text
        x={nearRightEdge ? x - 8 : x + width + 8}
        y={y + height / 2}
        textAnchor={nearRightEdge ? 'end' : 'start'}
        dominantBaseline="middle"
        fontSize={11}
        fontWeight={700}
        fill={AXIS_COLORS.tick}
      >
        {payload.name}
      </text>
    </Layer>
  )
}

function SankeyTooltip({ active, payload, nodes, valueLabel }: {
  active?: boolean
  payload?: { payload: Record<string, unknown> }[]
  nodes: SankeyNodeDatum[]
  valueLabel: string
}) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null

  // Recharts dùng cùng một tooltip cho cả nút và dải; phân biệt bằng sự có mặt của source/target.
  const source = p['source'] as { name?: string; depth?: number } | number | undefined
  const target = p['target'] as { name?: string; depth?: number } | number | undefined
  const value = Number(p['value'] ?? 0)

  const nameOf = (v: typeof source) =>
    typeof v === 'number' ? nodes[v]?.name ?? '' : v?.name ?? ''

  const isLink = source !== undefined && target !== undefined
  const note = p['note'] as string | undefined

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-lg">
      {isLink ? (
        <p className="font-bold text-slate-900 dark:text-white mb-1.5">
          {nameOf(source)} <span className="text-slate-400">→</span> {nameOf(target)}
        </p>
      ) : (
        <p className="font-bold text-slate-900 dark:text-white mb-1.5">{String(p['name'] ?? '')}</p>
      )}
      <p className="text-sm">
        <span className="text-slate-500 font-medium">{valueLabel}: </span>
        <span className="font-bold text-slate-900 dark:text-white tabular-nums">
          {Math.round(value * 10) / 10}
        </span>
      </p>
      {note && <p className="text-[11px] text-slate-400 font-medium mt-1">{note}</p>}
    </div>
  )
}
