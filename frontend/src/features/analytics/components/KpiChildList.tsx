import { useState } from 'react'
import { ChevronDown, ChevronRight, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KpiTypeTags } from './KpiTypeTags'
import { KpiWeightPill } from './KpiWeightPill'
import { KpiPeriodCell } from './KpiPeriodCell'

type RelationType = 'DELEGATION' | 'DECOMPOSITION' | null | undefined

/** Cấu trúc chuẩn hoá cho một KPI con (gộp từ các DTO khác nhau của backend). */
export interface KpiChildNode {
  id: string
  name: string
  progress: number | null
  performance: number | null
  targetValue?: number | null
  actualValue?: number | null
  unit?: string | null
  periodName?: string | null
  periodStart?: string | null
  periodEnd?: string | null
  weight?: number | null
  assigneeName?: string | null
  isReverseKpi?: boolean
  isBonusKpi?: boolean
  parentRelationType?: RelationType
  childRelationType?: RelationType
  children?: KpiChildNode[] | null
}

// ── Mappers từ các DTO backend → KpiChildNode ──────────────────────────────

type DetailLike = {
  kpiId?: string; id?: string
  kpiName?: string; name?: string
  progress: number | null; performance: number | null
  targetValue?: number | null; actualValue?: number | null; unit?: string | null
  periodName?: string | null
  periodStart?: string | null; periodEnd?: string | null
  startDate?: string | null; endDate?: string | null
  weight?: number | null; assigneeName?: string | null
  isReverseKpi?: boolean; isBonusKpi?: boolean
  parentRelationType?: RelationType; childRelationType?: RelationType
  children?: DetailLike[] | null
}

/** Chuyển danh sách con (KpiDetail / OrgUnitKpiDetail / KpiDetailedDto) sang KpiChildNode. */
export function toChildNodes(children?: DetailLike[] | null): KpiChildNode[] {
  if (!children || children.length === 0) return []
  return children.map((c) => ({
    id: (c.kpiId ?? c.id) as string,
    name: (c.kpiName ?? c.name) as string,
    progress: c.progress,
    performance: c.performance,
    targetValue: c.targetValue ?? null,
    actualValue: c.actualValue ?? null,
    unit: c.unit ?? null,
    periodName: c.periodName ?? null,
    periodStart: c.periodStart ?? c.startDate ?? null,
    periodEnd: c.periodEnd ?? c.endDate ?? null,
    weight: c.weight ?? null,
    assigneeName: c.assigneeName ?? null,
    isReverseKpi: c.isReverseKpi,
    isBonusKpi: c.isBonusKpi,
    parentRelationType: c.parentRelationType,
    childRelationType: c.childRelationType,
    children: c.children ? toChildNodes(c.children) : null,
  }))
}

// ── Render ─────────────────────────────────────────────────────────────────

/** Vòng tròn hiệu suất nhỏ — giống KPI cha. */
function PerfDonut({ value }: { value: number }) {
  const v = Math.round(value)
  const color =
    v >= 100 ? 'text-emerald-500' : v >= 80 ? 'text-indigo-500' : v >= 50 ? 'text-amber-500' : 'text-red-500'
  return (
    <div className="inline-flex relative items-center justify-center w-11 h-11">
      <svg className="w-11 h-11 transform -rotate-90">
        <circle className="text-slate-100 dark:text-slate-800" strokeWidth="4" stroke="currentColor" fill="transparent" r="18" cx="22" cy="22" />
        <circle
          className={color}
          strokeWidth="4"
          strokeDasharray={113}
          strokeDashoffset={113 - (Math.min(v, 100) / 100) * 113}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r="18"
          cx="22"
          cy="22"
        />
      </svg>
      <span className="absolute text-[10px] font-black">{v}%</span>
    </div>
  )
}

function KpiChildRow({ node, depth, onSelect }: { node: KpiChildNode; depth: number; onSelect?: (kpiId: string) => void }) {
  const [open, setOpen] = useState(false)
  const hasChildren = !!node.children && node.children.length > 0
  const isBonus = node.progress == null
  const pct = Math.round(node.progress ?? 0)
  const perf = Math.round(node.performance ?? 0)

  return (
    <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/40">
      <div
        className={cn('flex items-center gap-4 px-4 py-3', onSelect && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl transition-colors')}
        style={{ paddingLeft: 16 + depth * 16 }}
        onClick={onSelect ? () => onSelect(node.id) : undefined}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
            className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Tên + tag + trọng số */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate max-w-[220px]">{node.name}</span>
            <KpiTypeTags
              isReverseKpi={node.isReverseKpi}
              isBonusKpi={node.isBonusKpi}
              parentRelationType={node.parentRelationType}
              childRelationType={node.childRelationType}
            />
            <KpiWeightPill weight={node.weight} />
          </div>
        </div>

        {/* Người đảm nhiệm (cột giữa, căn như cột đơn vị/người của KPI cha) */}
        <div className="hidden lg:flex w-44 shrink-0 items-center gap-1 text-[12px] font-semibold text-slate-600 dark:text-slate-300">
          {node.assigneeName ? (
            <>
              <User size={12} className="shrink-0 text-slate-400" />
              <span className="truncate">{node.assigneeName}</span>
            </>
          ) : (
            <span className="text-slate-300 dark:text-slate-600">—</span>
          )}
        </div>

        {/* Đợt */}
        <div className="hidden md:block w-40 shrink-0">
          <KpiPeriodCell periodName={node.periodName} start={node.periodStart ?? null} end={node.periodEnd ?? null} />
        </div>

        {/* Tiến độ (bar + %, actual/target dưới bar — giống KPI cha) */}
        <div className="w-40 shrink-0">
          {isBonus ? (
            <span className="text-slate-400 text-xs font-black">—</span>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500')}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <span className="text-[11px] font-black w-10 text-right">{pct}%</span>
              </div>
              {node.targetValue != null && (
                <div className="text-[10px] text-slate-400 mt-1">
                  {(node.actualValue ?? 0).toLocaleString('vi-VN')} / {node.targetValue.toLocaleString('vi-VN')} {node.unit ?? ''}
                </div>
              )}
            </>
          )}
        </div>

        {/* Hiệu suất (donut giống cha) */}
        <div className="w-12 shrink-0 flex justify-center">
          {isBonus ? <span className="text-slate-400 text-xs font-black">—</span> : <PerfDonut value={perf} />}
        </div>
      </div>

      {open && hasChildren && (
        <div className="px-2 pb-2 flex flex-col gap-2">
          {node.children!.map((c) => (
            <KpiChildRow key={c.id} node={c} depth={depth + 1} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Danh sách KPI con (có thể lồng nhiều tầng) hiển thị trong vùng expand của KPI cha/thác nước.
 * `heading` mặc định "KPI con".
 */
export function KpiChildList({
  nodes,
  heading = 'KPI con',
  onSelect,
}: {
  nodes: KpiChildNode[]
  heading?: string
  /** Bấm vào một KPI con → mở thống kê của KPI con đó (theo kpiId). */
  onSelect?: (kpiId: string) => void
}) {
  if (!nodes || nodes.length === 0) return null
  return (
    <div className="w-full space-y-2">
      <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">{heading}</h4>
      <div className="flex flex-col gap-2">
        {nodes.map((n) => (
          <KpiChildRow key={n.id} node={n} depth={0} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}

export default KpiChildList
