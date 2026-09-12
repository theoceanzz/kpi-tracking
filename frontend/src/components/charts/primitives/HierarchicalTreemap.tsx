import { useLayoutEffect, useRef, useState } from 'react'
import {
  achievementSurface, textOn,
  RELATION_STROKE, KPI_KIND_COLORS, KPI_KIND_LABELS, type KpiKind,
} from '../chartPalette'
import { labelOnFill } from '../axisLabel'
import { AssigneeAvatars, type AssigneeBrief } from './AssigneeAvatars'

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

  // ── Nhận diện loại KPI. Tất cả đều tuỳ chọn: nơi gọi cũ không truyền thì vẽ y như trước. ──
  isBonus?: boolean
  isQualitative?: boolean
  isReverse?: boolean
  isShared?: boolean
  /** Tên KPI CŨ mà nút này thay thế. Có giá trị ⇒ đây là một KPI thay thế. */
  replacedKpiName?: string | null
  replacementReason?: string | null
  /** Số liệu thô cho tooltip — chỗ bù lại những gì bảng chi tiết từng hiện. */
  targetValue?: number | null
  actualValue?: number | null
  unit?: string | null
  periodName?: string | null
  /** Người đảm nhiệm — hiện thành dãy avatar trong tooltip. */
  assignees?: AssigneeBrief[]
}

/** Loại KPI của một nút, theo đúng thứ tự vẽ chấm. */
function kindsOf(n: TreeNode): KpiKind[] {
  const out: KpiKind[] = []
  if (n.isBonus) out.push('bonus')
  if (n.isQualitative) out.push('qualitative')
  if (n.isReverse) out.push('reverse')
  if (n.isShared) out.push('shared')
  if (n.replacedKpiName) out.push('replaced')
  return out
}

interface Props {
  nodes: TreeNode[]
  height?: number
  onSelect?: (n: TreeNode) => void
}

// ── Hằng bố cục ─────────────────────────────────────────────────────────────
// Dải tiêu đề của ô cha, phải chứa HẾT cả tên KPI lẫn tên đơn vị.
//
// Trước đây là 26 trong khi tên đơn vị vẽ ở baseline y+36 — tức nằm NGOÀI dải, đè thẳng lên
// những ô con bên dưới. Con số này phải bám theo `UNIT_BASELINE` cộng phần chân chữ.
const HEADER_H = 46
const PAD = 5
/** Dưới cỡ này thì vẽ con vào chỉ ra những vệt màu không đọc được — dừng đệ quy, để tooltip kể. */
const MIN_NEST_W = 64
const MIN_NEST_H = 46
/** Cạnh con chip loại KPI, và số chip tối đa trước khi cắt (tooltip vẫn kể đủ). */
const KIND_DOT = 9
const MAX_KIND_DOTS = 4
/** Cỡ chữ, tính bằng pixel thật. */
const NAME_SIZE = 15
const UNIT_SIZE = 12
const PCT_SIZE = 18

// Vị trí chân chữ của ba dòng trong ô.
//
// Khoảng cách giữa tên KPI và tên đơn vị phải LỚN HƠN cỡ chữ, nếu không hai dòng dính vào nhau:
// bản trước để 13px cho chữ 13px nên chỉ còn ~2px hở giữa chân chữ dòng trên và đầu chữ dòng dưới.
const NAME_BASELINE = 19
const UNIT_BASELINE = 38
const PCT_BASELINE_WITH_UNIT = 60
const PCT_BASELINE_ALONE = 42

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

/**
 * Viền nói ra quan hệ với cha; màu nền đã dành cho tiến độ nên không dùng được vào việc này.
 *
 * <p>Màu lấy từ `RELATION_STROKE` để khớp huy hiệu `KpiTypeTags` — trước đây cả hai quan hệ đều vẽ
 * đen tuyền, chỉ khác liền/đứt, mà trên ô lá lại vẽ ở 25% độ đục nên gần như vô hình.
 *
 * <p>Thác nước giữ CẢ màu LẪN nét đứt: mã hoá dư thừa để người không phân biệt được màu vẫn đọc ra.
 */
function strokeFor(relation: KpiRelation, hovered: boolean) {
  if (hovered) return { stroke: '#0f172a', strokeWidth: 2.5, dash: undefined, opacity: 1 }
  if (relation === 'DELEGATION') {
    // Nét đứt = KPI này KHÔNG nằm ở đơn vị của cha, nó được giao xuống nơi khác.
    return { stroke: RELATION_STROKE.DELEGATION, strokeWidth: 2, dash: '5 3', opacity: 0.9 }
  }
  if (relation === 'DECOMPOSITION') {
    return { stroke: RELATION_STROKE.DECOMPOSITION, strokeWidth: 2, dash: undefined, opacity: 0.9 }
  }
  return { stroke: '#0f172a', strokeWidth: 2, dash: undefined, opacity: 0.55 }
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

  // Bề rộng THẬT tính bằng pixel, đo từ DOM.
  //
  // Bản trước khoá viewBox ở 1000 rồi `preserveAspectRatio="none"` cho SVG tự kéo giãn — tiện,
  // nhưng nó bóp méo mọi thứ theo phương ngang, kể cả chữ: khung rộng 700px thì mỗi chữ cái bị
  // nén còn 70% bề ngang, khung 1400px thì bị kéo bè ra. Đặt viewBox đúng bằng số pixel thật thì
  // tỉ lệ luôn là 1:1 nên chữ không bao giờ méo nữa.
  const wrapRef = useRef<HTMLDivElement>(null)
  const [vw, setVw] = useState(1000)
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    // Đo ngay trong layout effect (trước lượt vẽ) nên không có khung hình nào bị sai tỉ lệ.
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width)
      if (w > 0) setVw(prev => (prev === w ? prev : w))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const VW = Math.max(vw, 120)
  const VH = Math.max(height, 120)

  const cells: Cell[] = []
  if (nodes.length > 0) flatten(nodes, { x: 1, y: 1, w: VW - 2, h: VH - 2 }, 0, cells)

  return (
    // Ref phải nằm ở nút LUÔN được render — nếu chỉ gắn khi có dữ liệu thì lúc dữ liệu về,
    // effect đo đã chạy xong từ lượt trước và không bao giờ chạy lại.
    <div ref={wrapRef} className="w-full relative" style={{ height }}>
      {nodes.length === 0 ? (
        <div className="w-full h-full flex items-center justify-center text-sm text-[var(--color-subtle-foreground)] font-medium">
          Chưa có dữ liệu để vẽ
        </div>
      ) : (
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
      )}

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

  // Mỗi dòng chỉ vẽ khi ô còn đủ chỗ cho chân chữ của chính nó — suy từ hằng vị trí ở trên
  // thay vì gõ tay những con số rời, để đổi cỡ chữ không làm chữ bị cắt ngang.
  const showLabel = rect.w > 58 && rect.h > NAME_BASELINE + 6
  const showUnit = !!node.unitName && rect.h > UNIT_BASELINE + 6
  const pctBaseline = showUnit ? PCT_BASELINE_WITH_UNIT : PCT_BASELINE_ALONE
  const showPct = !container && node.achievement != null && rect.h > pctBaseline + 6
  // Chấm loại KPI treo ở đáy ô. Ngưỡng phải đủ cao để nó không đè lên dòng phần trăm ở trên;
  // ô thấp hơn thì bỏ hẳn — tooltip luôn liệt kê đủ bằng chữ.
  const kinds = kindsOf(node)
  const showKinds = kinds.length > 0 && rect.w > 70 && rect.h > pctBaseline + KIND_DOT + 20
  // Mọi con số ở đây giờ là PIXEL THẬT (viewBox khớp bề rộng đo được), nên bề rộng một chữ cái
  // tính thẳng từ cỡ chữ: chữ đậm sans trung bình rộng khoảng 0,57 lần cỡ chữ.
  const fit = (text: string, fontSize: number, reserved = 0) => {
    const max = Math.floor((rect.w - 14) / (fontSize * 0.57)) - reserved
    return text.length > max ? `${text.slice(0, Math.max(max - 1, 1))}…` : text
  }
  // Tiền tố ↳ chiếm chỗ thật, phải trừ vào trước khi cắt — nếu không tên bị tràn ra ngoài ô.
  const prefix = node.relation === 'DELEGATION' ? '↳ ' : ''
  const name = fit(node.name, NAME_SIZE, prefix.length)

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
        strokeDasharray={s.dash}
        strokeOpacity={s.opacity}
      />
      {showLabel && (
        <>
          <text
            x={rect.x + 7} y={rect.y + NAME_BASELINE}
            fontSize={NAME_SIZE} fontWeight={800} {...labelOnFill(headerFg)}
          >
            {prefix}{name}
          </text>
          {/* Tên đơn vị dùng CÙNG cách vẽ với tên KPI (viền chữ, không giảm độ đục).
              Trước đây vẽ ở 72% độ đục nên trên ô lá tô kín màu tiến độ thì chìm hẳn — mà từ khi
              bỏ khung bọc theo đơn vị, đây là chỗ DUY NHẤT nói KPI này của ai. */}
          {showUnit && node.unitName && (
            <text
              x={rect.x + 7} y={rect.y + UNIT_BASELINE}
              fontSize={UNIT_SIZE} fontWeight={700} {...labelOnFill(headerFg)}
            >
              {fit(node.unitName, UNIT_SIZE)}
            </text>
          )}
          {showPct && (
            <text
              x={rect.x + 7} y={rect.y + pctBaseline}
              fontSize={PCT_SIZE} fontWeight={900} {...labelOnFill(fg)}
            >
              {Math.round(node.achievement!)}%
            </text>
          )}
        </>
      )}
      {showKinds && kinds.slice(0, MAX_KIND_DOTS).map((k, i) => (
        // Ô vuông bo góc chứ không phải hình tròn: SVG đặt `preserveAspectRatio="none"` nên hình
        // tròn bị kéo thành bầu dục ở những khung hẹp, còn ô vuông giãn ra vẫn đọc là một con chip.
        <rect
          key={k}
          x={rect.x + 7 + i * (KIND_DOT + 3)}
          y={rect.y + rect.h - KIND_DOT - 7}
          width={KIND_DOT} height={KIND_DOT} rx={2}
          fill={KPI_KIND_COLORS[k]}
          stroke="#fff" strokeWidth={1.2}
        >
          <title>{KPI_KIND_LABELS[k]}</title>
        </rect>
      ))}
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
  const kinds = kindsOf(node)
  return (
    <div
      className="absolute z-20 pointer-events-none bg-[var(--color-card)] border border-[var(--color-border)] p-3.5 rounded-card shadow-lg max-w-[280px]"
      style={{ left: Math.max(x + 12, 4), top: Math.max(y + 12, 4) }}
    >
      <p className="font-bold text-[var(--color-foreground)] break-words">{node.name}</p>
      {(node.unitName || node.periodName) && (
        <p className="text-xs text-[var(--color-muted-foreground)] mb-2">
          {[node.unitName, node.periodName].filter(Boolean).join(' · ')}
        </p>
      )}
      {kinds.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {kinds.map(k => (
            <span
              key={k}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold uppercase text-white"
              style={{ backgroundColor: KPI_KIND_COLORS[k] }}
            >
              {KPI_KIND_LABELS[k]}
            </span>
          ))}
        </div>
      )}
      <div className="space-y-1 text-sm">
        <Row label="Trọng số" value={String(Math.round(value * 10) / 10)} />
        {node.achievement != null ? (
          <Row
            label="Tiến độ"
            value={`${Math.round(node.achievement)}%`}
            color={achievementSurface(node.achievement)}
          />
        ) : (
          // Ô xám. Trước đây bỏ trống hẳn dòng này nên không có chỗ nào giải thích vì sao ô không
          // mang màu tiến độ nào.
          <Row label="Tiến độ" value="Chưa có kết quả" color={achievementSurface(null)} />
        )}
        {/* Số liệu thô: bảng chi tiết từng là chỗ duy nhất xem được, giờ nằm ở đây. */}
        {node.targetValue != null && (
          <Row
            label="Mục tiêu"
            value={`${fmtNum(node.targetValue)}${node.unit ? ` ${node.unit}` : ''}`}
          />
        )}
        {node.actualValue != null && (
          <Row
            label="Thực đạt"
            value={`${fmtNum(node.actualValue)}${node.unit ? ` ${node.unit}` : ''}`}
          />
        )}
        {kids.length > 0 && <Row label="Chia xuống" value={`${kids.length} KPI con`} />}
        {node.relation && <Row label="Quan hệ" value={RELATION_LABEL[node.relation] ?? node.relation} />}
      </div>
      <AssigneeAvatars people={node.assignees ?? []} />
      {node.replacedKpiName && (
        <div className="pt-2.5 mt-2.5 border-t border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-muted-foreground)] font-medium">Thay thế KPI:</p>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 break-words">
            {node.replacedKpiName}
          </p>
          {node.replacementReason && (
            <p className="text-[11px] text-[var(--color-muted-foreground)] italic mt-0.5 break-words">
              {node.replacementReason}
            </p>
          )}
        </div>
      )}
      {clickable && node.id && (
        <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 pt-2.5 mt-2.5 border-t border-[var(--color-border)]">
          Bấm để xem chi tiết →
        </p>
      )}
    </div>
  )
}

/** Bỏ số 0 thừa sau dấu phẩy: "80" chứ không phải "80.0". */
function fmtNum(v: number): string {
  return (Math.round(v * 100) / 100).toLocaleString('vi-VN')
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-3">
      {color && <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />}
      <span className="text-[var(--color-muted-foreground)] font-medium min-w-[80px]">{label}:</span>
      <span className="font-bold text-[var(--color-foreground)] tabular-nums">{value}</span>
    </div>
  )
}
