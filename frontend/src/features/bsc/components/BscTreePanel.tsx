import { useMemo, useState } from 'react'
import {
  ChevronDown, ChevronRight, GitBranch, Lock, ShieldAlert, Building2, Users,
  Send, Check, Undo2, RefreshCw, Loader2, AlertTriangle, Calculator,
} from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import {
  useScorecardTree, useScorecardCoverage, useCascadeMutations,
  useUnitResult, useUnitResultMutations,
} from '../hooks/useBscCascade'
import {
  BscScorecardLevel, BscScorecardStatus, BscUnitResultStatus, BscMeasurementSource,
  type ScorecardTreeNodeResponse, type ScorecardResponse,
} from '../types'

interface BscTreePanelProps {
  organizationId?: string
  scorecards?: ScorecardResponse[]
  onCascade: (scorecard: ScorecardResponse) => void
  /**
   * Người đang xem có thao tác được với bộ tiêu chí này không.
   *
   * Nhận từ trang cha thay vì tự suy: quyền phải tính THEO TỪNG THẺ (đơn vị nào giữ thẻ đó), không
   * phải một cờ chung cho cả cây — trưởng đơn vị này không được trình duyệt hay tính lại kết quả
   * cho đơn vị khác.
   */
  canEditScorecard: (scorecard: ScorecardResponse) => boolean
}

const STATUS_META: Record<BscScorecardStatus, { label: string; className: string }> = {
  [BscScorecardStatus.DRAFT]: { label: 'Nháp', className: 'bg-slate-100 text-slate-500 dark:bg-slate-800' },
  [BscScorecardStatus.SUBMITTED]: { label: 'Chờ duyệt', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  [BscScorecardStatus.APPROVED]: { label: 'Đã duyệt', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  [BscScorecardStatus.ACTIVE]: { label: 'Đang áp dụng', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  [BscScorecardStatus.CLOSED]: { label: 'Đã đóng', className: 'bg-slate-100 text-slate-500 dark:bg-slate-800' },
  [BscScorecardStatus.LOCKED]: { label: 'Đã khoá', className: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  [BscScorecardStatus.ARCHIVED]: { label: 'Lưu trữ', className: 'bg-slate-100 text-slate-400 dark:bg-slate-800' },
}

const COVERAGE_META: Record<string, { label: string; className: string }> = {
  NOT_CASCADED: { label: 'Chưa phân rã', className: 'text-slate-400' },
  UNDER: { label: 'Thiếu', className: 'text-amber-600' },
  OK: { label: 'Đủ', className: 'text-emerald-600' },
  OVER: { label: 'Vượt', className: 'text-sky-600' },
}

const num = (v?: number | null, d = 1) => (v == null ? '—' : v.toFixed(d))

/**
 * Cây BSC Công ty → Đơn vị, kèm độ phủ và kết quả từng nhánh.
 *
 * <p>Đây là màn hình trả lời câu hỏi "mục tiêu công ty đã xuống tới đâu": mỗi node hiện số chỉ tiêu
 * cấp trên giao so với số đơn vị tự thêm, tổng trọng số đã đủ 100% chưa, và %đạt của đợt đang xem.
 */
export default function BscTreePanel({ organizationId, scorecards, onCascade, canEditScorecard }: BscTreePanelProps) {
  const { hasPermission } = usePermission()
  const canManage = hasPermission('BSC:MANAGE')
  const canApprove = hasPermission('BSC:APPROVE')

  const { data: periodsData } = useKpiPeriods({ organizationId, size: 200, sortBy: 'startDate', direction: 'desc' })
  const periods = useMemo(() => periodsData?.content || [], [periodsData])
  const [periodId, setPeriodId] = useState<string>('')

  const { data: tree, isLoading } = useScorecardTree(organizationId, periodId || undefined)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const scorecardById = useMemo(
    () => new Map((scorecards || []).map(s => [s.id, s])),
    [scorecards],
  )

  // Có quyền MANAGE_UNIT mới chỉ là điều kiện cần; điều kiện đủ nằm ở canEditScorecard theo từng thẻ.
  const hasUnitRight = hasPermission('BSC:MANAGE_UNIT') || canManage
  const canEditNode = (id: string) => {
    if (canManage) return true
    if (!hasUnitRight) return false
    const sc = scorecardById.get(id)
    return !!sc && canEditScorecard(sc)
  }

  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64">
          {/* Cùng lý do như trên: chuỗi rỗng làm Radix nuốt placeholder, ra một ô trắng khó hiểu.
              Ở đây KHÔNG chọn sẵn đợt nào vì "chưa chọn đợt" là trạng thái hợp lệ — cây vẫn xem được. */}
          <Select value={periodId || undefined} onValueChange={setPeriodId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Chọn đợt để xem kết quả" />
            </SelectTrigger>
            <SelectContent className="z-[1100]">
              {periods.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <p className="text-[11px] font-bold text-slate-400">
          Chọn đợt để thấy %đạt và hệ số của từng nhánh. Bỏ trống thì cây vẫn hiện, chỉ không có con số kết quả.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-10 text-slate-400">
          <Loader2 size={20} className="animate-spin" />
        </div>
      )}

      {!isLoading && (!tree || tree.length === 0) && (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center">
          <p className="text-sm font-bold text-slate-400">Chưa có bộ tiêu chí nào.</p>
          <p className="text-[11px] font-medium text-slate-400 mt-1">
            Tạo BSC công ty trước, rồi phân rã chỉ tiêu xuống các phòng ban.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {(tree || []).map(node => (
          <TreeNode key={node.id} node={node} depth={0}
            expanded={expanded} onToggle={toggle}
            selectedId={selectedId} onSelect={setSelectedId}
            scorecardById={scorecardById} onCascade={onCascade}
            periodId={periodId}
            canManage={canManage} canApprove={canApprove} canEditNode={canEditNode} />
        ))}
      </div>
    </div>
  )
}

function TreeNode({
  node, depth, expanded, onToggle, selectedId, onSelect, scorecardById, onCascade, periodId,
  canManage, canApprove, canEditNode,
}: {
  node: ScorecardTreeNodeResponse
  depth: number
  expanded: Record<string, boolean>
  onToggle: (id: string) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  scorecardById: Map<string, ScorecardResponse>
  onCascade: (s: ScorecardResponse) => void
  periodId: string
  canManage: boolean
  canApprove: boolean
  canEditNode: (scorecardId: string) => boolean
}) {
  const isOpen = expanded[node.id] ?? depth === 0
  const isSelected = selectedId === node.id
  const status = STATUS_META[node.status] ?? STATUS_META[BscScorecardStatus.DRAFT]
  const { submitScorecard, approveScorecard, rejectScorecard, activateScorecard, lockScorecard, reopenScorecard }
    = useCascadeMutations()
  const canEdit = canEditNode(node.id)
  const selfCount = node.itemCount - node.assignedCount
  const weightOk = Math.abs(node.totalWeight - 100) <= 0.01

  return (
    <div>
      <div className={cn('rounded-2xl border transition-colors',
        isSelected ? 'border-indigo-300 dark:border-indigo-700' : 'border-slate-100 dark:border-slate-800',
        'bg-white dark:bg-slate-900')}
        style={{ marginLeft: depth * 20 }}>
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button onClick={() => onToggle(node.id)}
            className={cn('p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
              node.children.length === 0 && 'invisible')}>
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          <div className={cn('w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-white',
            node.level === BscScorecardLevel.COMPANY ? 'bg-indigo-600' : 'bg-slate-400 dark:bg-slate-600')}>
            {node.level === BscScorecardLevel.COMPANY ? <Building2 size={14} /> : <Users size={14} />}
          </div>

          <button onClick={() => onSelect(isSelected ? null : node.id)} className="flex-1 min-w-0 text-left">
            <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{node.name}</p>
            <p className="text-[10px] font-bold text-slate-400 truncate">
              {node.level === BscScorecardLevel.COMPANY ? 'BSC công ty' : node.orgUnitName || 'BSC đơn vị'}
              {node.periodLabel ? ` · ${node.periodLabel}` : ''}
              {' · '}{node.itemCount} chỉ tiêu
              {node.assignedCount > 0 && ` (${node.assignedCount} cấp trên giao, ${selfCount} tự thêm)`}
              {node.gateCount > 0 && ` · ${node.gateCount} chặn`}
            </p>
          </button>

          {node.achievementPercent != null && (
            <div className="text-right shrink-0 px-2">
              <p className="text-sm font-black text-slate-800 dark:text-slate-100">{num(node.achievementPercent)}%</p>
              <p className="text-[10px] font-bold text-slate-400">
                {node.bandLabel || '—'}{node.factor != null ? ` · ×${node.factor.toFixed(2)}` : ''}
              </p>
            </div>
          )}

          <span className={cn('shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest', status.className)}>
            {status.label}
          </span>

          {!weightOk && (
            <span title={`Tổng trọng số ${num(node.totalWeight)}% — phải đủ 100% mới trình duyệt được`}>
              <AlertTriangle size={13} className="text-amber-500 shrink-0" />
            </span>
          )}
        </div>

        {isSelected && (
          <div className="px-3 pb-3 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {canManage && scorecardById.has(node.id) && (
                <ActionButton icon={<GitBranch size={12} />} label="Phân rã xuống đơn vị"
                  onClick={() => onCascade(scorecardById.get(node.id)!)} />
              )}
              {canEdit && node.status === BscScorecardStatus.DRAFT && (
                <ActionButton icon={<Send size={12} />} label="Trình duyệt"
                  pending={submitScorecard.isPending}
                  onClick={() => submitScorecard.mutate(node.id)} />
              )}
              {canApprove && node.status === BscScorecardStatus.SUBMITTED && (
                <>
                  <ActionButton icon={<Check size={12} />} label="Duyệt" accent="emerald"
                    pending={approveScorecard.isPending}
                    onClick={() => approveScorecard.mutate(node.id)} />
                  <ActionButton icon={<Undo2 size={12} />} label="Trả lại" accent="amber"
                    pending={rejectScorecard.isPending}
                    onClick={() => {
                      const reason = window.prompt('Lý do trả lại (bắt buộc — đơn vị cần biết phải sửa gì):')
                      if (reason && reason.trim()) rejectScorecard.mutate({ scorecardId: node.id, reason: reason.trim() })
                    }} />
                </>
              )}
              {canApprove && node.status === BscScorecardStatus.APPROVED && (
                <ActionButton icon={<Check size={12} />} label="Áp dụng" accent="emerald"
                  pending={activateScorecard.isPending}
                  onClick={() => activateScorecard.mutate(node.id)} />
              )}
              {canApprove && (node.status === BscScorecardStatus.ACTIVE || node.status === BscScorecardStatus.CLOSED) && (
                <ActionButton icon={<Lock size={12} />} label="Khoá"
                  pending={lockScorecard.isPending}
                  onClick={() => lockScorecard.mutate(node.id)} />
              )}
              {canApprove && node.status === BscScorecardStatus.LOCKED && (
                <ActionButton icon={<Undo2 size={12} />} label="Mở khoá"
                  pending={reopenScorecard.isPending}
                  onClick={() => reopenScorecard.mutate(node.id)} />
              )}
            </div>

            <CoveragePanel scorecardId={node.id} />
            {periodId && <UnitResultPanel scorecardId={node.id} kpiPeriodId={periodId} canManageUnit={canEdit} />}
          </div>
        )}
      </div>

      {isOpen && node.children.map(child => (
        <div key={child.id} className="mt-2">
          <TreeNode node={child} depth={depth + 1}
            expanded={expanded} onToggle={onToggle}
            selectedId={selectedId} onSelect={onSelect}
            scorecardById={scorecardById} onCascade={onCascade}
            periodId={periodId}
            canManage={canManage} canApprove={canApprove} canEditNode={canEditNode} />
        </div>
      ))}
    </div>
  )
}

function ActionButton({ icon, label, onClick, pending, accent }: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  pending?: boolean
  accent?: 'emerald' | 'amber'
}) {
  return (
    <button onClick={onClick} disabled={pending}
      className={cn('inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-colors disabled:opacity-40',
        accent === 'emerald' && 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30',
        accent === 'amber' && 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30',
        !accent && 'text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30')}>
      {pending ? <Loader2 size={12} className="animate-spin" /> : icon}
      {label}
    </button>
  )
}

/** Độ phủ: chỉ tiêu nào đã phân rã đủ xuống cấp dưới, chỉ tiêu nào còn thiếu. */
function CoveragePanel({ scorecardId }: { scorecardId: string }) {
  const { data, isLoading } = useScorecardCoverage(scorecardId)
  if (isLoading) return <div className="text-[11px] font-bold text-slate-400 px-1">Đang tải độ phủ...</div>
  if (!data || data.items.length === 0) return null

  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
        <span>Độ phủ phân rã</span>
        <span className="text-slate-300">·</span>
        <span>{data.okCount} đủ</span>
        {data.underCount > 0 && <span className="text-amber-600">{data.underCount} thiếu</span>}
        {data.overCount > 0 && <span className="text-sky-600">{data.overCount} vượt</span>}
        {data.notCascadedCount > 0 && <span>{data.notCascadedCount} chưa phân rã</span>}
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {data.items.map(item => {
          const meta = COVERAGE_META[item.status] ?? COVERAGE_META.OK!
          return (
            <div key={item.scorecardPerspectiveId} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color || '#8b5cf6' }} />
                <span className="flex-1 text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{item.name}</span>
                {item.targetValue != null && (
                  <span className="text-[10px] font-bold text-slate-400">
                    {(item.cascadedValue ?? 0).toLocaleString('vi-VN')} / {item.targetValue.toLocaleString('vi-VN')}
                    {item.unit ? ` ${item.unit}` : ''}
                  </span>
                )}
                <span className={cn('text-[10px] font-black uppercase', meta.className)}>{meta.label}</span>
              </div>
              {item.children.length > 0 && (
                <div className="mt-1 ml-4 flex flex-wrap gap-1">
                  {item.children.map(c => (
                    <span key={c.scorecardPerspectiveId}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {c.orgUnitName || c.scorecardName}
                      {c.contributionValue != null && `: ${c.contributionValue.toLocaleString('vi-VN')}`}
                      {c.linkType && c.linkType !== 'SUM' && ` · ${c.linkType}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Kết quả BSC của đơn vị trong một đợt — con số dùng để tra hệ số cho điểm cá nhân. */
function UnitResultPanel({ scorecardId, kpiPeriodId, canManageUnit }: {
  scorecardId: string
  kpiPeriodId: string
  canManageUnit: boolean
}) {
  const { data, isLoading } = useUnitResult(scorecardId, kpiPeriodId)
  const { recompute, finalize, reopen, setManualActual } = useUnitResultMutations()
  const isDraft = data?.status === BscUnitResultStatus.DRAFT

  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex-1">Kết quả BSC của đợt</span>
        {canManageUnit && (
          <>
            <button onClick={() => recompute.mutate({ scorecardId, kpiPeriodId })} disabled={recompute.isPending}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-40">
              {recompute.isPending ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
              Tính lại
            </button>
            {data && isDraft && (
              <button onClick={() => finalize.mutate({ scorecardId, kpiPeriodId })} disabled={finalize.isPending}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 disabled:opacity-40">
                <Check size={11} /> Chốt
              </button>
            )}
            {data && !isDraft && (
              <button onClick={() => reopen.mutate({ scorecardId, kpiPeriodId })} disabled={reopen.isPending}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40">
                <Undo2 size={11} /> Mở khoá
              </button>
            )}
          </>
        )}
      </div>

      {isLoading && <div className="px-3 py-3 text-[11px] font-bold text-slate-400">Đang tải...</div>}

      {!isLoading && !data && (
        <div className="px-3 py-3 text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
          <Calculator size={12} />
          Chưa tính lần nào cho đợt này.
        </div>
      )}

      {data && (
        <>
          <div className="px-3 py-2.5 flex items-baseline gap-3 border-b border-slate-100 dark:border-slate-800">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{num(data.achievementPercent)}%</span>
            <span className="text-[11px] font-bold text-slate-400">
              {data.bandLabel || 'chưa xếp dải'}
              {data.factor != null && ` → hệ số ×${data.factor.toFixed(2)}`}
            </span>
            <span className="flex-1" />
            {data.status !== BscUnitResultStatus.DRAFT && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600">
                <Lock size={10} /> Đã chốt
              </span>
            )}
          </div>

          {data.items.length > 0
            && data.items.every(i => i.measurementSource === BscMeasurementSource.ROLLUP && !i.kpiCount) && (
            <div className="px-3 py-2 bg-amber-50/60 dark:bg-amber-950/20 text-[10px] font-bold text-amber-700 dark:text-amber-400">
              Mọi chỉ tiêu đang lấy số <b>tự cộng từ KPI</b> mà chưa KPI nào gắn vào, nên chưa ra kết quả.
              Mở bộ tiêu chí → bấm nút 🎯 trên dòng chỉ tiêu → đổi <b>Nguồn kết quả đơn vị</b> sang <b>Nhập tay</b>
              nếu muốn tự điền con số của cả đơn vị.
            </div>
          )}

          {data.gatePassed === false && (
            <div className="px-3 py-2 bg-red-50/60 dark:bg-red-950/20 text-[11px] font-bold text-red-600 dark:text-red-400 flex items-start gap-1.5">
              <ShieldAlert size={12} className="mt-0.5 shrink-0" />
              <span>Hạng mục chặn không đạt: {data.gateFailedItems}</span>
            </div>
          )}

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.items.map(item => (
              <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color || '#8b5cf6' }} />
                <span className="flex-1 text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                  {item.name}
                  {item.isGate && (
                    <span className={cn('ml-1.5 text-[9px] font-black uppercase',
                      item.gatePassed === false ? 'text-red-500' : 'text-slate-400')}>· chặn</span>
                  )}
                </span>
                {item.measurementSource === BscMeasurementSource.ROLLUP ? (
                  // Chỉ đọc là CÓ CHỦ Ý: số của dòng này do hệ thống cộng từ KPI cá nhân. Nhưng ô
                  // trơ ra mà không nói gì thì người dùng tưởng giao diện hỏng — nên ghi luôn số
                  // KPI đang gắn, và tô cảnh báo khi con số đó là 0 (nguyên nhân duy nhất khiến
                  // chỉ tiêu mãi không có kết quả).
                  <span
                    title={item.kpiCount
                      ? `Tự cộng từ ${item.kpiCount} KPI cá nhân đang gắn vào chỉ tiêu này. Muốn tự điền thì đổi Nguồn kết quả đơn vị sang "Nhập tay" trong cấu hình chỉ tiêu.`
                      : 'Chưa có KPI cá nhân nào gắn vào chỉ tiêu này nên không cộng ra số nào. Gắn KPI vào chỉ tiêu, hoặc đổi Nguồn kết quả đơn vị sang "Nhập tay" trong cấu hình chỉ tiêu.'}
                    className={cn('text-[10px] font-bold tabular-nums cursor-help',
                      item.kpiCount ? 'text-slate-400' : 'text-amber-500')}>
                    {item.actualValue == null ? '—' : item.actualValue.toLocaleString('vi-VN')}
                    {item.targetValue != null && ` / ${item.targetValue.toLocaleString('vi-VN')}`}
                    {` · ${item.kpiCount ?? 0} KPI`}
                  </span>
                ) : (
                  <input type="number" step="any" defaultValue={item.actualValue ?? ''}
                    disabled={!canManageUnit || !isDraft}
                    onBlur={e => {
                      const raw = e.target.value.trim()
                      const next = raw === '' ? null : Number(raw)
                      if (next !== (item.actualValue ?? null)) {
                        setManualActual.mutate({ scorecardId, itemId: item.id, kpiPeriodId, actualValue: next })
                      }
                    }}
                    placeholder="Nhập tay"
                    className="w-24 px-2 py-1 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-[11px] font-bold text-right outline-none disabled:opacity-50 focus:placeholder:text-transparent" />
                )}
                <span className="w-10 text-right text-[10px] font-bold text-slate-400">{num(item.weightPercentage, 0)}%</span>
                <span className="w-14 text-right text-xs font-black text-slate-700 dark:text-slate-200">
                  {num(item.achievementPercent)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
