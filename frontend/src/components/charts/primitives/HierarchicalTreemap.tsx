import { useState } from 'react'
import { achievementSurface, textOn } from '../chartPalette'
import { labelOnFill } from '../axisLabel'

export type KpiRelation = 'DECOMPOSITION' | 'DELEGATION' | null

export interface TreeNode {
  id?: string
  name: string
  /** Trọng số. Nút có con thì diện tích lấy TỔNG các con, không lấy giá trị này. */
  value: number
  /** 0..100+, quyết định màu. Null = chưa có kết quả. */
  achievement?: number | null
  /** Đơn vị sở hữu KPI — quan trọng vì cây bắc ngang nhiều đơn vị. */
  unitName?: string
  /** Quan hệ với CHA. Null = nút gốc. */
  relation?: KpiRelation
  children?: TreeNode[]
}

interface Props {
  nodes: TreeNode[]
  height?: number
  onSelect?: (n: TreeNode) => void
}

// ── Hằng bố cục ─────────────────────────────────────────────────────────────
const HEADER_H = 26
const PAD = 5
/** Dưới cỡ này thì vẽ con vào chỉ ra những vệt màu không đọc được — dừng đệ quy, để tooltip kể. */
const MIN_NEST_W = 64
const MIN_NEST_H = 46

interface Rect { x: number; y: number; w: number; h: number }

/** Diện tích của một nút: nút cha lấy tổng con để diện tích vẽ ra khớp với thứ nó chứa. */
function nodeValue(n: TreeNode): number {
  const kids = n.children ?? []
  if (kids.length === 0) return Math.max(n.value, 0)
  return kids.reduce((s, c) => s + nodeValue(c), 0)
}

/**
 * Tỉ lệ cạnh tệ nhất của một hàng đang xét — tiêu chí dừng của thuật toán squarified.
 * Ô càng gần vuông càng dễ so diện tích bằng mắt; ô dẹt dài thì gần như không so được.
 */
function worstRatio(areas: number[], from: number, to: number, sum: number, side: number): number {
  let max = -Infinity
  let min = Infinity
  for (let k = from; k < to; k++) {
    const v = areas[k]!
    if (v > max) max = v
    if (v < min) min = v
  }
  if (min <= 0 || sum <= 0 || side <= 0) return Infinity
  const s2 = side * side
  const sum2 = sum * sum
  return Math.max((s2 * max) / sum2, sum2 / (s2 * min))
}

/**
 * Squarified treemap (Bruls–Huizing–van Wijk): chia hình chữ nhật thành các ô có diện tích tỉ lệ
 * với giá trị, ưu tiên ô gần vuông.
 *
 * <p>Trả mảng cùng thứ tự với `values` (thuật toán cần sắp giảm dần nên phải nhớ chỉ số gốc).
 * Mọi nhánh suy biến — tổng bằng 0, khung rỗng — đều trả về ô chia đều thay vì để phép chia cho 0
 * sinh ra `NaN`: toạ độ `NaN` làm SVG không vẽ gì, trông y hệt lỗi "không có dữ liệu".
 */
function squarify(values: number[], rect: Rect): Rect[] {
  const n = values.length
  const out: Rect[] = new Array(n)
  if (n === 0) return out

  const total = values.reduce((s, v) => s + Math.max(v, 0), 0)
  if (total <= 0 || rect.w <= 0 || rect.h <= 0) {
    const h = rect.h / n
    for (let i = 0; i < n; i++) out[i] = { x: rect.x, y: rect.y + h * i, w: rect.w, h }
    return out
  }

  const scale = (rect.w * rect.h) / total
  // EPS để ô trọng số 0 vẫn có một vệt mỏng thay vì làm `worstRatio` ra Infinity ngay từ đầu.
  const EPS = 1e-6
  const order = values
    .map((v, i) => ({ area: Math.max(v, 0) * scale + EPS, i }))
    .sort((a, b) => b.area - a.area)
  const areas = order.map(o => o.area)

  let free: Rect = { ...rect }
  let pos = 0
  while (pos < n) {
    const side = Math.min(free.w, free.h)
    let rowSum = 0
    let end = pos
    let best = Infinity
    while (end < n) {
      const nextSum = rowSum + areas[end]!
      const w = worstRatio(areas, pos, end + 1, nextSum, side)
      if (w > best) break
      best = w
      rowSum = nextSum
      end += 1
    }
    if (end === pos) end = pos + 1 // luôn tiến ít nhất một ô, tránh vòng lặp vô hạn

    const alongHeight = free.w >= free.h
    const thickness = rowSum / (side || 1)
    let offset = 0
    for (let k = pos; k < end; k++) {
      const len = areas[k]! / (thickness || 1)
      out[order[k]!.i] = alongHeight
        ? { x: free.x, y: free.y + offset, w: thickness, h: len }
        : { x: free.x + offset, y: free.y, w: len, h: thickness }
      offset += len
    }
    free = alongHeight
      ? { x: free.x + thickness, y: free.y, w: free.w - thickness, h: free.h }
      : { x: free.x, y: free.y + thickness, w: free.w, h: free.h - thickness }
    pos = end
  }
  return out
}

interface Cell {
  node: TreeNode
  rect: Rect
  depth: number
  /** true = nút này chứa con được vẽ bên trong, nên chỉ vẽ khung + dải tiêu đề. */
  container: boolean
}

function flatten(nodes: TreeNode[], rect: Rect, depth: number, out: Cell[]): void {
  const rects = squarify(nodes.map(nodeValue), rect)
  nodes.forEach((node, i) => {
    const r = rects[i]!
    const kids = node.children ?? []
    const canNest = kids.length > 0
      && r.w >= MIN_NEST_W
      && r.h >= MIN_NEST_H + HEADER_H
    out.push({ node, rect: r, depth, container: canNest })
    if (canNest) {
      flatten(kids, {
        x: r.x + PAD,
        y: r.y + HEADER_H,
        w: r.w - PAD * 2,
        h: r.h - HEADER_H - PAD,
      }, depth + 1, out)
    }
  })
}

/** Viền nói ra quan hệ với cha; màu nền đã dành cho tiến độ nên không dùng được vào việc này. */
function strokeFor(relation: KpiRelation, hovered: boolean) {
  if (hovered) return { stroke: '#0f172a', strokeWidth: 2.5, strokeDasharray: undefined }
  if (relation === 'DELEGATION') {
    // Nét đứt = KPI này KHÔNG nằm ở đơn vị của cha, nó được giao xuống nơi khác.
    return { stroke: '#0f172a', strokeWidth: 1.5, strokeDasharray: '5 3' }
  }
  if (relation === 'DECOMPOSITION') return { stroke: '#0f172a', strokeWidth: 1.5, strokeDasharray: undefined }
  return { stroke: '#0f172a', strokeWidth: 2, strokeDasharray: undefined }
}

/**
 * Treemap PHÂN CẤP: ô con nằm lồng trong ô cha, diện tích tỉ lệ trọng số.
 *
 * <p>Không dùng `Treemap` của Recharts được: nó chỉ có `type: 'flat' | 'nest'` mà `nest` là chế độ
 * khoan xuống từng tầng kèm breadcrumb, không phải hình chữ nhật lồng nhau — và ô con luôn lấp kín
 * ô cha nên nhãn nút cha chắc chắn bị đè. Vì thế bố cục ở đây tự cài bằng squarified.
 *
 * <p>Đọc được cây là điểm chính: một KPI có cha KHÔNG phải một khoản phân bổ độc lập, nó là một lát
 * cắt của cha. Vẽ phẳng ra sẽ mất hẳn điều đó, và người xem tưởng sáu KPI ở sáu đơn vị là sáu việc
 * rời rạc trong khi chúng là một mục tiêu được chia xuống.
 */
export default function HierarchicalTreemap({ nodes, height = 300, onSelect }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [tip, setTip] = useState<{ node: TreeNode; x: number; y: number } | null>(null)
  // Toạ độ trong hệ viewBox cố định rồi để SVG tự co giãn — khỏi phải đo DOM bằng ResizeObserver.
  const VW = 1000
  const VH = Math.max(height, 120)

  if (nodes.length === 0) {
    return (
      <div className="w-full flex items-center justify-center text-sm text-slate-400 font-medium" style={{ height }}>
        Chưa có dữ liệu để vẽ
      </div>
    )
  }

  const cells: Cell[] = []
  flatten(nodes, { x: 1, y: 1, w: VW - 2, h: VH - 2 }, 0, cells)

  return (
    <div className="w-full relative" style={{ height }}>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="none"
        className="w-full h-full"
        onMouseLeave={() => { setHoveredId(null); setTip(null) }}
      >
        {cells.map((c, i) => (
          <CellShape
            key={c.node.id ?? `${c.depth}-${i}`}
            cell={c}
            hovered={!!c.node.id && hoveredId === c.node.id}
            clickable={!!(onSelect && c.node.id)}
            onEnter={(e) => {
              setHoveredId(c.node.id ?? null)
              const box = (e.currentTarget.ownerSVGElement ?? e.currentTarget).getBoundingClientRect()
              setTip({ node: c.node, x: e.clientX - box.left, y: e.clientY - box.top })
            }}
            onClick={() => { if (onSelect && c.node.id) onSelect(c.node) }}
          />
        ))}
      </svg>

      {tip && <NodeTooltip node={tip.node} x={tip.x} y={tip.y} clickable={!!onSelect} />}
    </div>
  )
}

function CellShape({ cell, hovered, clickable, onEnter, onClick }: {
  cell: Cell
  hovered: boolean
  clickable: boolean
  onEnter: (e: React.MouseEvent<SVGGElement>) => void
  onClick: () => void
}) {
  const { node, rect, container } = cell
  const bg = achievementSurface(node.achievement)
  const fg = textOn(bg)
  const s = strokeFor(node.relation ?? null, hovered)

  // Nút chứa con: chỉ tô nhạt để ô con bên trong nổi lên, chữ vì thế phải là chữ tối trên nền nhạt.
  const fill = container ? bg : bg
  const fillOpacity = container ? 0.16 : 1
  const headerFg = container ? '#0f172a' : fg

  const showLabel = rect.w > 58 && rect.h > 22
  const showPct = !container && rect.h > 40 && node.achievement != null
  const maxChars = Math.floor(rect.w / 7.2)
  const name = node.name.length > maxChars ? `${node.name.slice(0, Math.max(maxChars - 1, 1))}…` : node.name

  return (
    <g
      onMouseEnter={onEnter}
      onMouseMove={onEnter}
      onClick={onClick}
      style={{ cursor: clickable ? 'pointer' : undefined }}
    >
      <rect
        x={rect.x} y={rect.y} width={Math.max(rect.w, 0)} height={Math.max(rect.h, 0)}
        rx={4}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={s.stroke}
        strokeWidth={s.strokeWidth}
        strokeDasharray={s.strokeDasharray}
        strokeOpacity={container ? 0.55 : 0.25}
      />
      {showLabel && (
        <>
          <text
            x={rect.x + 7} y={rect.y + 16}
            fontSize={12} fontWeight={800} {...labelOnFill(headerFg)}
          >
            {node.relation === 'DELEGATION' ? '↳ ' : ''}{name}
          </text>
          {rect.h > 30 && node.unitName && (
            <text
              x={rect.x + 7} y={rect.y + 29}
              fontSize={10} fontWeight={600} fill={headerFg} fillOpacity={0.72}
            >
              {node.unitName.length > maxChars ? `${node.unitName.slice(0, Math.max(maxChars - 1, 1))}…` : node.unitName}
            </text>
          )}
          {showPct && (
            <text
              x={rect.x + 7} y={rect.y + (node.unitName ? 46 : 33)}
              fontSize={14} fontWeight={900} {...labelOnFill(fg)}
            >
              {Math.round(node.achievement!)}%
            </text>
          )}
        </>
      )}
      {hovered && clickable && rect.w > 46 && rect.h > 36 && (
        <g pointerEvents="none">
          <circle cx={rect.x + rect.w - 15} cy={rect.y + 15} r={9} fill="#fff" fillOpacity={0.95} />
          <path
            d={`M${rect.x + rect.w - 18.5} ${rect.y + 18.5} L${rect.x + rect.w - 11.5} ${rect.y + 11.5} M${rect.x + rect.w - 15.5} ${rect.y + 11.5} L${rect.x + rect.w - 11.5} ${rect.y + 11.5} L${rect.x + rect.w - 11.5} ${rect.y + 15.5}`}
            stroke="#0f172a" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none"
          />
        </g>
      )}
    </g>
  )
}

const RELATION_LABEL: Record<string, string> = {
  DECOMPOSITION: 'KPI con (phân rã)',
  DELEGATION: 'KPI thác nước (giao xuống)',
}

function NodeTooltip({ node, x, y, clickable }: {
  node: TreeNode
  x: number
  y: number
  clickable: boolean
}) {
  const kids = node.children ?? []
  const value = nodeValue(node)
  return (
    <div
      className="absolute z-20 pointer-events-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-lg max-w-[280px]"
      style={{ left: Math.max(x + 12, 4), top: Math.max(y + 12, 4) }}
    >
      <p className="font-bold text-slate-900 dark:text-white break-words">{node.name}</p>
      {node.unitName && <p className="text-xs text-slate-500 mb-2">{node.unitName}</p>}
      <div className="space-y-1 text-sm">
        <Row label="Trọng số" value={String(Math.round(value * 10) / 10)} />
        {node.achievement != null && (
          <Row
            label="Tiến độ"
            value={`${Math.round(node.achievement)}%`}
            color={achievementSurface(node.achievement)}
          />
        )}
        {kids.length > 0 && <Row label="Chia xuống" value={`${kids.length} KPI con`} />}
        {node.relation && <Row label="Quan hệ" value={RELATION_LABEL[node.relation] ?? node.relation} />}
      </div>
      {clickable && node.id && (
        <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800">
          Bấm để xem chi tiết →
        </p>
      )}
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-3">
      {color && <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />}
      <span className="text-slate-500 font-medium min-w-[80px]">{label}:</span>
      <span className="font-bold text-slate-900 dark:text-white tabular-nums">{value}</span>
    </div>
  )
}
