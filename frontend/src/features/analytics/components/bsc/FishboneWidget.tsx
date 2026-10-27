import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useFormat } from '@/i18n/useFormat'
import type { BscGoalGraph, GoalStatus, GraphObjective } from '../../api/bscGoalGraphApi'
import { useBscGoalGraph } from '../../hooks/useBscGoalGraph'
import {
  buildAdjacency, objectivesByPerspective, relatedIds, statusLabelKey, statusOf, statusTone, thresholdHint,
} from './goalGraphModel'
import ObjectiveDetailPanel from './ObjectiveDetailPanel'

/**
 * Xương cá (Ishikawa) của thẻ điểm: đầu cá là đích ngắm, mỗi nhánh là một lĩnh vực BSC, mỗi xương
 * con là một mục tiêu — dài theo trọng số, màu theo trạng thái.
 *
 * <p>Đọc ĐÚNG payload mà bản đồ chiến lược đọc (`/stats/bsc/goal-graph`, cùng `queryKey`), nên hai
 * hình không bao giờ nói hai chuyện khác nhau và cũng không phát sinh lời gọi mạng nào. Mọi con số
 * do server tính.
 *
 * <p>Vẽ SVG tay chứ không qua thư viện sơ đồ: hình học ở đây tất định (không có thuật toán xếp
 * nút nào cần chạy), nhờ vậy sắc nét khi chiếu, in được, `useCopyImage` chụp được, và không có
 * cuộc đua đo kích thước nào như các canvas tự co.
 */
export default function FishboneWidget({ scope, limit, status, presenting, head, onHeadChange, meta }: {
  scope: { orgUnitId?: string; periodId?: string; periodIdTo?: string }
  limit?: number
  status?: string
  /** Đang ở chế độ trình chiếu: màn hình rộng hơn nên vẽ được nhiều xương hơn mỗi nhánh. */
  presenting?: boolean
  /** Đầu cá đang chọn: {@link SCORECARD_HEAD} hoặc id một mục tiêu. */
  head?: string
  onHeadChange?: (value: string) => void
  meta?: React.ReactNode
}) {
  const { t } = useTranslation('analytics')
  const fmt = useFormat()
  const { data: graph, isLoading } = useBscGoalGraph({ ...scope, limit, status: status as never })
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const adj = useMemo(() => buildAdjacency(graph), [graph])
  const related = useMemo(() => relatedIds(hovered, adj), [hovered, adj])
  const byPerspective = useMemo(() => objectivesByPerspective(graph), [graph])
  const layout = useMemo(
    () => buildLayout(graph, byPerspective, head, presenting ? MAX_BONES_PRESENTING : MAX_BONES),
    [graph, byPerspective, head, presenting],
  )

  if (!isLoading && (!graph?.scorecardId || graph.objectives.length === 0)) {
    return (
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        {meta}
        <p className="flex-1 flex items-center justify-center text-sm text-slate-400 text-center px-6">
          {graph?.scorecardId ? t('goalGraph.noObjectiveMatchesFilter') : t('goalGraph.noScorecardForThisPeriod')}
        </p>
      </div>
    )
  }

  const pct = (v?: number | null) => (v == null ? '—' : fmt.percent(v))

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {meta}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium text-slate-400">
        {onHeadChange && (graph?.objectives.length ?? 0) > 0 && (
          <label className="flex items-center gap-2">
            <span>{t('goalGraph.headChoice')}</span>
            <Select value={head ?? SCORECARD_HEAD} onValueChange={onHeadChange}>
              <SelectTrigger className="h-8 w-auto text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SCORECARD_HEAD}>{t('goalGraph.wholeScorecard')}</SelectItem>
                {(graph?.objectives ?? []).map(o => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.derivedCode ? `${o.derivedCode}. ${o.name ?? ''}` : (o.name ?? '')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        )}
        {graph?.provisional && <span className="text-amber-600 dark:text-amber-400">{t('goalGraph.draftResult')}</span>}
        {graph && <span title={t('goalGraph.thresholdsComeFromServer')}>{thresholdHint(graph.thresholds)}</span>}
        {(graph?.hiddenObjectiveCount ?? 0) > 0 && (
          <span>{t('goalGraph.objectivesHidden', { count: graph?.hiddenObjectiveCount })}</span>
        )}
        <span>{t('goalGraph.fishboneHint')}</span>
      </div>

      <div className="flex-1 min-h-0" onMouseLeave={() => setHovered(null)}>
        {layout && (
          <svg
            viewBox={`0 0 ${VB_W} ${layout.height}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full"
            role="img"
            aria-label={t('goalGraph.fishboneHint')}
          >
            {/* ── xương sống + mũi tên về phía đầu cá ─────────────────────── */}
            <path
              d={`M${SPINE_X0} ${layout.spineY}H${layout.headX - 10}`}
              className="stroke-slate-400/70"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d={`M${layout.headX} ${layout.spineY}l-14 -8v16z`}
              className="fill-slate-400/70"
            />
            {graph?.periodName && (
              <text
                x={SPINE_X0 + 2}
                y={layout.spineY + 20}
                className="text-[13px] font-medium fill-[var(--color-muted-foreground)]"
              >
                {graph.periodName}
              </text>
            )}

            {/* ── đầu cá: đích ngắm ───────────────────────────────────────── */}
            <HeadBlock head={layout.head} x={layout.headX} y={layout.spineY} pct={pct} />

            {/* ── nhánh = lĩnh vực, so le trên/dưới ───────────────────────── */}
            {layout.ribs.map(rib => {
              // Mờ tính Ở ĐÂY chứ không trong `buildLayout`: layout chỉ phụ thuộc payload nên nếu
              // mang theo trạng thái rê chuột thì cả hình được dựng lại mỗi lần chuột đi qua.
              const ribDimmed = hovered != null && !rib.bones.some(b => related.has(b.objective.id))
              return (
              <g key={rib.code}>
                <path
                  d={`M${rib.baseX} ${layout.spineY}L${rib.tipX} ${rib.tipY}`}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                  style={{ stroke: rib.color ?? 'currentColor' }}
                  className={rib.color ? undefined : 'stroke-slate-400'}
                  opacity={ribDimmed ? 0.3 : 1}
                />
                <text
                  x={rib.tipX}
                  y={rib.tipY + (rib.up ? -10 : 20)}
                  textAnchor="middle"
                  opacity={ribDimmed ? 0.3 : 1}
                >
                  <tspan className="text-[14px] font-semibold fill-[var(--color-foreground)]">{rib.name}</tspan>
                  <tspan className="text-[12px] font-medium fill-[var(--color-muted-foreground)]" dx="8">
                    {pct(rib.achievementPercent)}
                  </tspan>
                  <tspan className="text-[12px] font-medium fill-slate-400" dx="8">
                    {t('goalGraph.weightShare', { value: pct(rib.weightPercentage) })}
                  </tspan>
                </text>

                {rib.bones.map(bone => (
                  <Bone
                    key={bone.objective.id}
                    bone={bone}
                    dimmed={hovered != null && !related.has(bone.objective.id)}
                    pct={pct}
                    label={t(statusLabelKey(bone.objective.status))}
                    gateLabel={t('goalGraph.gateItem')}
                    onHover={setHovered}
                    onSelect={setSelected}
                  />
                ))}

                {rib.hiddenCount > 0 && (
                  <text
                    x={rib.tipX}
                    y={rib.tipY + (rib.up ? -28 : 38)}
                    textAnchor="middle"
                    className="text-[12px] font-medium fill-slate-400"
                  >
                    {t('goalGraph.moreObjectivesOnBranch', { count: rib.hiddenCount })}
                  </text>
                )}
              </g>
              )
            })}
          </svg>
        )}
      </div>

      {selected && (
        <ObjectiveDetailPanel itemId={selected} scope={scope} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

/** Đầu cá mặc định = tổng thẻ điểm. */
export const SCORECARD_HEAD = '__scorecard__'

/* ── hình học ──────────────────────────────────────────────────────────────── */

const VB_W = 1200
const SPINE_X0 = 24
const HEAD_W = 196
const HEAD_H = 104
/** Số xương tối đa mỗi nhánh — đông hơn thì không đọc được, đúng cảnh báo của BRD §8. */
const MAX_BONES = 6
const MAX_BONES_PRESENTING = 8
const BONE_GAP = 44

interface BoneBox {
  objective: GraphObjective
  /** Điểm gắn trên nhánh. */
  ax: number
  ay: number
  len: number
  /** Bề ngang vùng bấm (gồm cả nhãn, thường dài hơn xương). */
  boxW: number
  /** Nhánh nằm trên xương sống — quyết định nhãn phải lùi thêm bao nhiêu để không bị nhánh cắt. */
  up: boolean
}

interface RibBox {
  code: string
  name: string
  color?: string | null
  achievementPercent?: number | null
  weightPercentage?: number | null
  up: boolean
  baseX: number
  tipX: number
  tipY: number
  bones: BoneBox[]
  hiddenCount: number
}

interface HeadBox {
  title: string
  percent?: number | null
  status: GoalStatus
  sub?: string | null
}

/**
 * Toạ độ của cả hình, tính một lần cho mỗi payload.
 *
 * <p>Nhánh so le trên/dưới và MỖI BÊN tự dàn đều trên xương sống — dàn đều cả 4 nhánh trên một
 * hàng thì hai nhánh cùng bên chỉ cách nhau một nửa, nhãn của nhánh này đè xương của nhánh kia.
 */
function buildLayout(
  graph: BscGoalGraph | undefined,
  byPerspective: Map<string, GraphObjective[]>,
  head: string | undefined,
  maxBones: number,
): { height: number; spineY: number; headX: number; head: HeadBox; ribs: RibBox[] } | null {
  if (!graph) return null

  const headObjective = head && head !== SCORECARD_HEAD
    ? graph.objectives.find(o => o.id === head)
    : undefined

  const perspectives = (graph.perspectives ?? [])
    .map(p => ({
      p,
      items: (byPerspective.get(p.code) ?? []).filter(o => o.id !== headObjective?.id),
    }))
    .filter(x => x.items.length > 0)

  const shown = perspectives.map(x => Math.min(x.items.length, maxBones))
  const bonesMax = Math.max(1, ...shown)

  const ribH = Math.min(300, 76 + bonesMax * BONE_GAP)
  const height = Math.round(2 * (ribH + 74))
  const spineY = Math.round(height / 2)
  const headX = VB_W - HEAD_W - 6

  // Nhánh càng nhiều mỗi bên thì càng phải thu độ nghiêng và độ dài xương, không thì chồng nhau.
  const perSide = Math.max(
    perspectives.filter((_, i) => i % 2 === 0).length,
    perspectives.filter((_, i) => i % 2 === 1).length,
  )
  const ribRun = perSide >= 3 ? 112 : 172
  const boneMin = 46
  const boneMax = perSide >= 3 ? 104 : 148

  const ribL = SPINE_X0 + ribRun + 236
  const ribR = headX - 48
  const countOf = (side: number) => perspectives.filter((_, i) => i % 2 === side).length

  const weights = graph.objectives.map(o => o.weightPercentage ?? 0)
  const maxWeight = Math.max(1, ...weights)

  const ribs: RibBox[] = perspectives.map(({ p, items }, i) => {
    const side = i % 2
    const up = side === 0
    const count = countOf(side)
    // Thứ tự của nhánh TRONG BÊN của nó.
    const k = perspectives.slice(0, i).filter((_, j) => j % 2 === side).length
    const baseX = count === 1 ? (ribL + ribR) / 2 : ribL + (k * (ribR - ribL)) / (count - 1)
    const dir = up ? -1 : 1
    const tipX = baseX - ribRun
    const tipY = spineY + dir * ribH

    // Xương nặng nhất vẽ trước (gần xương sống nhất) — mục tiêu nặng là mục tiêu đáng nhìn trước.
    const sorted = [...items].sort((a, b) => (b.weightPercentage ?? 0) - (a.weightPercentage ?? 0))
    const take = sorted.slice(0, maxBones)

    const bones: BoneBox[] = take.map((o, m) => {
      const f = (m + 1) / (take.length + 1)
      const len = boneMin + (boneMax - boneMin) * ((o.weightPercentage ?? 0) / maxWeight)
      return {
        objective: o,
        ax: baseX - ribRun * f,
        ay: spineY + dir * ribH * f,
        len,
        boxW: Math.max(len, labelWidth(o)),
        up,
      }
    })

    return {
      code: p.code,
      name: p.name,
      color: p.color,
      achievementPercent: p.achievementPercent,
      weightPercentage: p.weightPercentage,
      up, baseX, tipX, tipY, bones,
      hiddenCount: items.length - take.length,
    }
  })

  const headBox: HeadBox = headObjective
    ? {
        title: headObjective.name ?? '',
        percent: headObjective.achievementPercent,
        status: headObjective.status,
        sub: headObjective.perspectiveName,
      }
    : {
        title: graph.scorecardName ?? '',
        percent: graph.achievementPercent,
        status: statusOf(graph.achievementPercent, graph.thresholds),
        sub: graph.orgUnitName,
      }

  return { height, spineY, headX, head: headBox, ribs }
}

/** Bề ngang nhãn, đủ để làm vùng bấm — ước lượng theo số ký tự, không đo DOM. */
function labelWidth(o: GraphObjective): number {
  const chars = (o.derivedCode ? o.derivedCode.length + 2 : 0) + (o.name?.length ?? 0) + 6
  return Math.min(300, 34 + chars * 6.4)
}

/* ── các khối vẽ ───────────────────────────────────────────────────────────── */

function HeadBlock({ head, x, y, pct }: {
  head: HeadBox
  x: number
  y: number
  pct: (v?: number | null) => string
}) {
  const { t } = useTranslation('analytics')
  const tone = statusTone(head.status)
  return (
    <g className={tone.text}>
      <rect
        x={x}
        y={y - HEAD_H / 2}
        width={HEAD_W}
        height={HEAD_H}
        rx="16"
        className="fill-[var(--color-card)] stroke-current"
        strokeWidth="2.5"
      />
      <text x={x + HEAD_W / 2} y={y - HEAD_H / 2 + 22} textAnchor="middle" className="text-[11px] font-semibold fill-slate-400 uppercase">
        {t('goalGraph.northStar')}
      </text>
      {wrapWords(head.title, 20, 2).map((line, i) => (
        <text
          key={i}
          x={x + HEAD_W / 2}
          y={y - HEAD_H / 2 + 42 + i * 16}
          textAnchor="middle"
          className="text-[13px] font-semibold fill-[var(--color-foreground)]"
        >
          {line}
        </text>
      ))}
      <text x={x + HEAD_W / 2} y={y + HEAD_H / 2 - 16} textAnchor="middle" className="text-[22px] font-semibold fill-current tabular-nums">
        {pct(head.percent)}
      </text>
    </g>
  )
}

function Bone({ bone, dimmed, pct, label, gateLabel, onHover, onSelect }: {
  bone: BoneBox
  dimmed: boolean
  pct: (v?: number | null) => string
  label: string
  gateLabel: string
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}) {
  const o = bone.objective
  const tone = statusTone(o.status)
  const name = o.derivedCode ? `${o.derivedCode}. ${o.name ?? ''}` : (o.name ?? '')
  return (
    <g
      className={`${tone.text} cursor-pointer focus:outline-none`}
      opacity={dimmed ? 0.3 : 1}
      tabIndex={0}
      role="button"
      aria-label={`${name} ${pct(o.achievementPercent)} — ${label}`}
      onMouseEnter={() => onHover(o.id)}
      onFocus={() => onHover(o.id)}
      onClick={() => onSelect(o.id)}
      onKeyDown={e => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        onSelect(o.id)
      }}
    >
      {/* Vùng bấm phủ cả xương lẫn nhãn; `transparent` vẫn nhận chuột, `none` thì không. */}
      <rect
        x={bone.ax - bone.boxW - 6}
        y={bone.ay - 21}
        width={bone.boxW + 12}
        height={30}
        fill="transparent"
        className="hover:fill-[var(--color-muted)]"
        rx="6"
      />
      <path
        d={`M${bone.ax} ${bone.ay}H${bone.ax - bone.len}`}
        className="stroke-current"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      {/* Hạng mục chặn: một vạch chắn ở đầu mút xương. Vẽ bằng NÉT chứ không bằng ký tự biểu
          tượng — phông hệ thống không chắc có glyph, mà `html-to-image` lại chụp đúng những gì
          phông vẽ ra, nên ô vuông "tofu" sẽ dính luôn vào ảnh chiếu. */}
      {o.isGate && (
        <path
          d={`M${bone.ax - bone.len} ${bone.ay - 8}v16`}
          className="stroke-current"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      )}
      {/*
          Nhãn ngồi TRÊN xương. Với nhánh phía trên, đường nhánh đi lên-sang-trái nên ở độ cao của
          chữ nó đã lấn vào chỗ chữ — phải lùi thêm, không thì nhánh gạch ngang qua đuôi "91%".
          Nhánh phía dưới thì ngược lại, đường nhánh né ra xa, chỉ cần khoảng hở tối thiểu.
      */}
      <text x={bone.ax - (bone.up ? 30 : 10)} y={bone.ay - 6} textAnchor="end">
        <tspan className="text-[13px] font-medium fill-[var(--color-foreground)]">{truncate(name, 26)}</tspan>
        <tspan className="text-[13px] font-semibold fill-current tabular-nums" dx="7">
          {pct(o.achievementPercent)}
        </tspan>
      </text>
      <title>{o.isGate ? `${name} · ${label} · ${gateLabel}` : `${name} · ${label}`}</title>
    </g>
  )
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`
}

/** Cắt tên đầu cá thành tối đa `maxLines` dòng, mỗi dòng ~`per` ký tự. */
function wrapWords(s: string, per: number, maxLines: number): string[] {
  const words = s.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if (!cur) cur = w
    else if (cur.length + 1 + w.length <= per) cur += ` ${w}`
    else { lines.push(cur); cur = w }
    if (lines.length === maxLines) break
  }
  if (lines.length < maxLines && cur) lines.push(cur)
  if (!lines.length) return ['']
  const last = lines.length - 1
  const used = lines.join(' ').length
  if (used < s.length) lines[last] = truncate(`${lines[last]}…`, per + 1)
  return lines
}
