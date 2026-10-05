import { LocaleNumberInput } from '@/components/ui/number-input'
import { intlLocale } from '@/i18n/format'
import { useMemo, useState } from 'react'
import {
  ChevronDown, ChevronRight, GitBranch, Lock, ShieldAlert, Building2, Users, Search,
  Send, Check, Undo2, RefreshCw, Loader2, AlertTriangle, Calculator, Target, Layers,
  Edit2, Trash2, ShieldCheck, ListTree, Link2, Unlink,
} from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { getApiErrorCode } from '@/lib/apiError'
import { OrgTimeFilterControls } from '@/components/common/OrgTimeFilters'
import { useOrgTimeFilters } from '@/hooks/useOrgTimeFilters'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import {
  useScorecardTree, useScorecardCoverage, useCascadeMutations,
  useUnitResult, useUnitResultMutations,
} from '../hooks/useBscCascade'
import {
  BscScorecardLevel, BscScorecardStatus, BscScoringMode, BscUnitResultStatus, BscMeasurementSource,
  type FixedPerspectiveResponse, type ScorecardPeriodResponse,
  type ScorecardTreeNodeResponse, type ScorecardResponse,
} from '../types'
import { scorecardStatusMeta } from '../utils/scorecardStatus'
import AttachParentModal from './AttachParentModal'
import RejectScorecardModal from './RejectScorecardModal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import EmptyState from '@/components/common/EmptyState'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

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
}

const COVERAGE_META = perLanguage((): Record<string, { label: string; className: string; hint: string }> => ({
  NOT_CASCADED: {
    label: i18n.t('bsc:BscScorecardTree.unassigned'),
    className: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
    hint: i18n.t('bsc:BscScorecardTree.noUnitHasBeenAssignedThis'),
  },
  UNDER: {
    label: i18n.t('bsc:BscScorecardTree.shortBy'),
    className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
    hint: i18n.t('bsc:BscScorecardTree.theTotalAssignedToUnitsIs'),
  },
  OK: {
    label: i18n.t('bsc:BscScorecardTree.complete'),
    className: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
    hint: i18n.t('bsc:BscScorecardTree.theTotalAssignedToUnitsMatches'),
  },
  OVER: {
    label: i18n.t('bsc:BscScorecardTree.overAssigned'),
    className: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
    hint: i18n.t('bsc:BscScorecardTree.theTotalAssignedToUnitsExceeds'),
  },
}))

const num = (v?: number | null, d = 1) => (v == null ? '—' : v.toFixed(d))

/** Giữ lại nhánh nào có node khớp từ khoá — cha của node khớp vẫn phải hiện để còn đường đi tới nó. */
/**
 * Giữ nút khớp (tìm chữ + bộ lọc), và giữ luôn nút CHA của nút khớp để còn thấy nó nằm ở nhánh nào.
 */
function filterTree(
  nodes: ScorecardTreeNodeResponse[],
  q: string,
  matches: (n: ScorecardTreeNodeResponse) => boolean,
): ScorecardTreeNodeResponse[] {
  const needle = q.trim().toLowerCase()
  const walk = (list: ScorecardTreeNodeResponse[]): ScorecardTreeNodeResponse[] =>
    list.flatMap(n => {
      const children = walk(n.children)
      const textHit = !needle || `${n.name} ${n.orgUnitName ?? ''} ${n.periodLabel ?? ''}`.toLowerCase().includes(needle)
      const hit = textHit && matches(n)
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
  onCascade, onEdit, onDelete, onTogglePublish,
}: BscScorecardTreeProps) {
  const { t } = useTranslation('bsc')
  const { hasPermission } = usePermission()
  const canManage = hasPermission('BSC:MANAGE')
  const canApprove = hasPermission('BSC:APPROVE')

  const { data: tree, isLoading } = useScorecardTree(organizationId)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const scorecardById = useMemo(
    () => new Map((scorecards || []).map(s => [s.id, s])),
    [scorecards],
  )

  // Lọc đơn vị + kỳ/đợt dùng chung với Quản lý OKR (components/common/OrgTimeFilters).
  const filters = useOrgTimeFilters(organizationId)
  const { filtering } = filters
  const visible = useMemo(() => {
    const { unitIds, time, periodCycle } = filters
    const matches = (n: ScorecardTreeNodeResponse) => {
      if (!filtering) return true
      const sc = scorecardById.get(n.id)
      if (!sc) return false
      if (unitIds && !(sc.orgUnits ?? []).some(u => unitIds.has(u.id))) return false
      const periodIds = (sc.periods ?? []).map(p => p.id)
      // Bộ gắn cả KỲ hay gắn từng ĐỢT trong kỳ đều tính là thuộc kỳ đó.
      if (time?.kind === 'cycle' && sc.kpiCycleId !== time.id
        && !periodIds.some(id => periodCycle.get(id) === time.id)) return false
      if (time?.kind === 'period' && !periodIds.includes(time.id)) return false
      return true
    }
    return filterTree(tree || [], query, matches)
  }, [tree, query, filtering, filters, scorecardById])

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
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-subtle-foreground)]" aria-hidden="true" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('BscScorecardTree.searchScorecardsUnits')}
            aria-label={t('BscScorecardTree.searchScorecards')}
            className="h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-subtle-foreground)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          />
        </div>

        <OrgTimeFilterControls filters={filters} />

        <p className="text-caption w-full">
          {t('BscScorecardTree.clickAScorecardToOpenIts')}
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-10 text-[var(--color-subtle-foreground)]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      )}

      {!isLoading && (!tree || tree.length === 0) && (
        <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
          <EmptyState
            icon={Target}
            title={t('BscScorecardTree.noScorecardsYet')}
            description={t('BscScorecardTree.clickNewScorecardToCreateA')}
          />
        </div>
      )}

      {!isLoading && (tree || []).length > 0 && visible.length === 0 && (
        <div className="rounded-card border border-dashed border-[var(--color-border)] px-6 py-8 text-center">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {query.trim() ? <>{t('BscScorecardTree.noScorecardMatches')}{query}”.</> : t('BscScorecardTree.noScorecardMatchesFilters')}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {visible.map(node => (
          <TreeNode key={node.id} node={node} depth={0} isRoot
            expanded={expanded} onToggle={toggle} forceOpen={!!query.trim() || filtering}
            openId={openId} onOpen={setOpenId}
            scorecardById={scorecardById} fixedPerspectives={fixedPerspectives}
            canManage={canManage} canApprove={canApprove} canPublish={canPublish}
            canEditNode={canEditNode}
            onCascade={onCascade} onEdit={onEdit} onDelete={onDelete}
            onTogglePublish={onTogglePublish} />
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
}

function TreeNode(props: TreeNodeProps) {
  const { t } = useTranslation('bsc')
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
  // Dòng "Kết quả cấp trên" (giao cả bộ): nói rõ nó chiếm bao nhiêu trong 100% của CHÍNH thẻ này.
  // Chỉ in "trọng số 30%" thì ba phòng cùng nhận đọc như công ty chia 30% cho mỗi phòng.
  const sourceRow = sc?.perspectives.find(p => p.sourceScorecardId)
  const unallocated = Math.max(0, Math.round((100 - node.totalWeight) * 10) / 10)

  return (
    <div>
      <div className={cn(
        isRoot && 'tour-bsc-scorecard-card',
        'rounded-card border bg-[var(--color-card)] transition-all',
        isDetailOpen
          ? 'border-[var(--color-primary)]'
          : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]')}>

        <div className="flex items-center gap-2 px-3 py-2.5">
          <Button variant="ghost" size="icon-sm" className={cn(node.children.length === 0 && 'invisible')}
            onClick={() => onToggle(node.id)} title={childrenOpen ? t('BscScorecardTree.hideChildUnits') : t('BscScorecardTree.showChildUnits')} aria-label={childrenOpen ? t('BscScorecardTree.hideChildUnits') : t('BscScorecardTree.showChildUnits')}>
            {childrenOpen ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
          </Button>

          <div className={cn('w-8 h-8 rounded-card flex items-center justify-center shrink-0',
            isCompany ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'bg-[var(--color-muted-foreground)] text-[var(--color-card)]')}>
            {isCompany ? <Building2 size={15} /> : <Users size={15} />}
          </div>

          <button type="button"
            className="block min-w-0 flex-1 rounded-control px-2 py-1 text-left transition-colors hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            onClick={() => onOpen(isDetailOpen ? null : node.id)} aria-expanded={isDetailOpen}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-sm font-medium text-[var(--color-foreground)]">{node.name}</span>
              <span className={cn('inline-flex items-center rounded-control px-2 py-0.5 text-xs font-medium', status.badgeClass)}>
                {status.label}
              </span>
              {sc?.scoringMode === BscScoringMode.OFFICIAL && <Badge>{t('BscScorecardTree.official')}</Badge>}
            </div>
            <p className="text-caption truncate mt-0.5">
              {isCompany ? t('BscScorecardTree.companyBsc') : node.orgUnitName || t('BscScorecardTree.unitBsc')}
              {node.periodLabel ? ` · ${node.periodLabel}` : ''}
              {' · '}{node.itemCount} {t('BscScorecardTree.items')}
              {node.assignedCount > 0 && t('BscScorecardTree.assignedByParentAddedByUnit', { assignedCount: node.assignedCount, selfCount })}
              {node.gateCount > 0 && t('BscScorecardTree.gate', { gateCount: node.gateCount })}
              {' · '}
              {sourceRow ? (
                <span className={weightOk ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}>
                  {t('BscScorecardTree.sourceRowShare', { name: sourceRow.sourceScorecardName, value: num(sourceRow.weightPercentage) })}
                  {!weightOk && unallocated > 0 && ` · ${t('BscScorecardTree.unallocated', { value: num(unallocated) })}`}
                </span>
              ) : (
                <span className={weightOk ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}>
                  {t('BscScorecardTree.weights')} {num(node.totalWeight)}%
                </span>
              )}
            </p>
          </button>

          {!weightOk && (
            <span title={t('BscScorecardTree.totalWeightMustBeExactly100', { totalWeight: num(node.totalWeight) })}>
              <AlertTriangle size={14} className="text-[var(--color-warning)] shrink-0" />
            </span>
          )}

          {!canEdit && (
            // Vẫn xem được nội dung, chỉ không sửa. Nói lý do ngay ở đây để khỏi đi tìm nút đã bị ẩn.
            <span title={t('BscScorecardTree.anotherUnitsScorecardYouCanView')}
              className="text-[var(--color-subtle-foreground)] shrink-0"><Lock size={14} /></span>
          )}

          {/* Thao tác đứng ngay cạnh tên thẻ: sửa bộ tiêu chí hay trình duyệt là việc làm với CHÍNH
              nhánh này, bắt mở chi tiết ra mới thấy nút thì thêm một cú bấm cho mọi thao tác. */}
          <NodeActions {...props} scorecard={sc} canEdit={canEdit} />

          <Button variant={isDetailOpen ? 'secondary' : 'ghost'} size="icon-sm" className="shrink-0"
            onClick={() => onOpen(isDetailOpen ? null : node.id)}
            title={isDetailOpen ? t('BscScorecardTree.closeDetails') : t('BscScorecardTree.openDetails')} aria-label={isDetailOpen ? t('BscScorecardTree.closeDetails') : t('BscScorecardTree.openDetails')}>
            {isDetailOpen ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
          </Button>
        </div>

        {isDetailOpen && <NodeDetail {...props} scorecard={sc} canEdit={canEdit} />}
      </div>

      {childrenOpen && node.children.length > 0 && (
        // Đường kẻ dọc thay cho thụt lề bằng margin: nhìn ra ngay nhánh nào thuộc nhánh nào.
        <div className="ml-[26px] mt-2 pl-4 border-l border-dashed border-[var(--color-border)] space-y-2">
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
  node, scorecard: sc, fixedPerspectives, canEdit, canManage, onCascade,
}: TreeNodeProps & { scorecard?: ScorecardResponse; canEdit: boolean }) {
  const { t: tr } = useTranslation('bsc')
  const [tab, setTab] = useState<'items' | 'coverage' | 'result'>('items')

  return (
    <div className="px-3 pb-3 space-y-3 border-t border-[var(--color-border)] pt-3 animate-in slide-in-from-top-1 duration-200">
      {sc?.vision && <p className="px-1 text-sm italic text-[var(--color-muted-foreground)]">“{sc.vision}”</p>}

      {/* ── Ba mục chi tiết ───────────────────────────────────── */}
      <div className="flex w-fit flex-wrap gap-1 rounded-control bg-[var(--color-muted)] p-1" role="tablist">
        {([
          { key: 'items' as const, label: tr('BscScorecardTree.itemsWeights'), icon: <Layers size={12} /> },
          { key: 'coverage' as const, label: tr('BscScorecardTree.cascadeCoverage'), icon: <ListTree size={12} /> },
          { key: 'result' as const, label: tr('BscScorecardTree.periodResults'), icon: <Calculator size={12} /> },
        ]).map(t => (
          <ChoiceChip selected={tab === t.key} variant="segment" size="sm" key={t.key} onClick={() => setTab(t.key)} role="tab" aria-selected={tab === t.key}>
            {t.icon} {t.label}
          </ChoiceChip>
        ))}
      </div>

      {tab === 'items' && (
        <PerspectivePanel scorecard={sc} fixedPerspectives={fixedPerspectives} />
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
  const { t } = useTranslation('bsc')
  const [periodId, setPeriodId] = useState(() => periods[periods.length - 1]?.id ?? '')
  const period = periods.find(p => p.id === periodId)

  if (periods.length === 0 || !periodId) {
    return (
      <div className="rounded-card border border-dashed border-[var(--color-border)] px-4 py-5 text-center">
        <p className="text-caption">{t('BscScorecardTree.thisScorecardIsNotLinkedTo')}</p>
        <p className="text-caption mt-1">
          {t('BscScorecardTree.open')} <b>{t('BscScorecardTree.editScorecard')}</b> {t('BscScorecardTree.toLinkACycleOrPeriod')}
        </p>
      </div>
    )
  }

  return (
    <UnitResultPanel
      scorecardId={scorecardId}
      kpiPeriodId={periodId}
      periodName={period?.name || t('BscScorecardTree.thisPeriod')}
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
  const { t } = useTranslation('bsc')
  const {
    submitScorecard, approveScorecard, rejectScorecard, activateScorecard,
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
        <IconAction key="edit" icon={<Edit2 aria-hidden="true" />} label={t('BscScorecardTree.editScorecard')} onClick={() => onEdit(sc)} />
      ),
    ],
    // Dựng cây: giao chỉ tiêu xuống, gắn/gỡ nhánh
    [
      canManage && sc && (
        <IconAction key="cascade" icon={<GitBranch aria-hidden="true" />} label={t('BscScorecardTree.cascadeToUnits')}
          onClick={() => onCascade(sc)} />
      ),
      canManage && isOrphan && (
        <IconAction key="attach" icon={<Link2 aria-hidden="true" />} label={t('BscScorecardTree.attachToAParentScorecard')}
          onClick={() => setAttachOpen(true)} />
      ),
      canManage && sc?.parentScorecardId && (
        <IconAction key="detach" icon={<Unlink aria-hidden="true" />} label={t('BscScorecardTree.detachFromTreeMakeItA')}
          pending={attachParent.isPending}
          onClick={() => attachParent.mutate({ scorecardId: sc.id, parentScorecardId: null })} />
      ),
    ],
    // Vòng đời trình – duyệt
    [
      canEdit && node.status === BscScorecardStatus.DRAFT && (
        <IconAction key="submit" icon={<Send aria-hidden="true" />} label={t('BscScorecardTree.submitForApproval')}
          pending={submitScorecard.isPending}
          onClick={() => submitScorecard.mutate(node.id)} />
      ),
      canApprove && node.status === BscScorecardStatus.SUBMITTED && (
        <IconAction key="approve" icon={<Check aria-hidden="true" />} label={t('BscScorecardTree.approve')} accent="emerald"
          pending={approveScorecard.isPending}
          onClick={() => approveScorecard.mutate(node.id)} />
      ),
      canApprove && node.status === BscScorecardStatus.SUBMITTED && (
        <IconAction key="reject" icon={<Undo2 aria-hidden="true" />} label={t('BscScorecardTree.returnForChanges')} accent="amber"
          pending={rejectScorecard.isPending}
          onClick={() => setRejectOpen(true)} />
      ),
      // Duyệt là áp dụng luôn, nên nút này chỉ còn cho hai trường hợp: thẻ đã đóng muốn mở lại,
      // và thẻ cũ còn kẹt ở "Đã duyệt" từ thời luồng cũ.
      canApprove && (node.status === BscScorecardStatus.APPROVED || node.status === BscScorecardStatus.CLOSED) && (
        <IconAction key="activate" icon={<Check aria-hidden="true" />} label={t('BscScorecardTree.apply')} accent="emerald"
          pending={activateScorecard.isPending}
          onClick={() => activateScorecard.mutate(node.id)} />
      ),
    ],
    // Chế độ chấm điểm
    [
      canPublish && sc && (
        <IconAction key="publish"
          icon={sc.scoringMode === BscScoringMode.SHADOW ? <ShieldCheck aria-hidden="true" /> : <Undo2 aria-hidden="true" />}
          label={sc.scoringMode === BscScoringMode.SHADOW ? t('BscScorecardTree.switchToOfficialScoring') : t('BscScorecardTree.returnToParallelMode')}
          onClick={() => onTogglePublish(sc)} />
      ),
    ],
    // Xoá — đứng riêng cuối hàng để không bấm nhầm khi đang thao tác việc khác
    [
      canEdit && sc && (
        <IconAction key="delete" icon={<Trash2 aria-hidden="true" />} label={t('BscScorecardTree.deleteScorecard')} accent="red"
          onClick={() => onDelete(sc)} />
      ),
    ],
  ].map(group => group.filter(Boolean)).filter(group => group.length > 0)

  return (
    <div className="flex items-center shrink-0">
      {groups.map((group, index) => (
        <div key={index} className="flex items-center gap-0.5">
          {index > 0 && <span className="w-px h-4 mx-1.5 bg-[var(--color-border)] shrink-0" />}
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
    <Button variant="ghost" size="icon-sm" onClick={onClick} disabled={pending} title={label} aria-label={label}
      className={cn('text-[var(--color-subtle-foreground)]',
        accent === 'emerald' && 'hover:bg-[var(--color-success-bg)] hover:text-[var(--color-success)]',
        accent === 'amber' && 'hover:bg-[var(--color-warning-bg)] hover:text-[var(--color-warning)]',
        accent === 'red' && 'hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]',
        !accent && 'hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]')}>
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : icon}
    </Button>
  )
}

/** Hạng mục của bộ tiêu chí, gom theo 4 lĩnh vực cố định — chỗ chia trọng số cho đủ 100%. */
/** Chỉ để XEM — thêm/sửa hạng mục làm trong form "Sửa bộ tiêu chí" (nút bút chì trên hàng thẻ). */
function PerspectivePanel({ scorecard: sc, fixedPerspectives }: {
  scorecard?: ScorecardResponse
  fixedPerspectives: FixedPerspectiveResponse[]
}) {
  const { t } = useTranslation('bsc')
  if (!sc) {
    return (
      <div className="rounded-card border border-dashed border-[var(--color-border)] px-3 py-4 text-caption">
        {t('BscScorecardTree.couldNotReadThisScorecardsDetails')}
      </div>
    )
  }

  const totalWeight = sc.perspectives.reduce((s, p) => s + (p.weightPercentage || 0), 0)
  const weightOk = Math.abs(totalWeight - 100) <= 0.01

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-eyebrow">
          {sc.perspectives.length} {t('BscScorecardTree.items')}
        </span>
        <Badge variant={weightOk ? 'success' : 'destructive'} className="tabular-nums">
          {t('BscScorecardTree.totalWeight')} {totalWeight.toFixed(1)}%
        </Badge>
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
              <h4 className="text-label">{fp.name}</h4>
              <span className="text-caption tabular-nums">{groupWeight.toFixed(1)}%</span>
            </div>

            <div className="grid gap-1.5">
              {items.map(p => (
                <div key={p.id} className="flex items-center gap-2.5 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2">
                  <div className="w-7 h-7 rounded-control flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${p.color || '#8b5cf6'}1a`, color: p.color || '#8b5cf6' }}>
                    <Layers size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--color-foreground)]">{p.name}</p>
                    {p.sourceScorecardId ? (
                      <span className="text-caption">{t('BscScorecardTree.sourceRowHint', { name: p.sourceScorecardName })}</span>
                    ) : (
                      <span className="text-caption font-mono">{p.code}</span>
                    )}
                    {(p.targetValue != null || p.minimumValue != null) && (
                      <span className="text-caption ml-2">
                        {p.targetValue != null && <>{t('BscScorecardTree.target')} {p.targetValue}{p.unit ? ` ${p.unit}` : ''}</>}
                        {p.targetValue != null && p.minimumValue != null && ' · '}
                        {p.minimumValue != null && <>{t('BscScorecardTree.minimum')} {p.minimumValue}{p.unit ? ` ${p.unit}` : ''}</>}
                        {p.targetValue != null && p.targetValue > 0 && (
                          <span className="ml-1.5 text-[var(--color-primary)]" title={t('BscScorecardTree.theItemScoresItselfAgainstIts')}>{t('BscScorecardTree.selfScored')}</span>
                        )}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-[var(--color-foreground)]">{p.weightPercentage}%</span>
                </div>
              ))}
              {items.length === 0 && (
                <div className="rounded-card border border-dashed border-[var(--color-border)] px-3 py-2 text-caption">
                  {t('BscScorecardTree.noItemsInThisAreaYet')}
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
  const { t } = useTranslation('bsc')
  const { data, isLoading } = useScorecardCoverage(scorecardId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-card border border-[var(--color-border)] px-3 py-6 text-[var(--color-subtle-foreground)]">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      </div>
    )
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-[var(--color-border)] px-4 py-5 text-center">
        <p className="text-caption">{t('BscScorecardTree.noKpisToAssignDownYet')}</p>
        <p className="text-caption mt-1">
          {t('BscScorecardTree.addItemsIn')} <b>{t('BscScorecardTree.itemsWeights')}</b> {t('BscScorecardTree.firstThenComeBackHereTo')}
        </p>
      </div>
    )
  }

  const total = data.items.length
  const done = data.okCount + data.overCount
  const cascadeButton = canCascade && sc && (
    <Button size="sm" onClick={() => onCascade(sc)}>
      <GitBranch aria-hidden="true" /> {t('BscScorecardTree.cascadeToUnits')}
    </Button>
  )

  return (
    <div className="rounded-card border border-[var(--color-border)] overflow-hidden">
      <div className="px-3 py-2.5 bg-[var(--color-muted)] space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label">{t('BscScorecardTree.cascadeCoverage')}</span>
          <span className="text-caption tabular-nums">
            {done}/{total} {t('BscScorecardTree.kpisAssignedToUnits')}
          </span>
          <span className="flex-1" />
          {cascadeButton}
        </div>

        <p className="text-caption leading-relaxed">
          {t('BscScorecardTree.cascadingSplittingThisLevelsKpiInto')}
        </p>

        {/* Thanh tiến độ: nhìn phát biết còn bao nhiêu việc, không phải đếm dòng. */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
            <div className="h-full bg-[var(--color-success-solid)] transition-all"
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

      <div className="divide-y divide-[var(--color-border)]">
        {data.items.map(item => {
          const meta = COVERAGE_META()[item.status] ?? COVERAGE_META().OK!
          const cascaded = item.cascadedValue ?? 0
          return (
            <div key={item.scorecardPerspectiveId} className="px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color || '#8b5cf6' }} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-foreground)]">
                  {item.name}
                </span>

                {item.targetValue != null ? (
                  <span className="text-caption tabular-nums text-right">
                    {cascaded.toLocaleString(intlLocale())} / {item.targetValue.toLocaleString(intlLocale())}
                    {item.unit ? ` ${item.unit}` : ''}
                    <span className="block text-caption">
                      {t('BscScorecardTree.assignedTarget')}
                    </span>
                  </span>
                ) : (
                  <span className="text-caption text-right max-w-[10rem]">
                    {t('BscScorecardTree.kpisWithoutANumericTarget')}
                  </span>
                )}

                <span title={meta.hint}
                  className={cn('inline-flex shrink-0 cursor-help items-center rounded-control px-2 py-0.5 text-xs font-medium',
                    meta.className)}>
                  {meta.label}
                </span>
              </div>

              {item.children.length > 0 ? (
                <div className="mt-1.5 ml-4 flex flex-wrap items-center gap-1">
                  <span className="mr-0.5 text-caption">{t('BscScorecardTree.assignedTo')}</span>
                  {item.children.map(c => (
                    <span key={c.scorecardPerspectiveId}
                      className="rounded-control bg-[var(--color-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-muted-foreground)]">
                      {c.orgUnitName || c.scorecardName}
                      {c.contributionValue != null && `: ${c.contributionValue.toLocaleString(intlLocale())}`}
                      {c.linkType && c.linkType !== 'SUM' && ` · ${c.linkType}`}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 ml-4 text-caption">
                  {t('BscScorecardTree.notAssignedToAnyUnitYet')}
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
  const meta = COVERAGE_META()[status] ?? COVERAGE_META().OK!
  return (
    <span title={meta.hint}
      className={cn('inline-flex cursor-help items-center rounded-control px-2 py-0.5 text-xs font-medium tabular-nums', meta.className)}>
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
  const { t } = useTranslation('bsc')
  const { data, isLoading } = useUnitResult(scorecardId, kpiPeriodId)
  const { recompute, finalize, reopen, setManualActual } = useUnitResultMutations()
  const { hasPermission } = usePermission()
  // Chốt theo số tạm tính chỉ dành cho quản trị BSC toàn tổ chức (backend cũng chặn).
  const canManageAll = hasPermission('BSC:MANAGE')
  const [askProvisional, setAskProvisional] = useState(false)
  const isDraft = data?.status === BscUnitResultStatus.DRAFT
  const computing = recompute.isPending

  const finalizeNow = () => finalize.mutate(
    { scorecardId, kpiPeriodId, askProvisional: canManageAll },
    { onError: e => { if (canManageAll && getApiErrorCode(e) === 'BSC_SOURCE_RESULT_NOT_FINALIZED') setAskProvisional(true) } },
  )
  const pendingSources = (data?.items ?? []).filter(i => i.provisional).map(i => i.sourceScorecardName).filter(Boolean)

  return (
    <div className="rounded-card border border-[var(--color-border)] overflow-hidden">
      {/* ── Đầu bảng: đợt đang xem + trạng thái + thao tác ───── */}
      <div className="px-3 py-2.5 bg-[var(--color-muted)] flex flex-wrap items-center gap-2">
        <span className="text-label">{t('BscScorecardTree.periodResults')}</span>
        {periods.length > 1 ? (
          <Select value={kpiPeriodId} onValueChange={onChangePeriod}>
            <SelectTrigger className="h-8 w-auto min-w-48 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="z-[1100]">
              {periods.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm font-medium text-[var(--color-foreground)]">{periodName}</span>
        )}

        {data && (
          <Badge variant={isDraft ? 'secondary' : 'success'}>{isDraft ? t('BscScorecardTree.draft') : t('BscScorecardTree.finalized')}</Badge>
        )}
        {data?.provisionalSource && (
          <Badge variant="warning" title={t('BscScorecardTree.finalizedProvisionalHint')}>{t('BscScorecardTree.finalizedProvisional')}</Badge>
        )}

        <span className="flex-1" />

        {canManageUnit && data && (
          <>
            <Button variant="secondary" size="sm" onClick={() => recompute.mutate({ scorecardId, kpiPeriodId })} disabled={computing || !isDraft} title={isDraft ? t('BscScorecardTree.recalculateFromCurrentFigures') : t('BscScorecardTree.finalizedUnlockBeforeRecalculating')}>
              {computing ? <Loader2 aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />}
              {t('BscScorecardTree.recalculate')}
            </Button>
            {isDraft ? (
              <Button size="sm" onClick={finalizeNow} disabled={finalize.isPending} title={t('BscScorecardTree.finalizeTheseFiguresAfterFinalizingYou')}>
                {finalize.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Check aria-hidden="true" />}
                {t('BscScorecardTree.finalizeResults')}
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => reopen.mutate({ scorecardId, kpiPeriodId })} disabled={reopen.isPending}>
                <Undo2 aria-hidden="true" /> {t('BscScorecardTree.unlockToEdit')}
              </Button>
            )}
          </>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center px-3 py-6 text-[var(--color-subtle-foreground)]">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        </div>
      )}

      {/* ── Chưa tính: nói rõ việc cần làm và đặt nút ngay đó ── */}
      {!isLoading && !data && (
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
            <Calculator size={22} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <div>
            <p className="text-section-title">
              {t('BscScorecardTree.resultsNotComputedFor')} {periodName}
            </p>
            <p className="text-caption mt-1 max-w-md">
              {t('BscScorecardTree.theSystemAddsUpTheFigures')}
            </p>
          </div>
          {canManageUnit ? (
            <Button size="sm" onClick={() => recompute.mutate({ scorecardId, kpiPeriodId })} disabled={computing}>
              {computing ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Calculator aria-hidden="true" />}
              {computing ? t('BscScorecardTree.computing') : t('BscScorecardTree.computeResults')}
            </Button>
          ) : (
            <p className="text-caption">{t('BscScorecardTree.onlyTheUnitsBscOwnerCan')}</p>
          )}
        </div>
      )}

      {data && (
        <>
          <div className="flex items-baseline gap-3 border-b border-[var(--color-border)] px-4 py-3">
            <span className="text-stat text-[var(--color-foreground)]">{num(data.achievementPercent)}%</span>
            <span className="text-caption">{t('BscScorecardTree.unitAchievementIn')} {periodName}</span>
          </div>

          {data.items.length > 0
            && data.items.every(i => i.measurementSource === BscMeasurementSource.ROLLUP && !i.kpiCount) && (
            <div className="border-b border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">
              {t('BscScorecardTree.everyKpiIsTakingFiguresFrom')} <b>{t('BscScorecardTree.summedFromKpis')}</b> {t('BscScorecardTree.butNoKpiIsLinkedYet')} <b>{t('BscScorecardTree.editScorecard')}</b>{t('BscScorecardTree.clickTheTargetButtonOnThe')} <b>{t('BscScorecardTree.unitResultSource')}</b>
              {i18n.t('bsc:BscScorecardTree.switchTo')} <b>{i18n.t('bsc:BscScorecardTree.manualEntry')}</b> {t('BscScorecardTree.ifYouWantToEnterThe')}
            </div>
          )}

          {isDraft && pendingSources.length > 0 && (
            <div className="border-b border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">
              {t('BscScorecardTree.waitingForSource', { names: pendingSources.join(', ') })}
            </div>
          )}

          {data.gatePassed === false && (
            <div className="flex items-start gap-1.5 border-b border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-3 py-2 text-xs font-medium text-[var(--color-error)]">
              <ShieldAlert size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{t('BscScorecardTree.gateKpisNotMet')} {data.gateFailedItems}</span>
            </div>
          )}

          {/* Tiêu đề cột: thiếu nó thì ba con số bên phải không ai đoán ra là gì. */}
          <div className="flex items-center gap-2 bg-[var(--color-muted)] px-3 py-1.5 text-eyebrow">
            <span className="w-2 shrink-0" />
            <span className="flex-1">{t('BscScorecardTree.kpis')}</span>
            <span className="w-32 text-right">{t('BscScorecardTree.actualTarget')}</span>
            <span className="w-12 text-right">{t('BscScorecardTree.weight')}</span>
            <span className="w-14 text-right">{t('BscScorecardTree.achieved')}</span>
          </div>

          <div className="divide-y divide-[var(--color-border)]">
            {data.items.map(item => (
              <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color || '#8b5cf6' }} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-foreground)]">
                  {item.name}
                  {item.isGate && (
                    <span className={cn('ml-1.5 text-xs font-medium',
                      item.gatePassed === false ? 'text-[var(--color-error)]' : 'text-[var(--color-subtle-foreground)]')}>{t('BscScorecardTree.gate2')}</span>
                  )}
                </span>

                <div className="w-32 flex justify-end">
                  {item.measurementSource === BscMeasurementSource.SCORECARD_RESULT ? (
                    // Dòng "Kết quả cấp trên": không có thực đạt/mục tiêu, chỉ có điểm tổng của thẻ nguồn.
                    <span className="text-right text-caption leading-tight">
                      {item.sourceScorecardName}
                      {item.provisional && (
                        <span className="block text-[var(--color-warning)]">{t('BscScorecardTree.provisional')}</span>
                      )}
                    </span>
                  ) : item.measurementSource !== BscMeasurementSource.MANUAL
                  && item.measurementSource !== BscMeasurementSource.DATASOURCE ? (
                    // Chỉ đọc là CÓ CHỦ Ý: số của dòng này do hệ thống cộng từ KPI cá nhân. Nhưng ô
                    // trơ ra mà không nói gì thì người dùng tưởng giao diện hỏng — nên ghi luôn số
                    // KPI đang gắn, và tô cảnh báo khi con số đó là 0 (nguyên nhân duy nhất khiến
                    // chỉ tiêu mãi không có kết quả).
                    <span
                      title={item.measurementSource === BscMeasurementSource.CHILD_ROLLUP
                        ? t('BscScorecardTree.kpiAssignedToLowerLevelsThis', { value: item.kpiCount ?? 0 })
                        : item.kpiCount
                          ? t('BscScorecardTree.summedFromIndividualKpisLinkedTo', { count: item.kpiCount })
                          : t('BscScorecardTree.noIndividualKpiIsLinkedTo')}
                      className={cn('cursor-help text-right text-sm font-medium leading-tight tabular-nums',
                        item.kpiCount || item.measurementSource === BscMeasurementSource.CHILD_ROLLUP
                          ? 'text-[var(--color-muted-foreground)]' : 'text-[var(--color-warning)]')}>
                      {item.actualValue == null ? '—' : item.actualValue.toLocaleString(intlLocale())}
                      {item.targetValue != null && ` / ${item.targetValue.toLocaleString(intlLocale())}`}
                      <span className="block text-caption">
                        {item.kpiCount ?? 0}{' '}
                        {item.measurementSource === BscMeasurementSource.CHILD_ROLLUP ? t('BscScorecardTree.childUnits') : 'KPI'} {t('BscScorecardTree.rollUp')}
                      </span>
                    </span>
                  ) : (
                    <div className="text-right">
                      <LocaleNumberInput type="number" step="any" defaultValue={item.actualValue ?? ''}
                        disabled={!canManageUnit || !isDraft}
                        title={!isDraft ? t('BscScorecardTree.resultsAreFinalizedUnlockToEdit') : undefined}
                        onBlur={e => {
                          const raw = e.target.value.trim()
                          const next = raw === '' ? null : Number(raw)
                          if (next !== (item.actualValue ?? null)) {
                            setManualActual.mutate({ scorecardId, itemId: item.id, kpiPeriodId, actualValue: next })
                          }
                        }}
                        placeholder={t('BscScorecardTree.enterANumber')}
                        aria-label={t('BscScorecardTree.manuallyEnteredResult')}
                        className="h-8 w-28 rounded-control border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-2 text-right text-sm tabular-nums text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-subtle-foreground)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:opacity-50" />
                      <span className="mt-0.5 block text-caption">
                        {t('BscScorecardTree.manual')}{item.targetValue != null ? t('BscScorecardTree.target2', { value: item.targetValue.toLocaleString(intlLocale()) }) : ''}
                      </span>
                    </div>
                  )}
                </div>

                <span className="w-12 text-right text-caption tabular-nums">{num(item.weightPercentage, 0)}%</span>
                <span className="w-14 text-right text-sm font-medium tabular-nums text-[var(--color-foreground)]">
                  {num(item.achievementPercent)}
                </span>
              </div>
            ))}
          </div>

          <ConfirmDialog
            open={askProvisional}
            onClose={() => setAskProvisional(false)}
            onConfirm={() => finalize.mutate(
              { scorecardId, kpiPeriodId, allowProvisional: true },
              { onSettled: () => setAskProvisional(false) },
            )}
            loading={finalize.isPending}
            title={t('BscScorecardTree.finalizeProvisionalTitle')}
            description={t('BscScorecardTree.finalizeProvisionalDescription', { names: pendingSources.join(', ') })}
            confirmLabel={t('BscScorecardTree.finalizeProvisionalConfirm')}
          />

          {canManageUnit && isDraft && data.items.some(i =>
            i.measurementSource === BscMeasurementSource.MANUAL
            || i.measurementSource === BscMeasurementSource.DATASOURCE) && (
            <p className="px-3 py-2 text-caption border-t border-[var(--color-border)]">
              {t('BscScorecardTree.afterEditingTheManualFieldsClick')} <b>{t('BscScorecardTree.recalculate')}</b> {t('BscScorecardTree.soTheAchievementUpdatesToThe')}
            </p>
          )}
        </>
      )}
    </div>
  )
}
