import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KpiTypeTags } from './KpiTypeTags'
import { QualitativeResultChip } from './QualitativeResultChip'
import { KpiWeightPill } from './KpiWeightPill'
import { KpiPeriodCell } from './KpiPeriodCell'
import { KpiResponsibleCell } from './KpiResponsibleCell'
import type { KpiChildNode } from './KpiChildList'

export type { KpiChildNode }
export { toChildNodes } from './KpiChildList'

interface Variant {
  /** Cột chevron riêng đứng đầu (bảng Personal). Nếu false thì chevron nằm trong ô tên. */
  leadingChevronCol?: boolean
  /** Có cột "người đảm nhiệm" riêng (bảng đơn vị/subordinate). Nếu false thì hiện người dưới tên. */
  showPersonColumn?: boolean
  /** Số ô trống thêm sau ô tên (vd cột KR ở MyObjectivesTab). */
  extraColsAfterName?: number
  /** Số ô trống cuối hàng (vd cột "Phân loại" ở bảng Personal). */
  trailingEmptyCols?: number
  /** Màu thanh tiến độ (<100%). */
  accent?: 'violet' | 'indigo'
  /** Padding-left gốc của ô tên (px). */
  baseIndent?: number
}

function KpiChildTr({
  node,
  depth,
  onSelect,
  variant,
}: {
  node: KpiChildNode
  depth: number
  onSelect?: (kpiId: string) => void
  variant: Variant
}) {
  const [open, setOpen] = useState(false)
  const {
    leadingChevronCol = false,
    showPersonColumn = true,
    extraColsAfterName = 0,
    trailingEmptyCols = 0,
    accent = 'indigo',
    baseIndent = 28,
  } = variant

  const hasKids = !!node.children && node.children.length > 0
  const isQual = node.kpiType === 'QUALITATIVE'
  const isBonus = node.progress == null
  const pct = Math.round(node.progress ?? 0)
  const barColor = accent === 'violet' ? 'bg-violet-500' : 'bg-indigo-500'

  const chevron = hasKids ? (
    <button
      onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
      className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
    >
      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
    </button>
  ) : (
    <span className="w-[18px] shrink-0" />
  )

  const person = <KpiResponsibleCell assigneeName={node.assigneeName} />

  const nameBlock = (
    <div className="min-w-0">
      <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate max-w-[240px]">{node.name}</div>
      <div className="flex items-center gap-1.5 flex-wrap mt-1">
        <KpiTypeTags
          isReverseKpi={node.isReverseKpi}
          isBonusKpi={node.isBonusKpi}
          isQualitative={isQual}
          parentRelationType={node.parentRelationType}
          childRelationType={node.childRelationType}
        />
        <KpiWeightPill weight={node.weight} />
      </div>
      {!showPersonColumn && node.assigneeName && (
        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
          <User size={11} className="text-slate-400" /> {node.assigneeName}
        </div>
      )}
    </div>
  )

  const progressCell = isQual ? (
    <QualitativeResultChip level={node.qualitativeLevelName} />
  ) : isBonus ? (
    <span className="text-slate-400 text-xs font-black">—</span>
  ) : (
    <>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-emerald-500' : barColor)} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <span className="text-xs font-black">{pct}%</span>
      </div>
      {node.targetValue != null && (
        <div className="text-[10px] text-slate-500 mt-1">
          {(node.actualValue ?? 0).toLocaleString('vi-VN')} / {node.targetValue.toLocaleString('vi-VN')} {node.unit ?? ''}
        </div>
      )}
    </>
  )

  return (
    <>
      <tr
        className={cn('bg-white/60 dark:bg-slate-900/30 transition-colors', onSelect && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40')}
        onClick={onSelect ? () => onSelect(node.id) : undefined}
      >
        {leadingChevronCol && (
          <td className="px-6 py-4 align-top">{chevron}</td>
        )}
        <td className="py-4 pr-6 align-top" style={{ paddingLeft: baseIndent + depth * 20 }}>
          <div className="flex items-start gap-2">
            {!leadingChevronCol && <span className="mt-0.5">{chevron}</span>}
            {nameBlock}
          </div>
        </td>
        {Array.from({ length: extraColsAfterName }).map((_, i) => (
          <td key={`x${i}`} className="px-6 py-4" />
        ))}
        {showPersonColumn && (
          <td className="px-6 py-4 align-top text-[12px]">{person}</td>
        )}
        <td className="px-6 py-4 align-top">
          <KpiPeriodCell periodName={node.periodName} start={node.periodStart ?? null} end={node.periodEnd ?? null} />
        </td>
        <td className="px-6 py-4 align-top">{progressCell}</td>
        {Array.from({ length: trailingEmptyCols }).map((_, i) => (
          <td key={`t${i}`} className="px-6 py-4" />
        ))}
      </tr>
      {open && hasKids && node.children!.map((c) => (
        <KpiChildTr key={c.id} node={c} depth={depth + 1} onSelect={onSelect} variant={variant} />
      ))}
    </>
  )
}

/**
 * Render danh sách KPI con thành các <tr> căn thẳng cột với hàng KPI cha.
 * Bọc bằng <Fragment> để chèn trực tiếp vào <tbody> của bảng cha.
 */
export function KpiChildTableRows({
  nodes,
  onSelect,
  variant,
  headingColSpan,
  heading = 'KPI con',
}: {
  nodes: KpiChildNode[]
  onSelect?: (kpiId: string) => void
  variant: Variant
  /** Nếu truyền, render 1 hàng tiêu đề "KPI con" chiếm trọn chiều ngang. */
  headingColSpan?: number
  heading?: string
}) {
  if (!nodes || nodes.length === 0) return null
  return (
    <>
      {headingColSpan != null && (
        <tr className="bg-slate-50/70 dark:bg-slate-800/20">
          <td colSpan={headingColSpan} className="px-6 pt-4 pb-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">{heading}</span>
          </td>
        </tr>
      )}
      {nodes.map((n) => (
        <Fragment key={n.id}>
          <KpiChildTr node={n} depth={0} onSelect={onSelect} variant={variant} />
        </Fragment>
      ))}
    </>
  )
}

export default KpiChildTableRows
