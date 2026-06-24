import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KpiTypeTags } from './KpiTypeTags'

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
    isReverseKpi: c.isReverseKpi,
    isBonusKpi: c.isBonusKpi,
    parentRelationType: c.parentRelationType,
    childRelationType: c.childRelationType,
    children: c.children ? toChildNodes(c.children) : null,
  }))
}

// ── Render ─────────────────────────────────────────────────────────────────

function KpiChildRow({ node, depth }: { node: KpiChildNode; depth: number }) {
  const [open, setOpen] = useState(false)
  const hasChildren = !!node.children && node.children.length > 0
  const isBonus = node.progress == null
  const pct = Math.round(node.progress ?? 0)
  const perf = Math.round(node.performance ?? 0)

  return (
    <div className="rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/40">
      <div className="flex items-center gap-3 px-3 py-2" style={{ paddingLeft: 12 + depth * 16 }}>
        {hasChildren ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[200px]">{node.name}</span>
            <KpiTypeTags
              isReverseKpi={node.isReverseKpi}
              isBonusKpi={node.isBonusKpi}
              parentRelationType={node.parentRelationType}
              childRelationType={node.childRelationType}
            />
          </div>
          {node.targetValue != null && (
            <div className="text-[10px] text-slate-500 mt-0.5">
              {(node.actualValue ?? 0).toLocaleString('vi-VN')} / {node.targetValue.toLocaleString('vi-VN')} {node.unit ?? ''}
            </div>
          )}
        </div>

        {/* Tiến độ */}
        <div className="w-28 shrink-0">
          {isBonus ? (
            <span className="text-slate-400 text-xs font-black">—</span>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full', pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500')}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <span className="text-[10px] font-black w-9 text-right">{pct}%</span>
            </div>
          )}
        </div>

        {/* Hiệu suất */}
        <div className="w-12 shrink-0 text-center">
          {isBonus ? (
            <span className="text-slate-400 text-xs font-black">—</span>
          ) : (
            <span
              className={cn(
                'text-[10px] font-black',
                perf >= 100 ? 'text-emerald-500' : perf >= 80 ? 'text-indigo-500' : perf >= 50 ? 'text-amber-500' : 'text-red-500',
              )}
            >
              {perf}%
            </span>
          )}
        </div>
      </div>

      {open && hasChildren && (
        <div className="px-2 pb-2 flex flex-col gap-2">
          {node.children!.map((c) => (
            <KpiChildRow key={c.id} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Danh sách KPI con (có thể lồng nhiều tầng) hiển thị trong vùng expand của KPI cha/thác nước. */
export function KpiChildList({ nodes }: { nodes: KpiChildNode[] }) {
  if (!nodes || nodes.length === 0) return null
  return (
    <div className="w-full space-y-2">
      <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">KPI con</h4>
      <div className="flex flex-col gap-2">
        {nodes.map((n) => (
          <KpiChildRow key={n.id} node={n} depth={0} />
        ))}
      </div>
    </div>
  )
}

export default KpiChildList
