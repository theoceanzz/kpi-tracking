import { MarkerType, Position, type Edge, type Node } from '@xyflow/react'
import type { WorkflowStage, WorkflowStageCode } from '../../types'

/**
 * Mô hình sơ đồ của luồng KPI — hàm thuần, không React, để dựng nút và cạnh từ `WorkflowStage[]`.
 *
 * Cạnh KHÔNG suy từ `requires`. `requires` nói "cần gì phải tồn tại", không nói "làm gì tiếp theo":
 * `SUBMISSION` requires `CRITERIA_DRAFT` chứ không phải `CRITERIA_APPROVAL`, nên vẽ theo requires
 * thì Nộp báo cáo thành một nhánh song song với Duyệt chỉ tiêu — sai quy trình. Thay vào đó khai
 * một xương sống cố định ở đây, cùng tầng trình bày với `STAGE_HINTS`; luật thật vẫn do backend
 * cưỡng chế qua bảng chuyển trạng thái.
 *
 * Bố cục là LƯỚI GẤP DÒNG (2–4 cột tuỳ bề ngang canvas, mỗi dòng chảy trái → phải, hết dòng thì
 * xuống dòng dưới), không phải dagre: dagre xếp 10 bước thành một hàng ngang ~3000px, fitView co
 * xuống zoom 0,3 và chữ không đọc nổi. Gấp dòng cho ra một khối gần vuông, vừa màn hình ở zoom ≥ 1.
 */

/** Đường đi chính, theo thứ tự nghiệp vụ. */
export const SPINE: WorkflowStageCode[] = [
  'CYCLE_SETUP',
  'PERIOD_SETUP',
  'CRITERIA_DRAFT',
  'CRITERIA_APPROVAL',
  'SUBMISSION',
  'SUBMISSION_REVIEW',
  'SELF_EVALUATION',
  'MANAGER_EVALUATION',
  'CYCLE_EVALUATION',
]

/** Nhánh phụ treo ngoài xương sống, đặt ở DÒNG RIÊNG ngay dưới bước cha, cùng cột. */
const SIDE_BRANCHES: { from: WorkflowStageCode; to: WorkflowStageCode; label: string }[] = [
  { from: 'CRITERIA_APPROVAL', to: 'CRITERIA_ADJUSTMENT', label: 'khi cần điều chỉnh' },
]

export interface StageOutcome {
  id: 'approve' | 'reject'
  label: string
  tone: 'ok' | 'bad'
  /** Kết quả này đưa về bước nào. `undefined` = đi tiếp theo xương sống; `null` = dừng tại đây. */
  backTo?: WorkflowStageCode | null
}

/**
 * Các kết quả của bước có quyết định. Mỗi dòng là một handle nguồn riêng trên nút, và cạnh "từ
 * chối" quay lui về bước ghi ở `backTo`.
 */
export const OUTCOMES: Partial<Record<WorkflowStageCode, StageOutcome[]>> = {
  CRITERIA_APPROVAL: [
    { id: 'approve', label: 'Duyệt', tone: 'ok' },
    { id: 'reject', label: 'Không duyệt', tone: 'bad', backTo: 'CRITERIA_DRAFT' },
  ],
  SUBMISSION_REVIEW: [
    { id: 'approve', label: 'Duyệt', tone: 'ok' },
    { id: 'reject', label: 'Từ chối', tone: 'bad', backTo: 'SUBMISSION' },
  ],
  // Điều chỉnh là vòng phụ: duyệt hay từ chối thì chỉ tiêu vẫn ở trạng thái đã duyệt, không đi
  // tiếp theo xương sống. Hai dòng chỉ để nói rõ bước này có quyết định.
  CRITERIA_ADJUSTMENT: [
    { id: 'approve', label: 'Duyệt', tone: 'ok', backTo: null },
    { id: 'reject', label: 'Từ chối', tone: 'bad', backTo: null },
  ],
}

/* ── Kích thước cố định: để xếp lưới và để đặt handle theo từng dòng kết quả ── */
export const NODE_WIDTH = 280
export const NODE_HEADER_HEIGHT = 68
export const OUTCOME_ROW_HEIGHT = 36
export const OUTCOME_PADDING = 8
export const END_NODE_WIDTH = 168
export const END_NODE_HEIGHT = 52

export const COL_GAP = 96
const ROW_GAP = 88

/**
 * Kênh dọc cho đoạn bẻ góc đầu tiên sau khi rời nút, tính từ mép nút.
 *
 * Mỗi LOẠI cạnh một kênh: cạnh đi tiếp và cạnh quay lui cùng rời một nút ở mép phải — một cái
 * đi xuống, một cái đi lên — nếu bẻ góc ở cùng một x thì hai đoạn dọc đè lên nhau thành một
 * đường, không còn thấy cái nào dẫn đi đâu.
 */
const CHANNEL = { flow: 22, skip: 40, back: 58 } as const
/**
 * Kênh dọc ở lề trái trước khi vào nút đích, so le theo dòng đích. Không so le thì các cạnh gấp
 * dòng vào cột 0 ở những dòng khác nhau thẳng hàng như một đường liên tục chạy xuyên qua thẻ.
 */
const targetChannel = (targetRow: number) => 22 + (targetRow % 3) * 18
/** Số cột hợp lệ. Dưới 2 thì không còn là "gấp dòng", trên 4 thì hàng dài hơn màn hình. */
export const MIN_COLUMNS = 2
export const MAX_COLUMNS = 4

/**
 * Số cột vừa với bề ngang canvas đo được. Chỉ phụ thuộc bề ngang — không phụ thuộc bật/tắt —
 * nên bật/tắt một bước không bao giờ làm thẻ nhảy chỗ.
 */
export function columnsForWidth(width: number): number {
  const usable = width - 32 + COL_GAP
  const fit = Math.floor(usable / (NODE_WIDTH + COL_GAP))
  return Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, fit))
}

export const END_NODE_ID = '__end__'

export function stageNodeHeight(code: WorkflowStageCode): number {
  const rows = OUTCOMES[code]?.length ?? 0
  return rows === 0 ? NODE_HEADER_HEIGHT : NODE_HEADER_HEIGHT + OUTCOME_PADDING * 2 + rows * OUTCOME_ROW_HEIGHT
}

/** Toạ độ `top` (px) của handle cho dòng kết quả thứ `index`. */
export function outcomeHandleTop(index: number): number {
  return NODE_HEADER_HEIGHT + OUTCOME_PADDING + index * OUTCOME_ROW_HEIGHT + OUTCOME_ROW_HEIGHT / 2
}

export interface StageNodeData extends Record<string, unknown> {
  stage: WorkflowStage
  outcomes: StageOutcome[]
  selected: boolean
  warning?: string
  readOnly: boolean
  onToggle?: (code: WorkflowStageCode) => void
}

export type StageFlowNode = Node<StageNodeData, 'stage'>
export type EndFlowNode = Node<Record<string, never>, 'end'>
export type WorkflowFlowNode = StageFlowNode | EndFlowNode

/** Dữ liệu cho cạnh gấp khúc tuỳ biến — xem `OrthogonalEdge`. */
export interface OrthogonalEdgeData extends Record<string, unknown> {
  /** Toạ độ y của đoạn nằm ngang ở giữa — nằm trong khe trống giữa hai dòng, không cắt qua nút nào. */
  viaY: number
  /** Đích nhận cạnh ở cạnh trái (đi tiếp) hay cạnh trên (quay lui / nhánh phụ). */
  targetSide: 'left' | 'top'
  /** Đoạn ngang ngắn rời handle nguồn trước khi bẻ góc — kênh riêng theo loại cạnh. */
  sourceOffset: number
  /** Đoạn ngang ngắn trước khi vào handle đích (chỉ với `targetSide: 'left'`). */
  targetOffset: number
  label?: string
  tone?: 'flow' | 'back' | 'side'
}

interface BuildInput {
  stages: WorkflowStage[]
  /** Số ô mỗi dòng — xem `columnsForWidth`. */
  columns: number
  selected: WorkflowStageCode | null
  /** Câu cảnh báo theo mã bước (bước bật nhưng thiếu phụ thuộc). */
  warnings: Partial<Record<WorkflowStageCode, string>>
  readOnly: boolean
  onToggle?: (code: WorkflowStageCode) => void
}

interface Slot {
  row: number
  col: number
  width: number
  height: number
}

/**
 * Xếp ô cho từng nút.
 *
 * Xương sống + nút kết thúc lấp đầy lưới theo thứ tự, `columns` ô một dòng. Mỗi nhánh phụ chèn thêm một
 * dòng ngay dưới dòng của bước cha (cùng cột) và đẩy các dòng sau xuống — nhờ vậy cạnh nhánh là
 * một đoạn thẳng đứng, và cạnh gấp dòng không bao giờ phải chui qua nó.
 *
 * Tính trên TOÀN BỘ nút, bất kể bật/tắt, nên bật/tắt một bước chỉ đổi cạnh — nút đứng yên.
 */
function assignSlots(columns: number): Map<string, Slot> {
  const slots = new Map<string, Slot>()
  const spineWithEnd: string[] = [...SPINE, END_NODE_ID]

  // Bước 1: dòng/cột thô theo thứ tự xương sống.
  const rawRow = new Map<string, number>()
  spineWithEnd.forEach((id, i) => rawRow.set(id, Math.floor(i / columns)))

  // Bước 2: mỗi nhánh phụ chèn một dòng sau dòng của cha. Sắp theo dòng cha giảm dần để các lần
  // chèn không làm lệch chỉ số của nhau.
  const insertedAfter = SIDE_BRANCHES
    .map(b => ({ ...b, parentRow: rawRow.get(b.from) ?? 0 }))
    .sort((a, b) => b.parentRow - a.parentRow)

  const finalRow = (raw: number) => raw + insertedAfter.filter(b => b.parentRow < raw).length

  spineWithEnd.forEach((id, i) => {
    const raw = rawRow.get(id) ?? 0
    const isEnd = id === END_NODE_ID
    slots.set(id, {
      row: finalRow(raw),
      col: i % columns,
      width: isEnd ? END_NODE_WIDTH : NODE_WIDTH,
      height: isEnd ? END_NODE_HEIGHT : stageNodeHeight(id as WorkflowStageCode),
    })
  })

  for (const b of insertedAfter) {
    const parent = slots.get(b.from)
    if (!parent) continue
    slots.set(b.to, {
      row: parent.row + 1,
      col: parent.col,
      width: NODE_WIDTH,
      height: stageNodeHeight(b.to),
    })
  }

  return slots
}

/**
 * Dựng nút + cạnh đã có toạ độ.
 */
export function buildWorkflowGraph({ stages, columns, selected, warnings, readOnly, onToggle }: BuildInput): {
  nodes: WorkflowFlowNode[]
  edges: Edge[]
} {
  const byCode = new Map(stages.map(s => [s.code, s]))
  const isOn = (code: WorkflowStageCode) => byCode.get(code)?.enabled === true

  const slots = assignSlots(columns)

  /* ── Toạ độ tuyệt đối: chiều cao mỗi dòng = nút cao nhất trong dòng ── */
  const rowCount = Math.max(...[...slots.values()].map(s => s.row)) + 1
  const rowHeight = Array.from({ length: rowCount }, () => 0)
  for (const s of slots.values()) rowHeight[s.row] = Math.max(rowHeight[s.row] ?? 0, s.height)
  const rowTop: number[] = []
  let y = 0
  for (let r = 0; r < rowCount; r++) {
    rowTop.push(y)
    y += (rowHeight[r] ?? 0) + ROW_GAP
  }
  const colLeft = (col: number) => col * (NODE_WIDTH + COL_GAP)

  const positionOf = (id: string) => {
    const s = slots.get(id)
    if (!s) return { x: 0, y: 0 }
    // Căn giữa theo chiều dọc trong dòng để cạnh ngang giữa hai nút cùng dòng thẳng hàng.
    const rowH = rowHeight[s.row] ?? s.height
    return { x: colLeft(s.col), y: (rowTop[s.row] ?? 0) + (rowH - s.height) / 2 }
  }

  /* ── Nút ── */
  const nodes: WorkflowFlowNode[] = stages.map(stage => ({
    id: stage.code,
    type: 'stage',
    position: positionOf(stage.code),
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    draggable: false,
    connectable: false,
    data: {
      stage,
      outcomes: OUTCOMES[stage.code] ?? [],
      selected: selected === stage.code,
      warning: warnings[stage.code],
      readOnly,
      onToggle,
    },
  }))
  nodes.push({
    id: END_NODE_ID,
    type: 'end',
    position: positionOf(END_NODE_ID),
    targetPosition: Position.Left,
    draggable: false,
    connectable: false,
    data: {},
  })

  /* ── Cạnh vẽ ra: chỉ giữa các bước ĐANG BẬT ── */
  const edges: Edge[] = []
  const slotOf = (id: string) => slots.get(id)!

  /**
   * Hai LÀN trong mỗi khe trống giữa hai dòng: cạnh đi tiếp (gấp dòng, nhảy cóc) chạy ở làn trên,
   * cạnh quay lui chạy ở làn dưới. Cùng một khe thường có cả hai — gấp dòng từ dòng trên xuống
   * và "Từ chối" quay về dòng dưới — để chung một y là hai đoạn đè lên nhau thành một đường.
   */
  const LANE = 18
  const gapCenterBelow = (row: number) => (rowTop[row] ?? 0) + (rowHeight[row] ?? 0) + ROW_GAP / 2
  const gapCenterAbove = (row: number) => (rowTop[row] ?? 0) - ROW_GAP / 2
  /** Khe trống ngay DƯỚI một dòng, làn cạnh đi tiếp. */
  const gapBelow = (row: number) => gapCenterBelow(row) - LANE
  /** Khe trống ngay TRÊN một dòng — làn cạnh đi tiếp (nhảy cóc) hoặc làn quay lui. */
  const gapAbove = (row: number, lane: 'flow' | 'back' = 'flow') =>
    gapCenterAbove(row) + (lane === 'back' ? LANE : -LANE)

  const push = (
    id: string,
    source: string,
    target: string,
    data: OrthogonalEdgeData,
    handles: { sourceHandle?: string; targetHandle?: string } = {},
  ) =>
    edges.push({
      id,
      source,
      target,
      type: 'orthogonal',
      data,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: data.tone === 'back' ? 'var(--color-danger)' : 'var(--color-border-strong)',
      },
      ...handles,
    })

  const enabledSpine: string[] = [...SPINE.filter(isOn), END_NODE_ID]

  for (let i = 0; i < enabledSpine.length - 1; i++) {
    const code = enabledSpine[i]! as WorkflowStageCode
    const next = enabledSpine[i + 1]!
    const from = slotOf(code)
    const to = slotOf(next)
    const outcomes = OUTCOMES[code] ?? []
    const approve = outcomes.find(o => o.id === 'approve' && o.backTo === undefined)

    // Cùng dòng, liền kề: đoạn thẳng. Cùng dòng nhưng nhảy cóc qua bước tắt: vòng lên khe trên
    // để không cắt qua nút đã mờ. Khác dòng: gấp xuống khe dưới dòng nguồn rồi sang trái.
    const skipping = from.row === to.row && to.col - from.col > 1
    const viaY =
      from.row === to.row
        ? (skipping ? gapAbove(from.row) : Number.NaN)
        : gapBelow(from.row)

    push(
      `spine:${code}->${next}`,
      code,
      next,
      {
        viaY,
        targetSide: 'left',
        sourceOffset: skipping ? CHANNEL.skip : CHANNEL.flow,
        targetOffset: targetChannel(to.row),
        tone: 'flow',
      },
      approve ? { sourceHandle: approve.id } : {},
    )

    // Cạnh quay lui: vào handle ở CẠNH TRÊN của nút đích, đoạn ngang chạy trong khe trên dòng đích.
    for (const o of outcomes) {
      if (!o.backTo || !isOn(o.backTo)) continue
      const backSlot = slotOf(o.backTo)
      push(
        `back:${code}.${o.id}->${o.backTo}`,
        code,
        o.backTo,
        {
          viaY: gapAbove(backSlot.row, 'back'),
          targetSide: 'top',
          sourceOffset: CHANNEL.back,
          targetOffset: 0,
          label: o.label,
          tone: 'back',
        },
        { sourceHandle: o.id, targetHandle: 'top' },
      )
    }
  }

  for (const b of SIDE_BRANCHES) {
    if (!isOn(b.from) || !isOn(b.to)) continue
    // Nhánh phụ nằm ngay dưới cha, cùng cột: từ handle đáy cha xuống thẳng handle đỉnh con.
    push(
      `side:${b.from}->${b.to}`,
      b.from,
      b.to,
      { viaY: Number.NaN, targetSide: 'top', sourceOffset: 0, targetOffset: 0, label: b.label, tone: 'side' },
      { sourceHandle: 'side', targetHandle: 'top' },
    )
  }

  return { nodes, edges }
}
