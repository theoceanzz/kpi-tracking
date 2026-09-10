import { useMemo, useState } from 'react'
import {
  ChevronDown, ChevronRight, GitBranch, Lock, ShieldAlert, Building2, Users, Search,
  Send, Check, Undo2, RefreshCw, Loader2, AlertTriangle, Calculator, Target, Layers,
  Edit2, Trash2, PlusCircle, ShieldCheck, ListTree, Link2, Unlink,
} from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import {
  useScorecardTree, useScorecardCoverage, useCascadeMutations,
  useUnitResult, useUnitResultMutations,
} from '../hooks/useBscCascade'
import {
  BscScorecardLevel, BscScorecardStatus, BscScoringMode, BscUnitResultStatus, BscMeasurementSource,
  type BscFixedPerspective, type FixedPerspectiveResponse, type ScorecardPeriodResponse,
  type ScorecardTreeNodeResponse, type ScorecardResponse,
} from '../types'
import { scorecardStatusMeta } from '../utils/scorecardStatus'
import AttachParentModal from './AttachParentModal'
import RejectScorecardModal from './RejectScorecardModal'

interface BscScorecardTreeProps {
  organizationId?: string
  scorecards?: ScorecardResponse[]
  fixedPerspectives: FixedPerspectiveResponse[]
  canPublish: boolean
  /**
   * Người đang xem có thao tác được với bộ tiêu chí này không.
   *
   * Nhận từ trang cha thay vì tự suy: quyền phải tính THEO TỪNG THẺ (đơn vị nào giữ thẻ đó), không
   * phải một cờ chung cho cả cây — trưởng đơn vị này không được sửa hay trình duyệt thẻ của đơn vị khác.
   */
  canEditScorecard: (scorecard: ScorecardResponse) => boolean
  onCascade: (scorecard: ScorecardResponse) => void
  onEdit: (scorecard: ScorecardResponse) => void
  onDelete: (scorecard: ScorecardResponse) => void
  onTogglePublish: (scorecard: ScorecardResponse) => void
  onAddPerspective: (scorecard: ScorecardResponse, code: BscFixedPerspective) => void
}

const COVERAGE_META: Record<string, { label: string; className: string; hint: string }> = {
  NOT_CASCADED: {
    label: 'Chưa giao',
    className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    hint: 'Chưa đơn vị nào được giao chỉ tiêu này',
  },
  UNDER: {
    label: 'Còn thiếu',
    className: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
    hint: 'Tổng mức giao cho các đơn vị còn thấp hơn mục tiêu của cấp này',
  },
  OK: {
    label: 'Đủ',
    className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    hint: 'Tổng mức giao cho các đơn vị khớp mục tiêu của cấp này',
  },
  OVER: {
    label: 'Giao vượt',
    className: 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400',
    hint: 'Tổng mức giao cho các đơn vị cao hơn mục tiêu — cố ý để dự phòng thì không sao',
  },
}

const num = (v?: number | null, d = 1) => (v == null ? '—' : v.toFixed(d))

/** Giữ lại nhánh nào có node khớp từ khoá — cha của node khớp vẫn phải hiện để còn đường đi tới nó. */
function filterTree(nodes: ScorecardTreeNodeResponse[], q: string): ScorecardTreeNodeResponse[] {
  if (!q.trim()) return nodes
  const needle = q.trim().toLowerCase()
  const walk = (list: ScorecardTreeNodeResponse[]): ScorecardTreeNodeResponse[] =>
    list.flatMap(n => {
      const children = walk(n.children)
      const hit = `${n.name} ${n.orgUnitName ?? ''} ${n.periodLabel ?? ''}`.toLowerCase().includes(needle)
      return hit || children.length > 0 ? [{ ...n, children }] : []
    })
  return walk(nodes)
}

/**
 * MỘT màn hình duy nhất cho BSC: cây Công ty → Đơn vị, mở một nhánh ra là làm được mọi việc với
 * bộ tiêu chí đó (hạng mục & trọng số, độ phủ phân rã, kết quả của đợt, vòng đời trình–duyệt).
 *
 * <p>Trước đây đây là HAI tab: "Danh sách bộ tiêu chí" và "Cây phân rã". Hai tab hiện gần như cùng
 * một dữ liệu — cùng tên thẻ, cùng trạng thái, cùng tổng trọng số — chỉ khác chỗ đặt nút, nên người
 * dùng phải nhớ "sửa hạng mục thì ở tab kia, trình duyệt thì ở tab này". Gộp lại: cây là khung nhìn
 * chính (thấy được quan hệ cha–con, thứ mà danh sách phẳng không diễn tả nổi), còn phần chi tiết của
 * mỗi nhánh chia thành ba mục nhỏ để không đổ hết mọi thứ ra cùng lúc.
 */
export default function BscScorecardTree({
  organizationId, scorecards, fixedPerspectives, canPublish, canEditScorecard,
  onCascade, onEdit, onDelete, onTogglePublish, onAddPerspective,
}: BscScorecardTreeProps) {
  const { hasPermission } = usePermission()
  const canManage = hasPermission('BSC:MANAGE')
  const canApprove = hasPermission('BSC:APPROVE')

  // KHÔNG có bộ lọc đợt ở đây nữa: đợt là chuyện của TỪNG bộ tiêu chí (mỗi thẻ gắn đợt riêng),
  // nên nó nằm trong mục "Kết quả đợt" của chính nhánh đó — bấm vào là ra số luôn, không phải
  // chọn trước ở thanh trên rồi mới có gì để xem.
  const { data: tree, isLoading } = useScorecardTree(organizationId)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const scorecardById = useMemo(
    () => new Map((scorecards || []).map(s => [s.id, s])),
    [scorecards],
  )

  const visible = useMemo(() => filterTree(tree || [], query), [tree, query])

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
      {/* ── Thanh công cụ ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-[28rem]">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Tìm bộ tiêu chí, đơn vị..."
            className="w-full h-11 pl-11 pr-4 rounded-2xl bg-white dark:bg-slate-900 border border-[var(--color-border)] text-sm font-bold outline-none focus:border-indigo-300 dark:focus:border-indigo-700 focus:placeholder:text-transparent"
          />
        </div>

        <p className="text-[11px] font-bold text-slate-400 flex-1 min-w-[16rem]">
          Bấm vào một bộ tiêu chí để mở hạng mục, độ phủ phân rã và kết quả của đợt.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-10 text-slate-400">
          <Loader2 size={20} className="animate-spin" />
        </div>
      )}

      {!isLoading && (!tree || tree.length === 0) && (
        <div className="flex flex-col items-center justify-center p-16 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 mb-4">
            <Target size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Chưa có bộ tiêu chí nào</h3>
          <p className="text-slate-500 max-w-md mt-2 text-sm">
            Bấm <b>"+ Bộ tiêu chí mới"</b> để tạo bộ tiêu chí cho một kỳ (theo phòng ban hoặc toàn tổ chức).
            Ngay trong đó bạn thêm được hạng mục vào 4 lĩnh vực và chia trọng số cho đủ 100%.
          </p>
        </div>
      )}

      {!isLoading && (tree || []).length > 0 && visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center">
          <p className="text-sm font-bold text-slate-400">Không có bộ tiêu chí nào khớp "{query}".</p>
        </div>
      )}

      <div className="space-y-2">
        {visible.map(node => (
          <TreeNode key={node.id} node={node} depth={0} isRoot
            expanded={expanded} onToggle={toggle} forceOpen={!!query.trim()}
            openId={openId} onOpen={setOpenId}
            scorecardById={scorecardById} fixedPerspectives={fixedPerspectives}
            canManage={canManage} canApprove={canApprove} canPublish={canPublish}
            canEditNode={canEditNode}
            onCascade={onCascade} onEdit={onEdit} onDelete={onDelete}
            onTogglePublish={onTogglePublish} onAddPerspective={onAddPerspective} />
        ))}
      </div>
    </div>
  )
}

interface TreeNodeProps {
  node: ScorecardTreeNodeResponse
  depth: number
  isRoot?: boolean
  expanded: Record<string, boolean>
  onToggle: (id: string) => void
  /** Đang tìm kiếm thì mở hết nhánh, nếu không kết quả khớp nằm khuất trong nhánh đang thu gọn. */
  forceOpen: boolean
  openId: string | null
  onOpen: (id: string | null) => void
  scorecardById: Map<string, ScorecardResponse>
  fixedPerspectives: FixedPerspectiveResponse[]
  canManage: boolean
  canApprove: boolean
  canPublish: boolean
  canEditNode: (scorecardId: string) => boolean
  onCascade: (s: ScorecardResponse) => void
  onEdit: (s: ScorecardResponse) => void
  onDelete: (s: ScorecardResponse) => void
  onTogglePublish: (s: ScorecardResponse) => void
  onAddPerspective: (s: ScorecardResponse, code: BscFixedPerspective) => void
}

function TreeNode(props: TreeNodeProps) {
  const {
    node, depth, isRoot, expanded, onToggle, forceOpen, openId, onOpen,
    scorecardById, canEditNode,
  } = props

  const childrenOpen = forceOpen || (expanded[node.id] ?? depth === 0)
  const isDetailOpen = openId === node.id
  const status = scorecardStatusMeta(node.status)
  const sc = scorecardById.get(node.id)
  const canEdit = canEditNode(node.id)
  const selfCount = node.itemCount - node.assignedCount
  const weightOk = Math.abs(node.totalWeight - 100) <= 0.01
  const isCompany = node.level === BscScorecardLevel.COMPANY

  return (
    <div>
      <div className={cn(
        isRoot && 'tour-bsc-scorecard-card',
        'rounded-2xl border bg-white dark:bg-slate-900 transition-all',
        isDetailOpen
          ? 'border-indigo-300 dark:border-indigo-700 shadow-lg shadow-indigo-500/5'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700')}>

        <div className="flex items-center gap-2 px-3 py-2.5">
          <button onClick={() => onToggle(node.id)}
            title={childrenOpen ? 'Ẩn đơn vị con' : 'Hiện đơn vị con'}
            className={cn('p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0',
              node.children.length === 0 && 'invisible')}>
            {childrenOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white',
            isCompany ? 'bg-indigo-600' : 'bg-slate-400 dark:bg-slate-600')}>
            {isCompany ? <Building2 size={15} /> : <Users size={15} />}
          </div>

          <button onClick={() => onOpen(isDetailOpen ? null : node.id)} className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{node.name}</span>
              <span className={cn('px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest', status.badgeClass)}>
                {status.label}
              </span>
              {sc?.scoringMode === BscScoringMode.OFFICIAL && (
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                  Chính thức
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
              {isCompany ? 'BSC công ty' : node.orgUnitName || 'BSC đơn vị'}
              {node.periodLabel ? ` · ${node.periodLabel}` : ''}
              {' · '}{node.itemCount} hạng mục
              {node.assignedCount > 0 && ` (${node.assignedCount} cấp trên giao, ${selfCount} tự thêm)`}
              {node.gateCount > 0 && ` · ${node.gateCount} chặn`}
              {' · '}
              <span className={weightOk ? 'text-emerald-600' : 'text-red-500'}>
                trọng số {num(node.totalWeight)}%
              </span>
            </p>
          </button>

          {!weightOk && (
            <span title={`Tổng trọng số ${num(node.totalWeight)}% — phải đủ 100% mới trình duyệt được`}>
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
            </span>
          )}

          {!canEdit && (
            // Vẫn xem được nội dung, chỉ không sửa. Nói lý do ngay ở đây để khỏi đi tìm nút đã bị ẩn.
            <span title="Bộ tiêu chí của đơn vị khác — bạn xem được nhưng không sửa"
              className="text-slate-300 dark:text-slate-600 shrink-0"><Lock size={14} /></span>
          )}

          {/* Thao tác đứng ngay cạnh tên thẻ: sửa bộ tiêu chí hay trình duyệt là việc làm với CHÍNH
              nhánh này, bắt mở chi tiết ra mới thấy nút thì thêm một cú bấm cho mọi thao tác. */}
          <NodeActions {...props} scorecard={sc} canEdit={canEdit} />

          <button onClick={() => onOpen(isDetailOpen ? null : node.id)}
            title={isDetailOpen ? 'Đóng chi tiết' : 'Mở chi tiết'}
            className={cn('p-1.5 rounded-lg shrink-0 transition-colors',
              isDetailOpen
                ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'
                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800')}>
            {isDetailOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {isDetailOpen && <NodeDetail {...props} scorecard={sc} canEdit={canEdit} />}
      </div>

      {childrenOpen && node.children.length > 0 && (
        // Đường kẻ dọc thay cho thụt lề bằng margin: nhìn ra ngay nhánh nào thuộc nhánh nào.
        <div className="ml-[26px] mt-2 pl-4 border-l border-dashed border-slate-200 dark:border-slate-700 space-y-2">
          {node.children.map(child => (
            <TreeNode key={child.id} {...props} node={child} depth={depth + 1} isRoot={false} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Ba việc làm với một nhánh, tách mục để không đổ hết ra cùng lúc và chỉ tải thứ đang xem. */
function NodeDetail({
  node, scorecard: sc, fixedPerspectives, canEdit, canManage, onCascade, onAddPerspective,
}: TreeNodeProps & { scorecard?: ScorecardResponse; canEdit: boolean }) {
  const [tab, setTab] = useState<'items' | 'coverage' | 'result'>('items')

  return (
    <div className="px-3 pb-3 space-y-3 border-t border-slate-100 dark:border-slate-800 pt-3 animate-in slide-in-from-top-1 duration-200">
      {sc?.vision && <p className="text-xs text-slate-500 italic px-1">"{sc.vision}"</p>}

      {/* ── Ba mục chi tiết ───────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 w-fit">
        {([
          { key: 'items' as const, label: 'Hạng mục & trọng số', icon: <Layers size={12} /> },
          { key: 'coverage' as const, label: 'Độ phủ phân rã', icon: <ListTree size={12} /> },
          { key: 'result' as const, label: 'Kết quả đợt', icon: <Calculator size={12} /> },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black transition-colors',
              tab === t.key
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300')}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'items' && (
        <PerspectivePanel scorecard={sc} fixedPerspectives={fixedPerspectives}
          canEdit={canEdit} onAddPerspective={onAddPerspective} />
      )}
      {tab === 'coverage' && (
        <CoveragePanel scorecardId={node.id} scorecard={sc}
          canCascade={canManage} onCascade={onCascade} />
      )}
      {tab === 'result' && (
        <UnitResultTab scorecardId={node.id} periods={sc?.periods ?? []} canManageUnit={canEdit} />
      )}
    </div>
  )
}

/**
 * Kết quả của nhánh này, hiện NGAY khi mở mục — đợt lấy từ chính bộ tiêu chí chứ không bắt chọn
 * trước ở đâu khác. Mặc định là đợt CUỐI trong danh sách (backend trả theo ngày bắt đầu tăng dần,
 * nên đó là đợt gần hiện tại nhất); còn nhiều đợt thì đổi ngay trong bảng kết quả.
 */
function UnitResultTab({ scorecardId, periods, canManageUnit }: {
  scorecardId: string
  periods: ScorecardPeriodResponse[]
  canManageUnit: boolean
}) {
  const [periodId, setPeriodId] = useState(() => periods[periods.length - 1]?.id ?? '')
  const period = periods.find(p => p.id === periodId)

  if (periods.length === 0 || !periodId) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-5 text-center">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-300">Bộ tiêu chí này chưa gắn đợt nào</p>
        <p className="text-[11px] font-medium text-slate-400 mt-1">
          Mở <b>Sửa bộ tiêu chí</b> để gắn kỳ hoặc đợt, rồi quay lại đây tính kết quả.
        </p>
      </div>
    )
  }

  return (
    <UnitResultPanel
      scorecardId={scorecardId}
      kpiPeriodId={periodId}
      periodName={period?.name || 'đợt này'}
      periods={periods}
      onChangePeriod={setPeriodId}
      canManageUnit={canManageUnit}
    />
  )
}

/**
 * Thao tác của một nhánh, dạng biểu tượng để đứng vừa trên hàng tiêu đề.
 *
 * <p>Cùng bộ nút với trước đây, chỉ đổi chỗ: nhãn đầy đủ nằm ở tooltip. Nút nào hiện phụ thuộc
 * trạng thái của thẻ và quyền của người xem — không có gì hiện thì hàng vẫn thẳng vì cả cụm co lại.
 */
function NodeActions({
  node, scorecard: sc, scorecardById, canEdit, canManage, canApprove, canPublish,
  onCascade, onEdit, onDelete, onTogglePublish,
}: TreeNodeProps & { scorecard?: ScorecardResponse; canEdit: boolean }) {
  const {
    submitScorecard, approveScorecard, rejectScorecard, activateScorecard, lockScorecard, reopenScorecard,
    attachParent,
  } = useCascadeMutations()
  const [attachOpen, setAttachOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)

  // Thẻ mồ côi: đơn vị tự dựng trước khi cấp trên phân rã nên chưa nằm trong nhánh nào.
  const isOrphan = !!sc && !sc.parentScorecardId && node.level !== BscScorecardLevel.COMPANY

  /**
   * Nút gom theo VIỆC, mỗi nhóm cách nhau một vạch dọc: sửa nội dung · dựng cây · vòng đời
   * trình–duyệt · chế độ chấm · xoá. Một hàng 6–7 biểu tượng đều tăm tắp thì mắt phải đọc từng
   * tooltip mới biết cái nào là cái mình cần; chia khối là nhận ra ngay vùng cần nhìn.
   *
   * Nhóm rỗng (quyền không đủ, hoặc trạng thái không cho phép) bị loại trước khi vẽ, nên không
   * bao giờ có vạch dọc mồ côi ở đầu hay cuối hàng.
   */
  const groups: React.ReactNode[][] = [
    // Sửa nội dung bộ tiêu chí
    [
      canEdit && sc && (
        <IconAction key="edit" icon={<Edit2 size={14} />} label="Sửa bộ tiêu chí" onClick={() => onEdit(sc)} />
      ),
    ],
    // Dựng cây: giao chỉ tiêu xuống, gắn/gỡ nhánh
    [
      canManage && sc && (
        <IconAction key="cascade" icon={<GitBranch size={14} />} label="Phân rã xuống đơn vị"
          onClick={() => onCascade(sc)} />
      ),
      canManage && isOrphan && (
        <IconAction key="attach" icon={<Link2 size={14} />} label="Gắn vào bộ tiêu chí cấp trên"
          onClick={() => setAttachOpen(true)} />
      ),
      canManage && sc?.parentScorecardId && (
        <IconAction key="detach" icon={<Unlink size={14} />} label="Gỡ khỏi cây (thành bộ tiêu chí độc lập)"
          pending={attachParent.isPending}
          onClick={() => attachParent.mutate({ scorecardId: sc.id, parentScorecardId: null })} />
      ),
    ],
    // Vòng đời trình – duyệt
    [
      canEdit && node.status === BscScorecardStatus.DRAFT && (
        <IconAction key="submit" icon={<Send size={14} />} label="Trình duyệt"
          pending={submitScorecard.isPending}
          onClick={() => submitScorecard.mutate(node.id)} />
      ),
      canApprove && node.status === BscScorecardStatus.SUBMITTED && (
        <IconAction key="approve" icon={<Check size={14} />} label="Duyệt" accent="emerald"
          pending={approveScorecard.isPending}
          onClick={() => approveScorecard.mutate(node.id)} />
      ),
      canApprove && node.status === BscScorecardStatus.SUBMITTED && (
        <IconAction key="reject" icon={<Undo2 size={14} />} label="Trả lại để sửa" accent="amber"
          pending={rejectScorecard.isPending}
          onClick={() => setRejectOpen(true)} />
      ),
      // Duyệt là áp dụng luôn, nên nút này chỉ còn cho hai trường hợp: thẻ đã đóng muốn mở lại,
      // và thẻ cũ còn kẹt ở "Đã duyệt" từ thời luồng cũ.
      canApprove && (node.status === BscScorecardStatus.APPROVED || node.status === BscScorecardStatus.CLOSED) && (
        <IconAction key="activate" icon={<Check size={14} />} label="Áp dụng" accent="emerald"
          pending={activateScorecard.isPending}
          onClick={() => activateScorecard.mutate(node.id)} />
      ),
      canApprove && node.status === BscScorecardStatus.ACTIVE && (
        <IconAction key="lock" icon={<Lock size={14} />} label="Khoá bộ tiêu chí"
          pending={lockScorecard.isPending}
          onClick={() => lockScorecard.mutate(node.id)} />
      ),
      canApprove && node.status === BscScorecardStatus.LOCKED && (
        <IconAction key="reopen" icon={<Undo2 size={14} />} label="Mở khoá"
          pending={reopenScorecard.isPending}
          onClick={() => reopenScorecard.mutate(node.id)} />
      ),
    ],
    // Chế độ chấm điểm
    [
      canPublish && sc && (
        <IconAction key="publish"
          icon={sc.scoringMode === BscScoringMode.SHADOW ? <ShieldCheck size={14} /> : <Undo2 size={14} />}
          label={sc.scoringMode === BscScoringMode.SHADOW ? 'Chuyển chấm chính thức' : 'Đưa về chạy song song'}
          onClick={() => onTogglePublish(sc)} />
      ),
    ],
    // Xoá — đứng riêng cuối hàng để không bấm nhầm khi đang thao tác việc khác
    [
      canEdit && sc && (
        <IconAction key="delete" icon={<Trash2 size={14} />} label="Xoá bộ tiêu chí" accent="red"
          onClick={() => onDelete(sc)} />
      ),
    ],
  ].map(group => group.filter(Boolean)).filter(group => group.length > 0)

  return (
    <div className="flex items-center shrink-0">
      {groups.map((group, index) => (
        <div key={index} className="flex items-center gap-0.5">
          {index > 0 && <span className="w-px h-4 mx-1.5 bg-slate-200 dark:bg-slate-700 shrink-0" />}
          {group}
        </div>
      ))}

      {rejectOpen && (
        <RejectScorecardModal
          open
          onClose={() => setRejectOpen(false)}
          scorecardName={node.name}
          pending={rejectScorecard.isPending}
          onSubmit={reason => rejectScorecard.mutate(
            { scorecardId: node.id, reason },
            { onSuccess: () => setRejectOpen(false) },
          )}
        />
      )}

      {sc && attachOpen && (
        <AttachParentModal
          open
          onClose={() => setAttachOpen(false)}
          scorecard={sc}
          all={[...scorecardById.values()]}
          pending={attachParent.isPending}
          onSubmit={(parentScorecardId, linkItems) => attachParent.mutate(
            { scorecardId: sc.id, parentScorecardId, linkItems },
            { onSuccess: () => setAttachOpen(false) },
          )}
        />
      )}
    </div>
  )
}

function IconAction({ icon, label, onClick, pending, accent }: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  pending?: boolean
  accent?: 'emerald' | 'amber' | 'red'
}) {
  return (
    <button onClick={onClick} disabled={pending} title={label} aria-label={label}
      className={cn('p-1.5 rounded-lg transition-colors disabled:opacity-40 text-slate-400',
        accent === 'emerald' && 'hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30',
        accent === 'amber' && 'hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30',
        accent === 'red' && 'hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30',
        !accent && 'hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30')}>
      {pending ? <Loader2 size={14} className="animate-spin" /> : icon}
    </button>
  )
}

/** Hạng mục của bộ tiêu chí, gom theo 4 lĩnh vực cố định — chỗ chia trọng số cho đủ 100%. */
function PerspectivePanel({ scorecard: sc, fixedPerspectives, canEdit, onAddPerspective }: {
  scorecard?: ScorecardResponse
  fixedPerspectives: FixedPerspectiveResponse[]
  canEdit: boolean
  onAddPerspective: (s: ScorecardResponse, code: BscFixedPerspective) => void
}) {
  if (!sc) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 px-3 py-4 text-[11px] font-bold text-slate-400">
        Không đọc được chi tiết bộ tiêu chí này (có thể nằm ngoài phạm vi của bạn).
      </div>
    )
  }

  const totalWeight = sc.perspectives.reduce((s, p) => s + (p.weightPercentage || 0), 0)
  const weightOk = Math.abs(totalWeight - 100) <= 0.01

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          {sc.perspectives.length} hạng mục
        </span>
        <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-md uppercase',
          weightOk ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
            : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400')}>
          Tổng trọng số {totalWeight.toFixed(1)}%
        </span>
      </div>

      {fixedPerspectives.map(fp => {
        const items = sc.perspectives
          .filter(p => p.fixedPerspective === fp.code)
          .sort((a, b) => a.displayOrder - b.displayOrder)
        const groupWeight = items.reduce((s, p) => s + (p.weightPercentage || 0), 0)
        return (
          <div key={fp.code} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: fp.color }} />
              <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{fp.name}</h4>
              <span className="text-[10px] font-bold text-slate-400">{groupWeight.toFixed(1)}%</span>
              {/* Thêm hạng mục là SỬA bộ tiêu chí — cùng một quyền với nút "Sửa bộ tiêu chí" ở trên,
                  nên phải ẩn theo cùng điều kiện, không thì mở nhánh của đơn vị khác vẫn thêm được. */}
              {canEdit && (
                <button onClick={() => onAddPerspective(sc, fp.code)}
                  className="ml-auto inline-flex items-center gap-1.5 px-2 py-1 rounded-xl text-[11px] font-black text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors shrink-0">
                  <PlusCircle size={12} /> Thêm hạng mục
                </button>
              )}
            </div>

            <div className="grid gap-1.5">
              {items.map(p => (
                <div key={p.id} className="bg-slate-50/70 dark:bg-slate-800/40 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${p.color || '#8b5cf6'}1a`, color: p.color || '#8b5cf6' }}>
                    <Layers size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{p.name}</p>
                    <span className="text-[10px] font-black text-slate-400 uppercase">{p.code}</span>
                    {(p.targetValue != null || p.minimumValue != null) && (
                      <span className="text-[10px] font-bold text-slate-400 ml-2">
                        {p.targetValue != null && <>Mục tiêu {p.targetValue}{p.unit ? ` ${p.unit}` : ''}</>}
                        {p.targetValue != null && p.minimumValue != null && ' · '}
                        {p.minimumValue != null && <>Tối thiểu {p.minimumValue}{p.unit ? ` ${p.unit}` : ''}</>}
                        {p.targetValue != null && p.targetValue > 0 && (
                          <span className="ml-1.5 text-indigo-500" title="Hạng mục tự chấm theo mục tiêu của chính nó (kiểu OKR)">· tự chấm</span>
                        )}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300 shrink-0">{p.weightPercentage}%</span>
                </div>
              ))}
              {items.length === 0 && (
                <div className="text-[11px] text-slate-400 italic px-3 py-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  Chưa có hạng mục nào thuộc lĩnh vực này.
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}


/**
 * Độ phủ phân rã: mỗi chỉ tiêu của thẻ này đã giao xuống đơn vị cấp dưới tới đâu.
 *
 * <p>Bảng cũ chỉ có tên chỉ tiêu và chữ "CHƯA PHÂN RÃ" bên phải — người đọc không biết "phân rã"
 * nghĩa là gì, cũng không có đường nào để làm tiếp. Ở đây thêm một câu định nghĩa, thanh tiến độ
 * cho thấy đã giao được mấy phần, và nút đi thẳng tới màn phân rã.
 */
function CoveragePanel({ scorecardId, scorecard: sc, canCascade, onCascade }: {
  scorecardId: string
  scorecard?: ScorecardResponse
  canCascade: boolean
  onCascade: (s: ScorecardResponse) => void
}) {
  const { data, isLoading } = useScorecardCoverage(scorecardId)

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 px-3 py-6 flex items-center justify-center text-slate-400">
        <Loader2 size={16} className="animate-spin" />
      </div>
    )
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-5 text-center">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-300">Chưa có chỉ tiêu nào để giao xuống</p>
        <p className="text-[11px] font-medium text-slate-400 mt-1">
          Thêm hạng mục ở mục <b>Hạng mục &amp; trọng số</b> trước, rồi quay lại đây giao cho các đơn vị.
        </p>
      </div>
    )
  }

  const total = data.items.length
  const done = data.okCount + data.overCount
  const cascadeButton = canCascade && sc && (
    <button onClick={() => onCascade(sc)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm">
      <GitBranch size={12} /> Phân rã xuống đơn vị
    </button>
  )

  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
      <div className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Độ phủ phân rã</span>
          <span className="text-xs font-black text-slate-700 dark:text-slate-200">
            {done}/{total} chỉ tiêu đã giao xuống đơn vị
          </span>
          <span className="flex-1" />
          {cascadeButton}
        </div>

        <p className="text-[11px] font-medium text-slate-400 leading-relaxed">
          Phân rã = chia chỉ tiêu của cấp này thành mức đóng góp cho từng đơn vị cấp dưới
          (VD: doanh thu 100 tỷ ⇒ phòng KD 60 tỷ, phòng Dự án 40 tỷ). Chỉ tiêu chưa giao thì cấp dưới
          không có gì để bám vào, và KPI cá nhân cũng không liên kết được vào BSC.
        </p>

        {/* Thanh tiến độ: nhìn phát biết còn bao nhiêu việc, không phải đếm dòng. */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all"
              style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
          </div>
          <div className="flex items-center gap-1.5">
            {data.okCount > 0 && <CoverageChip status="OK" count={data.okCount} />}
            {data.overCount > 0 && <CoverageChip status="OVER" count={data.overCount} />}
            {data.underCount > 0 && <CoverageChip status="UNDER" count={data.underCount} />}
            {data.notCascadedCount > 0 && <CoverageChip status="NOT_CASCADED" count={data.notCascadedCount} />}
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {data.items.map(item => {
          const meta = COVERAGE_META[item.status] ?? COVERAGE_META.OK!
          const cascaded = item.cascadedValue ?? 0
          return (
            <div key={item.scorecardPerspectiveId} className="px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color || '#8b5cf6' }} />
                <span className="flex-1 min-w-0 text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                  {item.name}
                </span>

                {item.targetValue != null ? (
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums text-right">
                    {cascaded.toLocaleString('vi-VN')} / {item.targetValue.toLocaleString('vi-VN')}
                    {item.unit ? ` ${item.unit}` : ''}
                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                      đã giao / mục tiêu
                    </span>
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-slate-400 text-right max-w-[10rem]">
                    chỉ tiêu chưa đặt mục tiêu số
                  </span>
                )}

                <span title={meta.hint}
                  className={cn('shrink-0 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest cursor-help',
                    meta.className)}>
                  {meta.label}
                </span>
              </div>

              {item.children.length > 0 ? (
                <div className="mt-1.5 ml-4 flex flex-wrap items-center gap-1">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mr-0.5">Đã giao cho</span>
                  {item.children.map(c => (
                    <span key={c.scorecardPerspectiveId}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {c.orgUnitName || c.scorecardName}
                      {c.contributionValue != null && `: ${c.contributionValue.toLocaleString('vi-VN')}`}
                      {c.linkType && c.linkType !== 'SUM' && ` · ${c.linkType}`}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 ml-4 text-[10px] font-medium text-slate-400">
                  Chưa giao cho đơn vị nào.
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CoverageChip({ status, count }: { status: string; count: number }) {
  const meta = COVERAGE_META[status] ?? COVERAGE_META.OK!
  return (
    <span title={meta.hint}
      className={cn('px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest cursor-help', meta.className)}>
      {count} {meta.label}
    </span>
  )
}

/**
 * Kết quả BSC của một đơn vị trong một đợt — theo dõi riêng, KHÔNG nhân vào điểm cá nhân.
 *
 * <p>Ba thứ khiến bảng cũ khó dùng, sửa hết ở đây: (1) chưa tính lần nào thì màn hình chỉ có dòng
 * chữ "Chưa tính lần nào" trong khi nút cần bấm là cái link "Tính lại" bé xíu ở góc — giờ là một
 * nút chính giữa khối, gọi đúng tên việc; (2) ba cột số bên phải không có tiêu đề nên không ai
 * đoán ra đâu là thực hiện, đâu là trọng số; (3) không nói đang xem đợt nào.
 */
function UnitResultPanel({ scorecardId, kpiPeriodId, periodName, periods, onChangePeriod, canManageUnit }: {
  scorecardId: string
  kpiPeriodId: string
  periodName: string
  periods: ScorecardPeriodResponse[]
  onChangePeriod: (id: string) => void
  canManageUnit: boolean
}) {
  const { data, isLoading } = useUnitResult(scorecardId, kpiPeriodId)
  const { recompute, finalize, reopen, setManualActual } = useUnitResultMutations()
  const isDraft = data?.status === BscUnitResultStatus.DRAFT
  const computing = recompute.isPending

  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
      {/* ── Đầu bảng: đợt đang xem + trạng thái + thao tác ───── */}
      <div className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Kết quả đợt</span>
        {periods.length > 1 ? (
          <Select value={kpiPeriodId} onValueChange={onChangePeriod}>
            <SelectTrigger className="h-8 w-48 text-xs font-bold"><SelectValue /></SelectTrigger>
            <SelectContent className="z-[1100]">
              {periods.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs font-black text-slate-700 dark:text-slate-200">{periodName}</span>
        )}

        {data && (
          <span className={cn('px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest',
            isDraft
              ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400')}>
            {isDraft ? 'Nháp' : 'Đã chốt'}
          </span>
        )}

        <span className="flex-1" />

        {canManageUnit && data && (
          <>
            <button onClick={() => recompute.mutate({ scorecardId, kpiPeriodId })}
              disabled={computing || !isDraft}
              title={isDraft ? 'Tính lại từ số liệu hiện tại' : 'Đã chốt — mở khoá trước khi tính lại'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40">
              {computing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Tính lại
            </button>
            {isDraft ? (
              <button onClick={() => finalize.mutate({ scorecardId, kpiPeriodId })} disabled={finalize.isPending}
                title="Chốt con số này — sau khi chốt phải mở khoá mới sửa được"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40">
                {finalize.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Chốt kết quả
              </button>
            ) : (
              <button onClick={() => reopen.mutate({ scorecardId, kpiPeriodId })} disabled={reopen.isPending}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40">
                <Undo2 size={12} /> Mở khoá để sửa
              </button>
            )}
          </>
        )}
      </div>

      {isLoading && (
        <div className="px-3 py-6 flex items-center justify-center text-slate-400">
          <Loader2 size={16} className="animate-spin" />
        </div>
      )}

      {/* ── Chưa tính: nói rõ việc cần làm và đặt nút ngay đó ── */}
      {!isLoading && !data && (
        <div className="px-4 py-8 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
            <Calculator size={22} />
          </div>
          <div>
            <p className="text-sm font-black text-slate-800 dark:text-slate-100">
              Chưa tính kết quả cho {periodName}
            </p>
            <p className="text-[11px] font-medium text-slate-400 mt-1 max-w-md">
              Hệ thống cộng số liệu của từng chỉ tiêu trong bộ tiêu chí này rồi quy ra %đạt của đơn vị.
              Tính bao nhiêu lần cũng được, con số chỉ cố định sau khi bấm chốt.
            </p>
          </div>
          {canManageUnit ? (
            <button onClick={() => recompute.mutate({ scorecardId, kpiPeriodId })} disabled={computing}
              className="inline-flex items-center gap-2 px-5 h-10 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700 disabled:opacity-40 shadow-sm">
              {computing ? <Loader2 size={14} className="animate-spin" /> : <Calculator size={14} />}
              {computing ? 'Đang tính...' : 'Tính kết quả'}
            </button>
          ) : (
            <p className="text-[11px] font-bold text-slate-400">Chỉ người phụ trách BSC của đơn vị mới tính được.</p>
          )}
        </div>
      )}

      {data && (
        <>
          <div className="px-4 py-3 flex items-baseline gap-3 border-b border-slate-100 dark:border-slate-800">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{num(data.achievementPercent)}%</span>
            <span className="text-[11px] font-bold text-slate-400">%đạt của đơn vị trong {periodName}</span>
          </div>

          {data.items.length > 0
            && data.items.every(i => i.measurementSource === BscMeasurementSource.ROLLUP && !i.kpiCount) && (
            <div className="px-3 py-2 bg-amber-50/60 dark:bg-amber-950/20 text-[10px] font-bold text-amber-700 dark:text-amber-400">
              Mọi chỉ tiêu đang lấy số <b>tự cộng từ KPI</b> mà chưa KPI nào gắn vào, nên chưa ra kết quả.
              Mở <b>Sửa bộ tiêu chí</b> → bấm nút 🎯 trên dòng chỉ tiêu → đổi <b>Nguồn kết quả đơn vị</b>
              sang <b>Nhập tay</b> nếu muốn tự điền con số của cả đơn vị.
            </div>
          )}

          {data.gatePassed === false && (
            <div className="px-3 py-2 bg-red-50/60 dark:bg-red-950/20 text-[11px] font-bold text-red-600 dark:text-red-400 flex items-start gap-1.5">
              <ShieldAlert size={12} className="mt-0.5 shrink-0" />
              <span>Chỉ tiêu chặn không đạt: {data.gateFailedItems}</span>
            </div>
          )}

          {/* Tiêu đề cột: thiếu nó thì ba con số bên phải không ai đoán ra là gì. */}
          <div className="px-3 py-1.5 flex items-center gap-2 bg-slate-50/60 dark:bg-slate-800/30 text-[9px] font-black uppercase tracking-widest text-slate-400">
            <span className="w-2 shrink-0" />
            <span className="flex-1">Chỉ tiêu</span>
            <span className="w-32 text-right">Thực hiện / Mục tiêu</span>
            <span className="w-12 text-right">Trọng số</span>
            <span className="w-14 text-right">%Đạt</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.items.map(item => (
              <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color || '#8b5cf6' }} />
                <span className="flex-1 min-w-0 text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                  {item.name}
                  {item.isGate && (
                    <span className={cn('ml-1.5 text-[9px] font-black uppercase',
                      item.gatePassed === false ? 'text-red-500' : 'text-slate-400')}>· chặn</span>
                  )}
                </span>

                <div className="w-32 flex justify-end">
                  {item.measurementSource !== BscMeasurementSource.MANUAL
                  && item.measurementSource !== BscMeasurementSource.DATASOURCE ? (
                    // Chỉ đọc là CÓ CHỦ Ý: số của dòng này do hệ thống cộng từ KPI cá nhân. Nhưng ô
                    // trơ ra mà không nói gì thì người dùng tưởng giao diện hỏng — nên ghi luôn số
                    // KPI đang gắn, và tô cảnh báo khi con số đó là 0 (nguyên nhân duy nhất khiến
                    // chỉ tiêu mãi không có kết quả).
                    <span
                      title={item.measurementSource === BscMeasurementSource.CHILD_ROLLUP
                        ? `Chỉ tiêu đã giao xuống cấp dưới — số này cộng từ kết quả của ${item.kpiCount ?? 0} đơn vị con.`
                        : item.kpiCount
                          ? `Tự cộng từ ${item.kpiCount} KPI cá nhân gắn vào chỉ tiêu này.`
                          : 'Chưa có KPI cá nhân nào gắn vào chỉ tiêu này nên không cộng ra số nào.'}
                      className={cn('text-right text-[11px] font-bold tabular-nums cursor-help leading-tight',
                        item.kpiCount || item.measurementSource === BscMeasurementSource.CHILD_ROLLUP
                          ? 'text-slate-500 dark:text-slate-400' : 'text-amber-500')}>
                      {item.actualValue == null ? '—' : item.actualValue.toLocaleString('vi-VN')}
                      {item.targetValue != null && ` / ${item.targetValue.toLocaleString('vi-VN')}`}
                      <span className="block text-[9px] font-black uppercase tracking-wider opacity-70">
                        {item.kpiCount ?? 0}{' '}
                        {item.measurementSource === BscMeasurementSource.CHILD_ROLLUP ? 'đơn vị con' : 'KPI'} cộng lên
                      </span>
                    </span>
                  ) : (
                    <div className="text-right">
                      <input type="number" step="any" defaultValue={item.actualValue ?? ''}
                        disabled={!canManageUnit || !isDraft}
                        title={!isDraft ? 'Kết quả đã chốt — mở khoá mới sửa được' : undefined}
                        onBlur={e => {
                          const raw = e.target.value.trim()
                          const next = raw === '' ? null : Number(raw)
                          if (next !== (item.actualValue ?? null)) {
                            setManualActual.mutate({ scorecardId, itemId: item.id, kpiPeriodId, actualValue: next })
                          }
                        }}
                        placeholder="Nhập số"
                        className="w-28 px-2 py-1 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-[11px] font-bold text-right outline-none disabled:opacity-50 focus:placeholder:text-transparent" />
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mt-0.5">
                        nhập tay{item.targetValue != null ? ` · mục tiêu ${item.targetValue.toLocaleString('vi-VN')}` : ''}
                      </span>
                    </div>
                  )}
                </div>

                <span className="w-12 text-right text-[11px] font-bold text-slate-400">{num(item.weightPercentage, 0)}%</span>
                <span className="w-14 text-right text-xs font-black text-slate-700 dark:text-slate-200">
                  {num(item.achievementPercent)}
                </span>
              </div>
            ))}
          </div>

          {canManageUnit && isDraft && data.items.some(i =>
            i.measurementSource === BscMeasurementSource.MANUAL
            || i.measurementSource === BscMeasurementSource.DATASOURCE) && (
            <p className="px-3 py-2 text-[10px] font-medium text-slate-400 border-t border-slate-100 dark:border-slate-800">
              Sửa ô nhập tay xong thì bấm <b>Tính lại</b> để %đạt cập nhật theo số mới.
            </p>
          )}
        </>
      )}
    </div>
  )
}
