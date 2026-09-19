import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import FilterBar, { SegmentedControl } from '@/components/common/FilterBar'
import BulkActionBar from '@/components/common/BulkActionBar'
import StatusBadge from '@/components/common/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import KpiAdjustmentReviewModal from '../components/KpiAdjustmentReviewModal'
import { useKpiAdjustments, useBulkReviewAdjustments } from '../hooks/useKpiAdjustments'
import { cn, formatNumber } from '@/lib/utils'
import type { KpiAdjustmentRequest, AdjustmentStatus } from '@/types/adjustment'
import {
  CheckCircle, XCircle, Eye, Clock, Undo2, AlertCircle, Loader2, LayoutGrid, List,
  ChevronsDownUp, ChevronsUpDown, Inbox, ArrowRight,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
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
/** Trần số yêu cầu tải về một lần để gom nhóm. */
const GROUPING_FETCH_SIZE = 1000
/** Hạn xử lý một yêu cầu: 24 giờ kể từ lúc gửi. */
const REVIEW_WINDOW_MS = 24 * 60 * 60 * 1000

/** Thời gian còn lại để xử lý — cập nhật mỗi phút là đủ, không cần đếm giây. */
function useTimeLeft(createdAt: string, active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [active])
  const diff = new Date(createdAt).getTime() + REVIEW_WINDOW_MS - now
  if (!active) return null
  if (diff <= 0) return { expired: true, label: 'Quá hạn' }
  const h = Math.floor(diff / 3_600_000), m = Math.floor((diff % 3_600_000) / 60_000)
  return { expired: false, label: h > 0 ? `Còn ${h} giờ ${m} phút` : `Còn ${m} phút` }
}

function Deadline({ request }: { request: KpiAdjustmentRequest }) {
  const t = useTimeLeft(request.createdAt, request.status === 'PENDING')
  if (!t) return <span className="text-caption">—</span>
  return (
    <span className={cn('text-[13px] tabular-nums', t.expired ? 'font-medium text-[var(--color-error)]' : 'text-[var(--color-muted-foreground)]')}>
      {t.label}
    </span>
  )
    }

/** Tóm tắt thay đổi trên một dòng: "Mục tiêu 120 → 100 · Trọng số 20% → 15%". */
function ChangeSummary({ request }: { request: KpiAdjustmentRequest }) {
  if (request.deactivationRequest) {
    return <span className="text-sm text-[var(--color-error)]">Ngưng KPI{request.compensationPercentage != null ? ` · bù ${request.compensationPercentage}%` : ''}</span>
  }
  const parts: { label: string; from: string; to: string }[] = []
  if (request.kpiType !== 'QUALITATIVE' && request.requestedTargetValue != null && request.requestedTargetValue !== request.currentTargetValue)
    parts.push({ label: 'Mục tiêu', from: formatNumber(request.currentTargetValue), to: formatNumber(request.requestedTargetValue) })
  if (request.requestedWeight != null && request.requestedWeight !== request.currentWeight)
    parts.push({ label: 'Trọng số', from: `${request.currentWeight}%`, to: `${request.requestedWeight}%` })
  if (request.kpiType !== 'QUALITATIVE' && request.requestedMinimumValue != null && request.requestedMinimumValue !== request.currentMinimumValue)
    parts.push({ label: 'Tối thiểu', from: formatNumber(request.currentMinimumValue ?? 0), to: formatNumber(request.requestedMinimumValue) })
  if (parts.length === 0) return <span className="text-caption">Không đổi số liệu</span>
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm tabular-nums">
      {parts.map(p => (
        <span key={p.label} className="whitespace-nowrap">
          <span className="text-[var(--color-muted-foreground)]">{p.label} </span>
          {p.from} <ArrowRight size={12} className="inline text-[var(--color-subtle-foreground)]" aria-hidden="true" /> <span className="font-medium text-[var(--color-foreground)]">{p.to}</span>
        </span>
      ))}
    </span>
  )
      }
      
function RequestTags({ request }: { request: KpiAdjustmentRequest }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {request.deactivationRequest ? <Badge variant="destructive">Ngưng KPI</Badge> : <Badge variant="warning">Điều chỉnh số liệu</Badge>}
      {request.kpiType === 'QUALITATIVE' && <Badge variant="outline">Định tính</Badge>}
      {request.perspectiveName && (
        <Badge variant="outline" title={`Hạng mục BSC: ${request.perspectiveName}`}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: request.perspectiveColor || 'var(--color-primary)' }} aria-hidden="true" />
          {request.perspectiveName}
        </Badge>
      )}
    </div>
  )
}

/** Ba nút hành động của một hàng — cùng vị trí, cùng icon với trang Phê duyệt chỉ tiêu. */
function RowActions({ request, onView, onApprove, onReject, busy }: {
  request: KpiAdjustmentRequest; onView: () => void; onApprove: () => void; onReject: () => void; busy: boolean
}) {
  const pending = request.status === 'PENDING'
  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button variant="ghost" size="icon-sm" onClick={onView} aria-label="Xem chi tiết" title="Xem chi tiết"><Eye aria-hidden="true" /></Button>
      {pending && (
        <>
          <Button variant="ghost" size="icon-sm" onClick={onApprove} disabled={busy} aria-label="Duyệt" title="Duyệt" className="text-[var(--color-success)] hover:bg-[var(--color-success-bg)]"><CheckCircle aria-hidden="true" /></Button>
          <Button variant="ghost" size="icon-sm" onClick={onReject} disabled={busy} aria-label="Từ chối" title="Từ chối" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)]"><XCircle aria-hidden="true" /></Button>
        </>
      )}
    </div>
  )
}

const CHECKBOX = 'h-4 w-4 cursor-pointer rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-card)] accent-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2'

type AdjustmentTab = AdjustmentStatus | 'ALL'
const ADJUSTMENT_TABS: AdjustmentTab[] = ['PENDING', 'APPROVED', 'REJECTED', 'ALL']
const TAB_LABELS: Record<AdjustmentTab, string> = { PENDING: 'Chờ xử lý', APPROVED: 'Đã duyệt', REJECTED: 'Đã từ chối', ALL: 'Tất cả' }

// `?tab=` dùng chung query string với các mục khác của /performance, nên phải lọc:
// tab của trang duyệt chỉ tiêu lọt sang đây sẽ thành bộ lọc rỗng.
const readTab = (raw: string | null): AdjustmentTab =>
  ADJUSTMENT_TABS.includes(raw as AdjustmentTab) ? (raw as AdjustmentTab) : 'PENDING'

export default function KpiAdjustmentApprovalPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [activeTab, setActiveTab] = useState<AdjustmentTab>(() => readTab(searchParams.get('tab')))
  
  const [selectedPeriodId, setSelectedPeriodId] = useState('ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>('ALL')
  const [selectedKeyResultId, setSelectedKeyResultId] = useState<string>('ALL')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkNote, setBulkNote] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'card'>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 'card' : 'list'
  )
  
  const user = useAuthStore(s => s.user)
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(organizationId)
  const enableOkr = org?.enableOkr
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

  const bulkReviewMutation = useBulkReviewAdjustments()

  useEffect(() => {
    const tab = readTab(searchParams.get('tab'))
    if (tab !== activeTab) {
      setActiveTab(tab)
      setSelectedIds([])
    }
  }, [searchParams])

  const handleTabChange = (tab: AdjustmentTab) => {
    setActiveTab(tab)
    // Giữ nguyên các param khác — ghi đè cả query string sẽ xoá mất `?section=`
    // của SettingsSectionLayout và đá người dùng về lưới thẻ /performance.
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      p.set('tab', tab)
      return p
    }, { replace: true })
    setPage(0)
    setSelectedIds([])
  }

  // Data for Adjustment Requests — tải trọn phạm vi đang lọc (không phân trang ở server) để
  // gom nhóm theo người yêu cầu cho đủ; phân trang lại theo NGƯỜI ở phía dưới.
  const { data: adjustmentData, isLoading } = useKpiAdjustments(
    {
      page: 0,
      size: GROUPING_FETCH_SIZE,
      status: activeTab === 'ALL' ? undefined : activeTab,
      kpiPeriodId: selectedPeriodId === 'ALL' ? undefined : selectedPeriodId,
      objectiveId: selectedObjectiveId === 'ALL' ? undefined : selectedObjectiveId,
      keyResultId: selectedKeyResultId === 'ALL' ? undefined : selectedKeyResultId,
    }
  )

  const items = adjustmentData?.content ?? []
  const totalElements = items.length
  const hitFetchCap = items.length >= GROUPING_FETCH_SIZE

  // Gom ĐƠN VỊ → NGƯỜI YÊU CẦU → yêu cầu, thay cho danh sách phẳng trộn lẫn.
  // Đơn vị lấy theo KPI bị điều chỉnh (backend trả kèm trong AdjustmentRequestResponse).
  const extractRequester = (req: KpiAdjustmentRequest) =>
    [{ id: req.requesterId, name: req.requesterName }]

  const unitGroups = useMemo(
    () => groupByUnitThenPerson(
      items,
      req => req.orgUnitId ? { id: req.orgUnitId, name: req.orgUnitName || 'Đơn vị không tên' } : null,
      extractRequester,
      unitOrder,
    ),
    [items, unitOrder]
  )
  const personGroups = useMemo(() => groupByPerson(items, extractRequester), [items])

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

  /**
   * Danh sách dòng để render: ở chế độ gom nhóm, chèn dòng header đơn vị rồi header người
   * ngay trước các yêu cầu tương ứng; ở chế độ phẳng thì y như cũ.
   */
  type AdjustmentRow =
    | { kind: 'unit'; unit: UnitGroup<KpiAdjustmentRequest> }
    | { kind: 'person'; group: (typeof personGroups)[number]; key: string }
    | { kind: 'request'; request: KpiAdjustmentRequest }

  const pushPerson = (out: AdjustmentRow[], group: (typeof personGroups)[number], key: string) => {
    out.push({ kind: 'person', group, key })
    if (!personCollapse.isExpanded(key)) return
    group.items.forEach(request => out.push({ kind: 'request', request }))
  }

  const buildDisplayRows = (): AdjustmentRow[] => {
    const out: AdjustmentRow[] = []
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
    return items.map(request => ({ kind: 'request' as const, request }))
  }
  const displayRows = buildDisplayRows()

  /** Số cột của bảng — header nhóm phải trải hết chiều ngang. */
  const tableColSpan = 7 + (activeTab === 'PENDING' ? 0 : 1) + (personMode ? 0 : 1)

  /** Số liệu tóm tắt của một đơn vị. */
  const renderUnitBadges = (unit: UnitGroup<KpiAdjustmentRequest>) => {
    const pending = unit.items.filter(r => r.status === 'PENDING').length
    return (
      <>
        <PersonGroupBadge label="nhân sự" value={unit.people.length} tone="indigo" />
        <PersonGroupBadge label="yêu cầu" value={unit.items.length} />
        {pending > 0 && <PersonGroupBadge label="đợi xử lý" value={pending} tone="amber" />}
      </>
    )
  }

  /** Số liệu tóm tắt của một người yêu cầu. */
  const renderPersonBadges = (list: KpiAdjustmentRequest[]) => {
    const pending = list.filter(r => r.status === 'PENDING').length
    const approved = list.filter(r => r.status === 'APPROVED').length
    const rejected = list.filter(r => r.status === 'REJECTED').length
    return (
      <>
        <PersonGroupBadge label="yêu cầu" value={list.length} />
        {pending > 0 && <PersonGroupBadge label="đợi xử lý" value={pending} tone="amber" />}
        {approved > 0 && <PersonGroupBadge label="chấp thuận" value={approved} tone="emerald" />}
        {rejected > 0 && <PersonGroupBadge label="từ chối" value={rejected} tone="rose" />}
      </>
    )
  }

  /** Chọn nhanh toàn bộ yêu cầu đang chờ (duyệt hàng loạt được) của riêng một người. */
  const renderPersonSelectAction = (list: KpiAdjustmentRequest[]) => {
    const ids = list.filter(r => r.status === 'PENDING' && !r.deactivationRequest).map(r => r.id)
    if (ids.length === 0) return null
    const allSelected = ids.every(id => selectedIds.includes(id))
    return (
      <Button
        variant={allSelected ? 'secondary' : 'outline'} size="sm"
        onClick={() => setSelectedIds(prev => allSelected ? prev.filter(id => !ids.includes(id)) : Array.from(new Set([...prev, ...ids])))}
        title={`Chọn ${ids.length} yêu cầu đang chờ của người này`}
        aria-pressed={allSelected}
      >
        {allSelected ? 'Bỏ chọn' : `Chọn ${ids.length}`}
      </Button>
    )
  }

  const { data: objectivesData } = useObjectives(organizationId)
  const selectedObjective = objectivesData?.find((o: ObjectiveResponse) => o.id === selectedObjectiveId)
  const keyResults = selectedObjective?.keyResults || []

  const { data: customLabels = {} } = useSidebarSettings(organizationId!)
  const rawTitle = (customLabels as Record<string, string>)['/kpi-criteria/adjustments'] || 'Điều chỉnh chỉ tiêu'

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }
  
  const toggleSelectAll = () => {
    const pendingItems = items.filter(i => i.status === 'PENDING' && !i.deactivationRequest)
    const pendingIds = pendingItems.map(i => i.id)
    const allPendingSelected = pendingIds.length > 0 && pendingIds.every(id => selectedIds.includes(id))

    if (allPendingSelected) {
      setSelectedIds(prev => prev.filter(id => !pendingIds.includes(id)))
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...pendingIds])))
    }
  }

  const handleBulkReview = (status: AdjustmentStatus) => {
    if (status === 'REJECTED' && !bulkNote.trim()) {
      toast.error('Vui lòng nhập lý do từ chối')
      return
    }

    bulkReviewMutation.mutate({ ids: selectedIds, status, reviewerNote: bulkNote }, {
      onSuccess: () => {
        toast.success(`Đã ${status === 'APPROVED' ? 'duyệt' : 'từ chối'} ${selectedIds.length} yêu cầu`)
        setSelectedIds([])
        setBulkNote('')
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error, 'Xử lý hàng loạt thất bại'))
      }
    })
  }

  const [reviewAdjustment, setReviewAdjustment] = useState<KpiAdjustmentRequest | null>(null)

  const { data: allAdjustmentsData } = useKpiAdjustments({
    size: 1000,
    kpiPeriodId: selectedPeriodId === 'ALL' ? undefined : selectedPeriodId,
    objectiveId: selectedObjectiveId === 'ALL' ? undefined : selectedObjectiveId,
    keyResultId: selectedKeyResultId === 'ALL' ? undefined : selectedKeyResultId,
  })
  const stats = useMemo(() => {
    const all = allAdjustmentsData?.content ?? []
    return {
      total: all.length,
      pending: all.filter(k => k.status === 'PENDING').length,
      approved: all.filter(k => k.status === 'APPROVED').length,
      rejected: all.filter(k => k.status === 'REJECTED').length,
    }
  }, [allAdjustmentsData])

  const [reviewMode, setReviewMode] = useState<'view' | 'approve' | 'reject'>('view')
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false)
  const busy = bulkReviewMutation.isPending
  const openReview = (r: KpiAdjustmentRequest, mode: 'view' | 'approve' | 'reject' = 'view') => { setReviewMode(mode); setReviewAdjustment(r) }
  const approveOne = (id: string) =>
    bulkReviewMutation.mutate({ ids: [id], status: 'APPROVED', reviewerNote: '' }, {
      onSuccess: () => { toast.success('Đã duyệt yêu cầu'); setSelectedIds(prev => prev.filter(x => x !== id)) },
      onError: (error) => toast.error(getApiErrorMessage(error, 'Duyệt yêu cầu thất bại')),
    })

  const selectableIds = items.filter(i => i.status === 'PENDING' && !i.deactivationRequest).map(i => i.id)
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.includes(id))
  const someSelected = selectedIds.length > 0 && !allSelected
  const showFeedbackCol = activeTab !== 'PENDING'

  const renderRow = (request: KpiAdjustmentRequest) => {
    const isSelected = selectedIds.includes(request.id)
    const canSelect = request.status === 'PENDING' && !request.deactivationRequest
  return (
      <tr key={request.id} aria-selected={isSelected || undefined} className={cn('transition-colors', isSelected ? 'bg-[var(--color-primary-soft)]' : 'hover:bg-[var(--color-muted)]')}>
        <td className="w-10 px-3 py-3">
          {canSelect && <input type="checkbox" aria-label="Chọn yêu cầu" checked={isSelected} onChange={() => toggleSelect(request.id)} className={CHECKBOX} />}
        </td>
        <td className="px-4 py-3">
          <div className="min-w-0 max-w-[320px]">
            <button className="max-w-full truncate text-left text-sm font-medium text-[var(--color-foreground)] transition-colors hover:text-[var(--color-primary)] hover:underline max-w-full" type="button" onClick={() => openReview(request)} title={request.kpiCriteriaName}>
              {request.kpiCriteriaName}
                </button>
            <div className="mt-0.5"><RequestTags request={request} /></div>
                          </div>
                        </td>
                        {!personMode && (
          <td className="px-4 py-3">
            <p className="max-w-[180px] truncate text-sm text-[var(--color-foreground)]" title={request.requesterName}>{request.requesterName}</p>
            {!unitMode && request.orgUnitName && <p className="max-w-[180px] truncate text-caption" title={request.orgUnitName}>{request.orgUnitName}</p>}
                          </td>
                        )}
        <td className="px-4 py-3"><ChangeSummary request={request} /></td>
        <td className="px-4 py-3">
          <p className="line-clamp-2 max-w-[260px] text-sm text-[var(--color-muted-foreground)]" title={request.reason}>{request.reason}</p>
                        </td>
        {showFeedbackCol && (
          <td className="px-4 py-3">
            {request.reviewerNote
              ? <p className="line-clamp-2 max-w-[220px] text-sm text-[var(--color-foreground)]" title={request.reviewerNote}>{request.reviewerNote}</p>
              : <span className="text-caption">—</span>}
                          </td>
                        )}
        <td className="px-4 py-3 whitespace-nowrap"><Deadline request={request} /></td>
        <td className="px-4 py-3"><StatusBadge status={request.status} /></td>
        <td className="px-3 py-2 text-right">
          <RowActions request={request} busy={busy} onView={() => openReview(request)} onApprove={() => request.deactivationRequest ? openReview(request, 'approve') : approveOne(request.id)} onReject={() => openReview(request, 'reject')} />
                        </td>
                      </tr>
                    )
  }

  const renderCard = (request: KpiAdjustmentRequest) => {
    const isSelected = selectedIds.includes(request.id)
    const canSelect = request.status === 'PENDING' && !request.deactivationRequest
                    return (
      <div key={request.id} className={cn('rounded-card border bg-[var(--color-card)] p-4', isSelected ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]' : 'border-[var(--color-border)]')}>
        <div className="flex items-start gap-3">
          {canSelect && <input type="checkbox" aria-label="Chọn yêu cầu" checked={isSelected} onChange={() => toggleSelect(request.id)} className={cn(CHECKBOX, 'mt-0.5')} />}
          <div className="min-w-0 flex-1">
            <button className="max-w-full truncate text-left text-sm font-medium text-[var(--color-foreground)] transition-colors hover:text-[var(--color-primary)] hover:underline" type="button" onClick={() => openReview(request)}>{request.kpiCriteriaName}</button>
            <div className="mt-1"><RequestTags request={request} /></div>
                      </div>
          <StatusBadge status={request.status} />
                      </div>
        {!personMode && <p className="mt-2 truncate text-caption">{request.requesterName}{!unitMode && request.orgUnitName ? ` · ${request.orgUnitName}` : ''}</p>}
        <div className="mt-2"><ChangeSummary request={request} /></div>
        <p className="mt-2 line-clamp-2 text-sm text-[var(--color-muted-foreground)]">{request.reason}</p>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
          <Deadline request={request} />
          <RowActions request={request} busy={busy} onView={() => openReview(request)} onApprove={() => request.deactivationRequest ? openReview(request, 'approve') : approveOne(request.id)} onReject={() => openReview(request, 'reject')} />
      </div>
    </div>
  )
}

  const viewToggle = (
    <SegmentedControl ariaLabel="Dạng hiển thị" value={viewMode} onChange={setViewMode}
      options={[{ value: 'list', label: <List aria-hidden="true" />, title: 'Dạng bảng' }, { value: 'card', label: <LayoutGrid aria-hidden="true" />, title: 'Dạng thẻ' }]} />
  )
  const groupToggle = (unitMode || personMode) && (
    <>
      <Button variant="ghost" size="icon-sm" title="Mở tất cả nhóm" aria-label="Mở tất cả nhóm" onClick={() => { if (unitMode) unitCollapse.expandAll(visibleUnits.map(u => u.id)); else personCollapse.expandAll(visibleGroups.map(g => g.id)) }}><ChevronsUpDown aria-hidden="true" /></Button>
      <Button variant="ghost" size="icon-sm" title="Thu gọn tất cả nhóm" aria-label="Thu gọn tất cả nhóm" onClick={() => { unitCollapse.collapseAll(); personCollapse.collapseAll() }}><ChevronsDownUp aria-hidden="true" /></Button>
    </>
  )

  const emptyTitle = activeTab === 'PENDING' ? 'Không có yêu cầu nào chờ xử lý'
    : activeTab === 'APPROVED' ? 'Chưa có yêu cầu nào được duyệt'
    : activeTab === 'REJECTED' ? 'Chưa có yêu cầu nào bị từ chối' : 'Không có yêu cầu điều chỉnh'
  const emptyDesc = selectedPeriodId === 'ALL' ? 'Khi nhân sự đề nghị sửa chỉ tiêu giữa đợt, yêu cầu sẽ hiện ở đây.' : 'Thử chọn đợt khác hoặc bỏ bộ lọc.'
  
  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <WorkspaceHeader
        id="tour-adj-header"
        title={rawTitle}
        description="Xử lý đề nghị sửa mục tiêu, trọng số hoặc ngưng chỉ tiêu giữa đợt. Mỗi yêu cầu có 24 giờ để xử lý."
        stats={[
          { label: 'Chờ xử lý', value: stats.pending, icon: Clock },
          { label: 'Đã duyệt', value: stats.approved, icon: CheckCircle },
          { label: 'Đã từ chối', value: stats.rejected, icon: Undo2 },
        ]}
      />

      <FilterBar
        id="tour-adj-toolbar"
        search={{ value: search, onChange: v => { setSearch(v); setPage(0) }, placeholder: 'Tìm chỉ tiêu, người yêu cầu…' }}
        trailing={<>{groupToggle}{viewToggle}</>}
      >
        <Select value={selectedPeriodId} onValueChange={(v) => { setSelectedPeriodId(v); setPage(0); resetGroups() }}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-52" aria-label="Đợt đánh giá"><SelectValue placeholder="Đợt đánh giá" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả các đợt</SelectItem>
            {periodsData?.content.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {enableOkr && (
          <>
            <Select value={selectedObjectiveId} onValueChange={(v) => { setSelectedObjectiveId(v); setSelectedKeyResultId('ALL'); setPage(0) }}>
              <SelectTrigger className="w-full sm:w-auto sm:min-w-56" aria-label="Mục tiêu OKR"><SelectValue placeholder="Mục tiêu" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả mục tiêu</SelectItem>
                {objectivesData?.map(obj => <SelectItem key={obj.id} value={obj.id}>{obj.code} · {obj.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedKeyResultId} onValueChange={(v) => { setSelectedKeyResultId(v); setPage(0) }} disabled={selectedObjectiveId === 'ALL'}>
              <SelectTrigger className="w-full sm:w-auto sm:min-w-56" aria-label="Kết quả then chốt"><SelectValue placeholder="Kết quả then chốt" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả kết quả</SelectItem>
                {keyResults.map(kr => <SelectItem key={kr.id} value={kr.id}>{kr.code} · {kr.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        )}
      </FilterBar>

      <div id="tour-adj-tabs" className="flex items-center justify-between gap-3">
        <SegmentedControl
          ariaLabel="Lọc theo trạng thái"
          value={activeTab}
          onChange={handleTabChange}
          options={ADJUSTMENT_TABS.map(tab => ({
            value: tab,
            label: (
              <>
                {TAB_LABELS[tab]}
                <span className="text-[var(--color-muted-foreground)] tabular-nums">
                  {tab === 'ALL' ? stats.total : tab === 'PENDING' ? stats.pending : tab === 'APPROVED' ? stats.approved : stats.rejected}
                </span>
              </>
            ),
          }))}
        />
        {!isLoading && items.length > 0 && !(unitMode || personMode) && <p className="text-caption tabular-nums">{totalElements} yêu cầu</p>}
      </div>

      {hitFetchCap && (
        <div role="status" className="flex items-start gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
          <p className="text-sm text-[var(--color-foreground)]">Chỉ hiển thị {GROUPING_FETCH_SIZE} yêu cầu gần nhất. Lọc theo đợt để xem đủ.</p>
        </div>
      )}

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
                  {selectableIds.length > 0 && (
                    <input type="checkbox" aria-label={allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả yêu cầu chờ xử lý'} checked={allSelected} ref={el => { if (el) el.indeterminate = someSelected }} onChange={toggleSelectAll} className={CHECKBOX} />
                  )}
                </th>
                <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Chỉ tiêu</th>
                {!personMode && <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Người yêu cầu</th>}
                <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Thay đổi</th>
                <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Lý do</th>
                {showFeedbackCol && <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Phản hồi</th>}
                <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Hạn xử lý</th>
                <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Trạng thái</th>
                <th scope="col" className="px-3 py-2.5 text-right text-eyebrow">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {displayRows.map(row => {
                if (row.kind === 'unit') {
                  return <UnitGroupHeaderRow key={`unit-${row.unit.id}`} colSpan={tableColSpan} unit={row.unit} expanded={unitCollapse.isExpanded(row.unit.id)} onToggle={() => unitCollapse.toggle(row.unit.id)} isCurrentUnit={row.unit.id === myUnitId} badges={renderUnitBadges(row.unit)} />
                }
                if (row.kind === 'person') {
                  return <PersonGroupHeaderRow key={`person-${row.key}`} colSpan={tableColSpan} indent={unitMode} person={row.group} expanded={personCollapse.isExpanded(row.key)} onToggle={() => personCollapse.toggle(row.key)} isCurrentUser={row.group.id === user?.id} badges={renderPersonBadges(row.group.items)} actions={renderPersonSelectAction(row.group.items)} />
                }
                return renderRow(row.request)
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {!isLoading && items.length > 0 && (
        <div className={cn('grid grid-cols-1 gap-3', viewMode === 'card' ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:hidden')}>
          {displayRows.map(row => {
            if (row.kind === 'unit') {
              return <div key={`unit-${row.unit.id}`} className="col-span-full"><UnitGroupHeaderCard unit={row.unit} expanded={unitCollapse.isExpanded(row.unit.id)} onToggle={() => unitCollapse.toggle(row.unit.id)} isCurrentUnit={row.unit.id === myUnitId} badges={renderUnitBadges(row.unit)} /></div>
            }
            if (row.kind === 'person') {
              return <div key={`person-${row.key}`} className={cn('col-span-full', unitMode && 'pl-4')}><PersonGroupHeaderCard person={row.group} expanded={personCollapse.isExpanded(row.key)} onToggle={() => personCollapse.toggle(row.key)} isCurrentUser={row.group.id === user?.id} badges={renderPersonBadges(row.group.items)} actions={renderPersonSelectAction(row.group.items)} /></div>
            }
            return renderCard(row.request)
          })}
        </div>
      )}

      {items.length > 0 && (unitMode || personMode) && (
        <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
          <Pagination currentPage={groupPage} totalPages={totalPages} onPageChange={setPage} totalElements={totalGroups} size={GROUP_PAGE_SIZE} itemLabel={unitMode ? 'đơn vị' : 'nhân sự'} />
        </div>
      )}

      <BulkActionBar count={selectedIds.length} onClear={() => { setSelectedIds([]); setBulkNote('') }} itemLabel="yêu cầu">
        <Button variant="outline" onClick={() => setBulkRejectOpen(true)} disabled={busy} className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)]">
          <XCircle aria-hidden="true" /> Từ chối…
        </Button>
        <Button onClick={() => handleBulkReview('APPROVED')} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle aria-hidden="true" />}
          Duyệt {selectedIds.length} yêu cầu
        </Button>
      </BulkActionBar>

      {/* Từ chối hàng loạt cần một lý do chung — hỏi trong hộp thoại nhỏ, không nhét ô nhập vào thanh dính đáy. */}
      <Dialog
        open={bulkRejectOpen}
        onClose={() => setBulkRejectOpen(false)}
        size="sm"
        dismissible={!busy}
        title={`Từ chối ${selectedIds.length} yêu cầu`}
        description="Một lý do chung sẽ gửi tới tất cả người yêu cầu đã chọn."
        footer={
          <DialogFooter
            secondary={<Button variant="outline" onClick={() => setBulkRejectOpen(false)} disabled={busy}>Hủy</Button>}
            primary={
              <Button variant="destructive" disabled={busy || !bulkNote.trim()} onClick={() => { handleBulkReview('REJECTED'); setBulkRejectOpen(false) }}>
                {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <XCircle aria-hidden="true" />} Từ chối
              </Button>
            }
          />
        }
      >
        <label htmlFor="bulk-reject-note" className="text-label block">Lý do từ chối <span className="text-[var(--color-error)]" aria-hidden="true">*</span></label>
        <textarea
          id="bulk-reject-note"
          value={bulkNote}
          onChange={e => setBulkNote(e.target.value)}
          rows={3}
          className="mt-1.5 w-full resize-none rounded-control border border-[var(--color-input)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
          placeholder="Nêu rõ vì sao không chấp nhận các điều chỉnh này."
        />
      </Dialog>

      <KpiAdjustmentReviewModal
        key={reviewAdjustment?.id ?? 'none'}
        open={!!reviewAdjustment}
        onClose={() => setReviewAdjustment(null)}
        request={reviewAdjustment}
        initialMode={reviewMode}
      />
    </div>
  )
}
