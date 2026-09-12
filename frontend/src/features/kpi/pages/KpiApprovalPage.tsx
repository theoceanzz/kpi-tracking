import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { WORKFLOW_PARAMS } from '../workflow/hooks/useWorkflowNavigator'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import FilterBar, { SegmentedControl } from '@/components/common/FilterBar'
import BulkActionBar from '@/components/common/BulkActionBar'
import StatusBadge from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import KpiReviewModal from '../components/KpiReviewModal'
import KpiTagChips from '../components/KpiTagChips'
import KpiFormModal from '../components/KpiFormModal'
import { useKpiCriteria } from '../hooks/useKpiCriteria'
import { formatNumber, formatAssigneeNames, cn } from '@/lib/utils'
import type { KpiCriteria } from '@/types/kpi'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import {
  ChevronDown, CornerDownRight, CheckCircle, XCircle, Eye,
  AlertCircle, Clock, Undo2, Loader2, LayoutGrid, List, ChevronsDownUp, ChevronsUpDown, Inbox,
} from 'lucide-react'
import { buildKpiRows } from '../utils/kpiTree'
import { useAuthStore } from '@/store/authStore'
import { usePermission } from '@/hooks/usePermission'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useScorecards } from '@/features/bsc/hooks/useBsc'
import { buildRealWeightById, findDecompositionParentIds, sumWeightForPerson, totalWeightForUnit } from '../utils/realWeight'
import { useObjectives } from '../../okr/hooks/useOkr'
import { useSidebarSettings } from '@/features/organization/hooks/useSidebarSettings'
import { ObjectiveResponse } from '@/features/okr/types'
import Pagination from '@/components/common/Pagination'
import {
  PersonGroupBadge, PersonGroupHeaderCard, PersonGroupHeaderRow,
  UnitGroupHeaderCard, UnitGroupHeaderRow,
} from '@/components/common/PersonGroupHeader'
import { groupByPerson, groupByUnitThenPerson, personGroupKey, type UnitGroup } from '@/lib/personGrouping'
import { usePersonGroupCollapse } from '@/hooks/usePersonGroupCollapse'

/** Số nhóm (đơn vị, hoặc người khi chỉ có một đơn vị) hiển thị mỗi trang. */
const GROUP_PAGE_SIZE = 10
/** Trần số KPI tải về một lần để gom nhóm — chạm trần thì nhắc người dùng lọc hẹp lại. */
const GROUPING_FETCH_SIZE = 1000

type ApprovalTab = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ALL'
const APPROVAL_TABS: ApprovalTab[] = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ALL']
const TAB_LABELS: Record<ApprovalTab, string> = {
  PENDING_APPROVAL: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã trả lại',
  ALL: 'Tất cả',
}

// `?tab=` dùng chung query string với các mục khác của /performance, nên phải lọc:
// tab của trang điều chỉnh lọt sang đây sẽ thành bộ lọc rỗng.
const readTab = (raw: string | null): ApprovalTab =>
  APPROVAL_TABS.includes(raw as ApprovalTab) ? (raw as ApprovalTab) : 'PENDING_APPROVAL'

/** Trọng số: "thật / form" khi có hạng mục BSC, chỉ "form" khi không. */
function WeightCell({ kpi, real }: { kpi: KpiCriteria; real: number | undefined }) {
  return (
    <span className="tabular-nums" title={real != null ? `Trọng số thật = ${kpi.weight}% × tỷ trọng hạng mục` : undefined}>
      {real != null ? (
        <>
          <span className="font-medium text-[var(--color-foreground)]">{real.toFixed(1)}%</span>
          <span className="text-caption"> / {kpi.weight}%</span>
        </>
      ) : (
        <span className="font-medium text-[var(--color-foreground)]">{kpi.weight}%</span>
      )}
    </span>
  )
}

/** Ba nút hành động của một hàng: Xem · Duyệt · Trả lại — chỉ icon, 32px, cùng vị trí ở mọi hàng. */
function RowActions({ kpi, onView, onApprove, onReject, busy }: {
  kpi: KpiCriteria; onView: () => void; onApprove: () => void; onReject: () => void; busy: boolean
}) {
  const pending = kpi.status === 'PENDING_APPROVAL'
  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button variant="ghost" size="icon-sm" onClick={onView} aria-label="Xem chi tiết" title="Xem chi tiết">
        <Eye aria-hidden="true" />
      </Button>
      {pending && (
        <>
          <Button variant="ghost" size="icon-sm" onClick={onApprove} disabled={busy} aria-label="Duyệt" title="Duyệt" className="text-[var(--color-success)] hover:bg-[var(--color-success-bg)]">
            <CheckCircle aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onReject} disabled={busy} aria-label="Trả lại" title="Trả lại" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)]">
            <XCircle aria-hidden="true" />
          </Button>
        </>
      )}
    </div>
  )
}

const CHECKBOX = 'h-4 w-4 cursor-pointer rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-card)] accent-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2'

export default function KpiApprovalPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [activeTab, setActiveTab] = useState<ApprovalTab>(() => readTab(searchParams.get('tab')))
  
  // Đợt do bước soạn chỉ tiêu bàn giao qua ?periodId= — lọc sẵn đúng lô vừa gửi duyệt, thay vì
  // bắt người duyệt tự tìm lại trong danh sách tất cả các đợt.
  const [selectedPeriodId, setSelectedPeriodId] = useState(searchParams.get(WORKFLOW_PARAMS.period) ?? 'ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [sortBy, setSortBy] = useState('updatedAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>('ALL')
  const [selectedKeyResultId, setSelectedKeyResultId] = useState<string>('ALL')
  
  // Selection state
  const [selectedKpis, setSelectedKpis] = useState<string[]>([])
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'list' | 'card'>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 'card' : 'list'
  )
  
  const user = useAuthStore(s => s.user)
  const { canRevertApproval } = usePermission()
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(organizationId)
  const enableOkr = org?.enableOkr
  const qc = useQueryClient()
  const { data: periodsData } = useKpiPeriods({ organizationId })
  const { data: orgUnitTreeData } = useOrgUnitTree()

  // Flatten tree for dropdown
  const flattenTree = (nodes: any[], level = 0): any[] => {
    let result: any[] = []
    nodes.forEach(node => {
      result.push({ ...node, levelLabel: '—'.repeat(level) + (level > 0 ? ' ' : '') + node.name })
      if (node.children?.length) {
        result = result.concat(flattenTree(node.children, level + 1))
      }
    })
    return result
  }
  const flatOrgUnits = useMemo(() => orgUnitTreeData ? flattenTree(orgUnitTreeData) : [], [orgUnitTreeData])

  // Thứ tự đơn vị trong cây tổ chức, để các nhóm đơn vị hiện theo đúng trật tự cây.
  const unitOrder = useMemo(
    () => new Map<string, number>(flatOrgUnits.map((u: any, i: number) => [u.id, i])),
    [flatOrgUnits]
  )

  useEffect(() => {
    const tab = readTab(searchParams.get('tab'))
    if (tab !== activeTab) {
      setActiveTab(tab)
    }
  }, [searchParams])

  const handleTabChange = (tab: ApprovalTab) => {
    setActiveTab(tab)
    // Giữ nguyên các param khác — ghi đè cả query string sẽ xoá mất `?section=`
    // của SettingsSectionLayout và đá người dùng về lưới thẻ /performance.
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      p.set('tab', tab)
      return p
    }, { replace: true })
    setPage(0)
    setSelectedKpis([])
  }

  // Data for KPI Criteria — tải trọn phạm vi đang lọc (không phân trang ở server) để gom
  // nhóm theo người cho đủ; phân trang 10 KPI/trang sẽ cắt ngang một người thành hai trang.
  const { data: criteriaData, isLoading } = useKpiCriteria(
    {
      status: activeTab === 'ALL' ? undefined : activeTab,
      kpiPeriodId: selectedPeriodId === 'ALL' ? undefined : selectedPeriodId,
      organizationId: user?.memberships?.[0]?.organizationId,
      page: 0,
      size: GROUPING_FETCH_SIZE,
      sortBy,
      sortDir,
      objectiveId: selectedObjectiveId === 'ALL' ? undefined : selectedObjectiveId,
      keyResultId: selectedKeyResultId === 'ALL' ? undefined : selectedKeyResultId,
      approvalMode: true
    }
  )

  const { data: objectivesData } = useObjectives(user?.memberships?.[0]?.organizationId)
  const selectedObjective = objectivesData?.find((o: ObjectiveResponse) => o.id === selectedObjectiveId)
  const keyResults = selectedObjective?.keyResults || []

  const { data: customLabels = {} } = useSidebarSettings(organizationId!)
  const rawTitle = (customLabels as Record<string, string>)['/kpi-criteria/pending'] || 'Phê duyệt chỉ tiêu'

  const [reviewKpi, setReviewKpi] = useState<KpiCriteria | null>(null)
  const [reviewMode, setReviewMode] = useState<'view' | 'reject'>('view')
  const [showEditForm, setShowEditForm] = useState(false)
  const [editKpi, setEditKpi] = useState<KpiCriteria | null>(null)

  const handleEdit = (kpi: KpiCriteria) => {
    setEditKpi(kpi)
    setShowEditForm(true)
    setReviewKpi(null) // Close review modal when editing
  }

  const items = (criteriaData?.content ?? []).filter(kpi => canRevertApproval || kpi.createdById !== user?.id || kpi.status !== 'PENDING_APPROVAL')

  const enableBsc = org?.enableBsc
  const { data: bscScorecards } = useScorecards(enableBsc ? organizationId : undefined)
  const realWeightById = useMemo(
    () => buildRealWeightById(items, bscScorecards, orgUnitTreeData, enableBsc),
    [items, bscScorecards, orgUnitTreeData, enableBsc]
  )
  const totalElements = items.length
  const hitFetchCap = (criteriaData?.content?.length ?? 0) >= GROUPING_FETCH_SIZE

  // Gom ĐƠN VỊ → NGƯỜI → KPI, thay cho danh sách phẳng trộn lẫn nhiều đơn vị lẫn nhiều người.
  // Một KPI thuộc đúng một đơn vị, nhưng giao cho nhiều người thì nằm ở nhóm của từng người.
  const extractAssignees = (kpi: KpiCriteria) =>
    (kpi.assignees ?? []).map(a => ({ id: a.id, name: a.fullName, avatarUrl: a.avatarUrl }))

  const unitGroups = useMemo(
    () => groupByUnitThenPerson(
      items,
      kpi => {
        const id = kpi.orgUnitId || kpi.orgUnitIds?.[0]
        return id ? { id, name: kpi.orgUnitName || 'Đơn vị không tên' } : null
      },
      extractAssignees,
      unitOrder,
    ),
    [items, unitOrder]
  )
  const personGroups = useMemo(() => groupByPerson(items, extractAssignees), [items])

  // Chỉ thêm cấp nào thực sự có nhiều mục: ≥2 đơn vị mới gom theo đơn vị, ≥2 người mới gom
  // theo người; một người duy nhất thì giữ danh sách phẳng như cũ.
  const unitMode = unitGroups.length >= 2
  const personMode = personGroups.length >= 2

  const myUnitId = user?.memberships?.[0]?.orgUnitId
  const unitCollapse = usePersonGroupCollapse(myUnitId)
  // Nhóm người đánh khoá kèm đơn vị ở chế độ ba cấp, chỉ bằng id người khi rơi về hai cấp.
  const personCollapse = usePersonGroupCollapse(
    user?.id ? [user.id, myUnitId ? personGroupKey(myUnitId, user.id) : null] : null
  )
  const resetGroups = () => { unitCollapse.reset(); personCollapse.reset() }

  // Phân trang theo ĐƠN VỊ khi gom ba cấp, theo NGƯỜI khi chỉ có một đơn vị.
  const pagedGroups: { id: string }[] = unitMode ? unitGroups : personGroups
  const totalGroups = pagedGroups.length
  const totalPages = unitMode || personMode ? Math.max(1, Math.ceil(totalGroups / GROUP_PAGE_SIZE)) : 1
  // Đổi bộ lọc có thể làm số trang co lại — kẹp ngay lúc render để không kẹt ở trang trống.
  const groupPage = Math.min(page, totalPages - 1)
  const pageSlice = <T,>(list: T[]) =>
    list.slice(groupPage * GROUP_PAGE_SIZE, groupPage * GROUP_PAGE_SIZE + GROUP_PAGE_SIZE)
  const visibleUnits = unitMode ? pageSlice(unitGroups) : []
  const visibleGroups = !unitMode && personMode ? pageSlice(personGroups) : []

  const { rows: itemRows, childrenByParentId } = buildKpiRows(items, collapsedParents)

  /**
   * Danh sách dòng để render: ở chế độ gom nhóm, chèn dòng header đơn vị rồi header người
   * ngay trước các KPI tương ứng; ở chế độ phẳng thì y như cũ.
   */
  type ApprovalRow =
    | { kind: 'unit'; unit: UnitGroup<KpiCriteria> }
    | { kind: 'person'; group: (typeof personGroups)[number]; key: string }
    | { kind: 'kpi'; kpi: KpiCriteria; depth: number }

  const pushPerson = (out: ApprovalRow[], group: (typeof personGroups)[number], key: string) => {
    out.push({ kind: 'person', group, key })
    if (!personCollapse.isExpanded(key)) return
    buildKpiRows(group.items, collapsedParents).rows.forEach(r => out.push({ kind: 'kpi', ...r }))
  }

  const buildDisplayRows = (): ApprovalRow[] => {
    const out: ApprovalRow[] = []
    if (unitMode) {
      visibleUnits.forEach(unit => {
        out.push({ kind: 'unit', unit })
        if (!unitCollapse.isExpanded(unit.id)) return
        unit.people.forEach(group => pushPerson(out, group, personGroupKey(unit.id, group.id)))
      })
      return out
    }
    if (personMode) {
      visibleGroups.forEach(group => pushPerson(out, group, group.id))
      return out
    }
    return itemRows.map(r => ({ kind: 'kpi' as const, ...r }))
  }
  const displayRows = buildDisplayRows()

  /** Số cột của bảng — header nhóm phải trải hết chiều ngang. */
  const tableColSpan = 6 + (enableOkr ? 1 : 0) + (unitMode ? 0 : 1)

  // Nhận diện KPI cha phân rã trên toàn danh sách đã tải, không tính lại trong từng nhóm.
  const decompositionParentIds = useMemo(() => findDecompositionParentIds(items), [items])

  /** Tổng trọng số của một người, dựng theo đúng công thức backend (bỏ KPI thưởng và KPI cha phân rã). */
  const sumWeight = (list: KpiCriteria[]) => sumWeightForPerson(list, realWeightById, decompositionParentIds)

  /**
   * Số liệu tóm tắt của một đơn vị. "Tổng trọng số" dùng đúng công thức backend
   * (KPI chưa giao + người cao nhất), nên đơn vị cấu hình xong luôn ra tròn 100%
   * dù có bao nhiêu nhân sự — cùng con số backend chặn khi gửi duyệt.
   */
  const renderUnitBadges = (unit: UnitGroup<KpiCriteria>) => {
    const pending = unit.items.filter(k => k.status === 'PENDING_APPROVAL').length
    const offTarget = unit.people.filter(p => Math.round(sumWeight(p.items)) !== 100).length
    const unitWeight = totalWeightForUnit(unit.items, realWeightById, decompositionParentIds)
    return (
      <>
        <PersonGroupBadge label="nhân sự" value={unit.people.length} tone="indigo" />
        <PersonGroupBadge label="chỉ tiêu" value={unit.items.length} />
        {pending > 0 && <PersonGroupBadge label="đợi duyệt" value={pending} tone="amber" />}
        <PersonGroupBadge
          label="tổng trọng số"
          value={`${formatNumber(unitWeight)}%`}
          tone={Math.round(unitWeight) === 100 ? 'emerald' : 'rose'}
        />
        {offTarget > 0 && <PersonGroupBadge label="chưa đủ 100%" value={offTarget} tone="rose" />}
      </>
    )
  }

  /** Số liệu tóm tắt của một người, đọc từ chính các KPI đang lọc. */
  const renderPersonBadges = (list: KpiCriteria[]) => {
    const pending = list.filter(k => k.status === 'PENDING_APPROVAL').length
    const approved = list.filter(k => k.status === 'APPROVED').length
    const rejected = list.filter(k => k.status === 'REJECTED').length
    const weight = sumWeight(list)
    return (
      <>
        <PersonGroupBadge label="chỉ tiêu" value={list.length} />
        {pending > 0 && <PersonGroupBadge label="đợi duyệt" value={pending} tone="amber" />}
        {approved > 0 && <PersonGroupBadge label="đã duyệt" value={approved} tone="emerald" />}
        {rejected > 0 && <PersonGroupBadge label="từ chối" value={rejected} tone="rose" />}
        <PersonGroupBadge
          label="trọng số"
          value={`${formatNumber(weight)}%`}
          tone={Math.round(weight) === 100 ? 'emerald' : 'indigo'}
        />
      </>
    )
  }

  /** Duyệt nhanh toàn bộ chỉ tiêu đang chờ của riêng một người. */
  const renderPersonApproveAction = (list: KpiCriteria[]) => {
    const pendingIds = list.filter(k => k.status === 'PENDING_APPROVAL').map(k => k.id)
    if (pendingIds.length === 0) return null
    return (
      <Button
        variant="outline" size="sm"
        onClick={() => bulkApproveMutation.mutate(pendingIds)}
        disabled={bulkApproveMutation.isPending}
        title={`Duyệt ${pendingIds.length} chỉ tiêu đang chờ của người này`}
      >
        {bulkApproveMutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle aria-hidden="true" />}
        Duyệt {pendingIds.length}
      </Button>
    )
  }

  const toggleParentCollapse = (parentId: string) => {
    setCollapsedParents(prev => {
      const next = new Set(prev)
      if (next.has(parentId)) next.delete(parentId)
      else next.add(parentId)
      return next
    })
  }

  const { data: statsData } = useKpiCriteria({
    size: 1000,
    organizationId: user?.memberships?.[0]?.organizationId,
    kpiPeriodId: selectedPeriodId === 'ALL' ? undefined : selectedPeriodId,
    objectiveId: selectedObjectiveId === 'ALL' ? undefined : selectedObjectiveId,
    keyResultId: selectedKeyResultId === 'ALL' ? undefined : selectedKeyResultId,
    approvalMode: true
  })
  const stats = useMemo(() => {
    const all = (statsData?.content ?? []).filter(k => canRevertApproval || k.createdById !== user?.id || k.status !== 'PENDING_APPROVAL')
    return {
      total: all.length,
      pending: all.filter(k => k.status === 'PENDING_APPROVAL').length,
      approved: all.filter(k => k.status === 'APPROVED').length,
      rejected: all.filter(k => k.status === 'REJECTED').length,
    }
  }, [statsData, user?.id, canRevertApproval])

  // Bulk Approve Mutation
  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const promises = ids.map(id => kpiApi.approve(id))
      return Promise.all(promises)
    },
    onSuccess: (results) => {
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      toast.success(`Đã duyệt ${results.length} chỉ tiêu`)
      setSelectedKpis([])
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Duyệt hàng loạt thất bại'))
  })

  const toggleSelectAll = () => {
    const selectableItems = items.filter(k => k.status === 'PENDING_APPROVAL')
    if (selectedKpis.length === selectableItems.length && selectableItems.length > 0) {
      setSelectedKpis([])
    } else {
      setSelectedKpis(selectableItems.map(k => k.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedKpis(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const approveOne = (id: string) => bulkApproveMutation.mutate([id])
  const openReview = (kpi: KpiCriteria, mode: 'view' | 'reject' = 'view') => { setReviewMode(mode); setReviewKpi(kpi) }
  const busy = bulkApproveMutation.isPending

  const pendingSelectable = items.filter(k => k.status === 'PENDING_APPROVAL')
  const allPendingSelected = pendingSelectable.length > 0 && selectedKpis.length === pendingSelectable.length
  const somePendingSelected = selectedKpis.length > 0 && !allPendingSelected

  /* ── Bảng: một hàng KPI ── */
  const renderKpiRow = (kpi: KpiCriteria, depth: number) => {
    const isSelected = selectedKpis.includes(kpi.id)
    const isChildRow = depth > 0
    const childKpis = childrenByParentId.get(kpi.id) ?? []
  return (
      <tr
        key={kpi.id}
        aria-selected={isSelected || undefined}
        className={cn('transition-colors', isSelected ? 'bg-[var(--color-primary-soft)]' : 'hover:bg-[var(--color-muted)]', isChildRow && !isSelected && 'bg-[var(--color-background)]')}
      >
        <td className="w-10 px-3 py-3">
          {kpi.status === 'PENDING_APPROVAL' && (
            <input type="checkbox" aria-label="Chọn chỉ tiêu" checked={isSelected} onChange={() => toggleSelect(kpi.id)} className={CHECKBOX} />
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-start gap-1.5" style={{ paddingLeft: isChildRow ? 24 : 0 }}>
            {!isChildRow && childKpis.length > 0 && (
              <Button variant="secondary" size="icon" className="mt-0.5 shrink-0" type="button" onClick={() => toggleParentCollapse(kpi.id)} aria-expanded={!collapsedParents.has(kpi.id)} aria-label={collapsedParents.has(kpi.id) ? 'Mở rộng KPI con' : 'Thu gọn KPI con'}>
                <ChevronDown aria-hidden="true" className={cn('transition-transform', collapsedParents.has(kpi.id) && '-rotate-90')} />
              </Button>
            )}
            {isChildRow && <CornerDownRight size={14} className="mt-1 shrink-0 text-[var(--color-subtle-foreground)]" aria-hidden="true" />}
            <div className="min-w-0 max-w-[360px]">
              <button className="max-w-full truncate text-left text-sm font-medium text-[var(--color-foreground)] transition-colors hover:text-[var(--color-primary)] hover:underline max-w-full" type="button" onClick={() => openReview(kpi)} title={kpi.name}>
                {kpi.name}
              </button>
              <div className="mt-0.5"><KpiTagChips kpi={kpi} childCount={childKpis.length} isChildRow={isChildRow} /></div>
                </div>
              </div>
        </td>
        {enableOkr && (
          <td className="px-4 py-3">
            <div className="max-w-[200px]">
              <p className="truncate text-sm text-[var(--color-foreground)]" title={kpi.objectiveName || undefined}>{kpi.objectiveName || '—'}</p>
              {kpi.keyResultName && <p className="truncate text-caption" title={kpi.keyResultName}>{kpi.keyResultCode ? `${kpi.keyResultCode} ·` : ''}{kpi.keyResultName}</p>}
            </div>
          </td>
        )}
        {!unitMode && (
          <td className="px-4 py-3">
            <div className="max-w-[220px]">
              <p className="truncate text-sm text-[var(--color-foreground)]" title={kpi.orgUnitName || undefined}>{kpi.orgUnitName || '—'}</p>
              {!personMode && <p className="truncate text-caption" title={formatAssigneeNames(kpi.assigneeNames)}>{formatAssigneeNames(kpi.assigneeNames)}</p>}
            </div>
          </td>
        )}
        <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
          {kpi.kpiType === 'QUALITATIVE' ? <span className="text-caption">—</span> : (
            <>
              <span className="font-medium text-[var(--color-foreground)]">{formatNumber(kpi.targetValue || 0)}</span>
              {kpi.unit && <span className="text-caption"> {kpi.unit}</span>}
            </>
          )}
        </td>
        <td className="px-4 py-3 text-right whitespace-nowrap"><WeightCell kpi={kpi} real={realWeightById.get(kpi.id)} /></td>
        <td className="px-4 py-3"><StatusBadge status={kpi.status} /></td>
        <td className="px-3 py-2 text-right">
          <RowActions kpi={kpi} busy={busy} onView={() => openReview(kpi)} onApprove={() => approveOne(kpi.id)} onReject={() => openReview(kpi, 'reject')} />
        </td>
      </tr>
    )
  }

  /* ── Thẻ (mobile / dạng thẻ) ── */
  const renderKpiCard = (kpi: KpiCriteria, depth: number) => {
    const isSelected = selectedKpis.includes(kpi.id)
    const isChildRow = depth > 0
    const childKpis = childrenByParentId.get(kpi.id) ?? []
    return (
      <div
        key={kpi.id}
        className={cn('rounded-card border bg-[var(--color-card)] p-4', isSelected ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]' : 'border-[var(--color-border)]', isChildRow && 'ml-4')}
      >
        <div className="flex items-start gap-3">
          {kpi.status === 'PENDING_APPROVAL' && (
            <input type="checkbox" aria-label="Chọn chỉ tiêu" checked={isSelected} onChange={() => toggleSelect(kpi.id)} className={cn(CHECKBOX, 'mt-0.5')} />
          )}
          <div className="min-w-0 flex-1">
            <button className="max-w-full truncate text-left text-sm font-medium text-[var(--color-foreground)] transition-colors hover:text-[var(--color-primary)] hover:underline" type="button" onClick={() => openReview(kpi)}>{kpi.name}</button>
            <div className="mt-1"><KpiTagChips kpi={kpi} childCount={childKpis.length} isChildRow={isChildRow} /></div>
          </div>
          <StatusBadge status={kpi.status} />
        </div>
        {!unitMode && (
          <p className="mt-2 truncate text-caption">
            {kpi.orgUnitName || '—'}{!personMode && kpi.assigneeNames?.length ? ` · ${formatAssigneeNames(kpi.assigneeNames)}` : ''}
          </p>
        )}
        {enableOkr && kpi.objectiveName && <p className="mt-1 truncate text-caption">OKR: {kpi.objectiveName}</p>}
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
          <div className="flex items-baseline gap-3 tabular-nums">
            {kpi.kpiType !== 'QUALITATIVE' && (
              <span className="text-sm font-medium text-[var(--color-foreground)]">{formatNumber(kpi.targetValue || 0)}{kpi.unit && <span className="text-caption"> {kpi.unit}</span>}</span>
            )}
            <WeightCell kpi={kpi} real={realWeightById.get(kpi.id)} />
          </div>
          <div className="flex items-center gap-0.5">
            {!isChildRow && childKpis.length > 0 && (
              <Button variant="ghost" size="icon-sm" onClick={() => toggleParentCollapse(kpi.id)} aria-label="Mở/thu KPI con">
                <ChevronDown className={cn('transition-transform', collapsedParents.has(kpi.id) && '-rotate-90')} aria-hidden="true" />
              </Button>
            )}
            <RowActions kpi={kpi} busy={busy} onView={() => openReview(kpi)} onApprove={() => approveOne(kpi.id)} onReject={() => openReview(kpi, 'reject')} />
              </div>
            </div>
          </div>
    )
  }

  const viewToggle = (
    <SegmentedControl
      ariaLabel="Dạng hiển thị"
      value={viewMode}
      onChange={setViewMode}
      options={[
        { value: 'list', label: <List aria-hidden="true" />, title: 'Dạng bảng' },
        { value: 'card', label: <LayoutGrid aria-hidden="true" />, title: 'Dạng thẻ' },
      ]}
    />
  )

  const groupToggle = (unitMode || personMode) && (
    <>
      <Button
        variant="ghost" size="icon-sm" title="Mở tất cả nhóm" aria-label="Mở tất cả nhóm"
        onClick={() => { if (unitMode) unitCollapse.expandAll(visibleUnits.map(u => u.id)); else personCollapse.expandAll(visibleGroups.map(g => g.id)) }}
      >
        <ChevronsUpDown aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="icon-sm" title="Thu gọn tất cả nhóm" aria-label="Thu gọn tất cả nhóm" onClick={() => { unitCollapse.collapseAll(); personCollapse.collapseAll() }}>
        <ChevronsDownUp aria-hidden="true" />
      </Button>
    </>
  )

  const emptyTitle = activeTab === 'PENDING_APPROVAL'
    ? 'Không có chỉ tiêu nào chờ duyệt'
    : activeTab === 'APPROVED' ? 'Chưa có chỉ tiêu nào được duyệt'
    : activeTab === 'REJECTED' ? 'Chưa có chỉ tiêu nào bị trả lại' : 'Không có chỉ tiêu nào'
  const emptyDesc = selectedPeriodId === 'ALL'
    ? 'Khi cấp dưới gửi chỉ tiêu lên, chúng sẽ hiện ở đây.'
    : 'Thử chọn đợt khác hoặc bỏ bộ lọc.'

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <WorkspaceHeader
        id="tour-pending-header"
        title={rawTitle}
        description="Duyệt hoặc trả lại chỉ tiêu cấp dưới gửi lên. Chọn nhiều hàng để duyệt một lần."
        stats={[
          { label: 'Chờ duyệt', value: stats.pending, icon: Clock },
          { label: 'Đã duyệt', value: stats.approved, icon: CheckCircle },
          { label: 'Đã trả lại', value: stats.rejected, icon: Undo2 },
        ]}
      />

      {/* Hàng bộ lọc — thứ tự cố định của nhóm P1: đợt → sắp xếp → [Bộ lọc phụ: OKR] … tìm kiếm → cách hiển thị.
          Hai ô OKR vào popover để hàng luôn vừa một dòng như trang Thiết lập chỉ tiêu. */}
      <FilterBar
        id="tour-pending-toolbar"
        search={{ value: search, onChange: v => { setSearch(v); setPage(0) }, placeholder: 'Tìm chỉ tiêu, đơn vị, nhân sự…', className: 'sm:w-72' }}
        trailing={<>{groupToggle}{viewToggle}</>}
        overflowActiveCount={enableOkr ? (selectedObjectiveId !== 'ALL' ? 1 : 0) + (selectedKeyResultId !== 'ALL' ? 1 : 0) : 0}
        overflow={enableOkr ? (
          <div className="space-y-3">
            <div>
              <p className="text-label mb-1.5">Mục tiêu OKR</p>
              <Select value={selectedObjectiveId} onValueChange={(v) => { setSelectedObjectiveId(v); setSelectedKeyResultId('ALL'); setPage(0) }}>
                <SelectTrigger className="w-full" aria-label="Mục tiêu OKR"><SelectValue placeholder="Mục tiêu" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả mục tiêu</SelectItem>
                  {objectivesData?.map(obj => <SelectItem key={obj.id} value={obj.id}>{obj.code} · {obj.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-label mb-1.5">Kết quả then chốt</p>
              <Select value={selectedKeyResultId} onValueChange={(v) => { setSelectedKeyResultId(v); setPage(0) }} disabled={selectedObjectiveId === 'ALL'}>
                <SelectTrigger className="w-full" aria-label="Kết quả then chốt"><SelectValue placeholder="Kết quả then chốt" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả kết quả</SelectItem>
                  {keyResults.map(kr => <SelectItem key={kr.id} value={kr.id}>{kr.code} · {kr.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : undefined}
      >
        <Select value={selectedPeriodId} onValueChange={(v) => { setSelectedPeriodId(v); setPage(0); resetGroups() }}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Đợt đánh giá"><SelectValue placeholder="Đợt đánh giá" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả các đợt</SelectItem>
            {periodsData?.content.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={`${sortBy}-${sortDir}`} onValueChange={(v) => { const [field, dir] = v.split('-'); if (field && dir) { setSortBy(field); setSortDir(dir as 'asc' | 'desc'); setPage(0) } }}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Sắp xếp"><SelectValue placeholder="Sắp xếp" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updatedAt-desc">Mới cập nhật trước</SelectItem>
            <SelectItem value="updatedAt-asc">Cũ nhất trước</SelectItem>
            <SelectItem value="name-asc">Tên A → Z</SelectItem>
            <SelectItem value="name-desc">Tên Z → A</SelectItem>
            <SelectItem value="weight-desc">Trọng số cao → thấp</SelectItem>
            <SelectItem value="weight-asc">Trọng số thấp → cao</SelectItem>
          </SelectContent>
        </Select>

      </FilterBar>

      {/* Tab trạng thái — kèm số đếm để biết còn bao nhiêu việc trước khi bấm */}
      <div id="tour-pending-tabs" className="flex items-center justify-between gap-3">
        <SegmentedControl
          ariaLabel="Lọc theo trạng thái"
          value={activeTab}
          onChange={handleTabChange}
          options={APPROVAL_TABS.map(tab => ({
            value: tab,
            label: (
              <>
                {TAB_LABELS[tab]}
                <span className="text-[var(--color-muted-foreground)] tabular-nums">
                  {tab === 'ALL' ? stats.total : tab === 'PENDING_APPROVAL' ? stats.pending : tab === 'APPROVED' ? stats.approved : stats.rejected}
                </span>
              </>
            ),
          }))}
        />
        {!isLoading && items.length > 0 && !(unitMode || personMode) && (
          <p className="text-caption tabular-nums">{totalElements} chỉ tiêu</p>
        )}
        </div>

      {hitFetchCap && (
        <div role="status" className="flex items-start gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
          <p className="text-sm text-[var(--color-foreground)]">Chỉ hiển thị {GROUPING_FETCH_SIZE} chỉ tiêu gần nhất. Lọc theo đợt hoặc mục tiêu để xem đủ.</p>
              </div>
            )}

      {/* Nội dung */}
      {isLoading ? (
        <LoadingSkeleton type="table" rows={8} />
      ) : items.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
          <EmptyState icon={Inbox} title={emptyTitle} description={emptyDesc} />
            </div>
      ) : viewMode === 'list' ? (
        <div className="hidden overflow-x-auto rounded-card border border-[var(--color-border)] bg-[var(--color-card)] md:block">
          <table className="w-full">
                <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                <th scope="col" className="w-10 px-3 py-2.5">
                  {pendingSelectable.length > 0 && (
                        <input 
                          type="checkbox" 
                      aria-label={allPendingSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả chỉ tiêu chờ duyệt'}
                      checked={allPendingSelected}
                      ref={el => { if (el) el.indeterminate = somePendingSelected }}
                          onChange={toggleSelectAll}
                      className={CHECKBOX}
                        />
                      )}
                    </th>
                <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Chỉ tiêu</th>
                {enableOkr && <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Mục tiêu / KR</th>}
                {!unitMode && <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">{personMode ? 'Đơn vị' : 'Đơn vị · Nhân sự'}</th>}
                <th scope="col" className="px-4 py-2.5 text-right text-eyebrow">Mục tiêu</th>
                <th scope="col" className="px-4 py-2.5 text-right text-eyebrow">Trọng số</th>
                <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Trạng thái</th>
                <th scope="col" className="px-3 py-2.5 text-right text-eyebrow">Hành động</th>
                  </tr>
                </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {displayRows.map(row => {
                    if (row.kind === 'unit') {
                      return (
                        <UnitGroupHeaderRow
                          key={`unit-${row.unit.id}`}
                          colSpan={tableColSpan}
                          unit={row.unit}
                          expanded={unitCollapse.isExpanded(row.unit.id)}
                          onToggle={() => unitCollapse.toggle(row.unit.id)}
                          isCurrentUnit={row.unit.id === myUnitId}
                          badges={renderUnitBadges(row.unit)}
                        />
                      )
                    }
                    if (row.kind === 'person') {
                      return (
                        <PersonGroupHeaderRow
                          key={`person-${row.key}`}
                          colSpan={tableColSpan}
                          indent={unitMode}
                          person={row.group}
                          expanded={personCollapse.isExpanded(row.key)}
                          onToggle={() => personCollapse.toggle(row.key)}
                          isCurrentUser={row.group.id === user?.id}
                          badges={renderPersonBadges(row.group.items)}
                          actions={renderPersonApproveAction(row.group.items)}
                        />
                      )
                    }
                return renderKpiRow(row.kpi, row.depth)
                  })}
                </tbody>
              </table>
        </div>
      ) : null}

      {/* Dạng thẻ: luôn dùng dưới md, hoặc khi người dùng chọn */}
      {!isLoading && items.length > 0 && (
        <div className={cn('grid grid-cols-1 gap-3', viewMode === 'card' ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:hidden')}>
          {displayRows.map(row => {
                  if (row.kind === 'unit') {
                    return (
                      <div key={`unit-${row.unit.id}`} className="col-span-full">
                  <UnitGroupHeaderCard unit={row.unit} expanded={unitCollapse.isExpanded(row.unit.id)} onToggle={() => unitCollapse.toggle(row.unit.id)} isCurrentUnit={row.unit.id === myUnitId} badges={renderUnitBadges(row.unit)} />
                      </div>
                    )
                  }
                  if (row.kind === 'person') {
                    return (
                <div key={`person-${row.key}`} className={cn('col-span-full', unitMode && 'pl-4')}>
                  <PersonGroupHeaderCard person={row.group} expanded={personCollapse.isExpanded(row.key)} onToggle={() => personCollapse.toggle(row.key)} isCurrentUser={row.group.id === user?.id} badges={renderPersonBadges(row.group.items)} actions={renderPersonApproveAction(row.group.items)} />
                      </div>
                    )
                  }
            return renderKpiCard(row.kpi, row.depth)
          })}
                          </div>
                        )}

      {/* Phân trang theo ĐƠN VỊ (hoặc theo NGƯỜI khi chỉ có một đơn vị); danh sách phẳng chỉ cần dòng đếm ở trên. */}
      {items.length > 0 && (unitMode || personMode) && (
        <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
          <Pagination currentPage={groupPage} totalPages={totalPages} onPageChange={setPage} totalElements={totalGroups} size={GROUP_PAGE_SIZE} itemLabel={unitMode ? 'đơn vị' : 'nhân sự'} />
                          </div>
                        )}

      <BulkActionBar count={selectedKpis.length} onClear={() => setSelectedKpis([])} itemLabel="chỉ tiêu">
        <Button onClick={() => bulkApproveMutation.mutate(selectedKpis)} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle aria-hidden="true" />}
          Duyệt {selectedKpis.length} chỉ tiêu
        </Button>
      </BulkActionBar>

        <KpiReviewModal 
          open={!!reviewKpi} 
          onClose={() => setReviewKpi(null)} 
          kpi={reviewKpi} 
          onEdit={handleEdit}
        initialMode={reviewMode}
        />

      <KpiFormModal open={showEditForm} onClose={() => setShowEditForm(false)} editKpi={editKpi} />
    </div>
  )
}
