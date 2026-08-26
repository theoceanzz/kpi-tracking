import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import KpiReviewModal from '../components/KpiReviewModal'
import KpiFormModal from '../components/KpiFormModal'
import { useKpiCriteria } from '../hooks/useKpiCriteria'
import { formatNumber, formatAssigneeNames, cn, FREQUENCY_MAP, STATUS_CONFIG } from '@/lib/utils'
import type { KpiCriteria } from '@/types/kpi'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import {
  Users, Building2, ChevronRight, ArrowUpDown,
  Calendar, Search, CheckCircle, AlertCircle,
  ShieldCheck, Target, GitBranch,
  Loader2, ChevronDown, CornerDownRight,
  LayoutGrid, List
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

// `?tab=` dùng chung query string với các mục khác của /performance, nên phải lọc:
// tab của trang điều chỉnh lọt sang đây sẽ thành bộ lọc rỗng.
const readTab = (raw: string | null): ApprovalTab =>
  APPROVAL_TABS.includes(raw as ApprovalTab) ? (raw as ApprovalTab) : 'PENDING_APPROVAL'

export default function KpiApprovalPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [activeTab, setActiveTab] = useState<ApprovalTab>(() => readTab(searchParams.get('tab')))
  
  const [selectedPeriodId, setSelectedPeriodId] = useState('ALL')
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
  const rawTitle = ((customLabels as Record<string, string>)['/kpi-criteria/pending'] || 'Duyệt chỉ tiêu')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  const titleParts = rawTitle.trim().split(' ')
  const lastWord = titleParts.length > 1 ? titleParts.pop() : ''
  const mainTitle = titleParts.join(' ')

  const [reviewKpi, setReviewKpi] = useState<KpiCriteria | null>(null)
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
  const tableColSpan = 7 + (enableOkr ? 2 : 0) - (unitMode ? 1 : 0)

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
      <button
        onClick={() => bulkApproveMutation.mutate(pendingIds)}
        disabled={bulkApproveMutation.isPending}
        title={`Phê duyệt ${pendingIds.length} chỉ tiêu đang chờ của người này`}
        className="flex items-center gap-2 px-3 h-8 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all active:scale-95 disabled:opacity-50"
      >
        {bulkApproveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
        Duyệt {pendingIds.length}
      </button>
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
      toast.success(`Đã phê duyệt thành công ${results.length} chỉ tiêu`)
      setSelectedKpis([])
    },
    onError: () => toast.error('Đã xảy ra lỗi khi duyệt hàng loạt')
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

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
        
        {/* Header Section with Glass Card */}
        <div className="relative group" id="tour-pending-header">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-[40px] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
          <div className="relative bg-white dark:bg-slate-900 rounded-[28px] p-6 border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
                  <ShieldCheck size={12} className="animate-pulse" /> Trung tâm Phê duyệt
                </div>
                <div className="space-y-0.5">
                  <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                    {mainTitle} <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">{lastWord}</span>
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm max-w-xl leading-relaxed">
                    Hệ thống hóa quy trình phê duyệt chỉ tiêu cho toàn bộ tổ chức.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full sm:w-auto">
                <StatChip label="Đợi duyệt" value={stats.pending} color="amber" />
                <StatChip label="Từ chối" value={stats.rejected} color="red" />
                <StatChip label="Đã duyệt" value={stats.approved} color="emerald" />
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div id="tour-pending-toolbar" className="flex flex-col gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-5 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm">
          {/* Hàng 1 — Tìm kiếm & chế độ xem. Mọi control cùng chiều cao h-11, bo rounded-2xl. */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative group flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0) }}
                placeholder="Tìm tên chỉ tiêu, phòng ban, nhân sự..."
                className="w-full h-11 pl-12 pr-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Mở/đóng nhanh mọi nhóm đang hiển thị — đặt cạnh nút đổi chế độ xem vì
                cùng là thao tác lên cách hiển thị danh sách, không phải bộ lọc. */}
            {(unitMode || personMode) && (
              <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 self-start lg:self-auto shrink-0">
                <button
                  onClick={() => {
                    if (unitMode) unitCollapse.expandAll(visibleUnits.map(u => u.id))
                    else personCollapse.expandAll(visibleGroups.map(g => g.id))
                  }}
                  title="Mở tất cả nhóm"
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition-all active:scale-95"
                >
                  <ChevronDown size={14} /> Mở
                </button>
                <button
                  onClick={() => { unitCollapse.collapseAll(); personCollapse.collapseAll() }}
                  title="Đóng tất cả nhóm"
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition-all active:scale-95"
                >
                  <ChevronRight size={14} /> Đóng
                </button>
              </div>
            )}

            <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 self-start lg:self-auto shrink-0">
              <button
                onClick={() => setViewMode('list')}
                title="Dạng danh sách"
                className={cn(
                  "w-9 h-9 flex items-center justify-center rounded-xl transition-all",
                  viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                )}
              >
                <List size={18} />
              </button>
              <button
                onClick={() => setViewMode('card')}
                title="Dạng thẻ"
                className={cn(
                  "w-9 h-9 flex items-center justify-center rounded-xl transition-all",
                  viewMode === 'card' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                )}
              >
                <LayoutGrid size={18} />
              </button>
            </div>
          </div>

          {/* Hàng 2 — Bộ lọc. Danh sách đã gom theo Đơn vị → Người nên bỏ hẳn bộ lọc "Chọn đơn vị";
              chỗ đó dành cho nút mở/đóng nhanh các nhóm, đẩy về mép phải. */}
          <div className="flex flex-wrap items-center gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800/60">
            <div className="w-full sm:w-52">
              <Select value={selectedPeriodId} onValueChange={(v) => { setSelectedPeriodId(v); setPage(0); resetGroups() }}>
                <SelectTrigger className="w-full h-11 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold text-xs focus:ring-2 focus:ring-indigo-500/20">
                  <Calendar size={14} className="text-indigo-500 mr-2 shrink-0" />
                  <SelectValue placeholder="Đợt KPI..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2">
                  <SelectItem value="ALL" className="rounded-xl text-sm font-bold">Tất cả đợt KPI</SelectItem>
                  {periodsData?.content.map(p => (
                    <SelectItem key={p.id} value={p.id} className="rounded-xl text-sm font-bold">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-52">
              <Select value={`${sortBy}-${sortDir}`} onValueChange={(v) => {
                const [field, dir] = v.split('-')
                if (field && dir) {
                  setSortBy(field)
                  setSortDir(dir as 'asc' | 'desc')
                  setPage(0)
                }
              }}>
                <SelectTrigger className="w-full h-11 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold text-xs focus:ring-2 focus:ring-indigo-500/20">
                  <div className="flex items-center gap-2">
                    <ArrowUpDown size={14} className="text-indigo-500 shrink-0" />
                    <SelectValue placeholder="Sắp xếp..." />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2">
                  <SelectItem value="updatedAt-desc" className="rounded-xl text-xs font-bold">Cập nhật mới nhất</SelectItem>
                  <SelectItem value="updatedAt-asc" className="rounded-xl text-xs font-bold">Cập nhật cũ nhất</SelectItem>
                  <SelectItem value="name-asc" className="rounded-xl text-xs font-bold">Tên A-Z</SelectItem>
                  <SelectItem value="name-desc" className="rounded-xl text-xs font-bold">Tên Z-A</SelectItem>
                  <SelectItem value="weight-desc" className="rounded-xl text-xs font-bold">Trọng số cao</SelectItem>
                  <SelectItem value="weight-asc" className="rounded-xl text-xs font-bold">Trọng số thấp</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>

          {/* Hàng 3 — Bộ lọc OKR, giữ nguyên một dòng riêng dưới cùng. */}
          {enableOkr && (
            <div className="flex flex-col md:flex-row md:items-center gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800/60">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 md:min-w-[128px] shrink-0">
                <Target size={16} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">Bộ lọc OKR</span>
              </div>

              <div className="w-full md:flex-1">
                <Select value={selectedObjectiveId} onValueChange={(v) => { setSelectedObjectiveId(v); setSelectedKeyResultId('ALL'); setPage(0) }}>
                  <SelectTrigger className="h-11 rounded-2xl border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-900/10 font-bold text-xs text-indigo-900 dark:text-indigo-100">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Target size={14} className="text-indigo-400 shrink-0" />
                      <div className="truncate">
                        <SelectValue placeholder="Chọn Mục tiêu chiến lược" />
                      </div>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800">
                    <SelectItem value="ALL" className="font-bold">Tất cả Mục tiêu</SelectItem>
                    {objectivesData?.map(obj => (
                      <SelectItem key={obj.id} value={obj.id} className="font-medium">[{obj.code}] {obj.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full md:flex-1">
                <Select value={selectedKeyResultId} onValueChange={(v) => { setSelectedKeyResultId(v); setPage(0) }} disabled={selectedObjectiveId === 'ALL'}>
                  <SelectTrigger className="h-11 rounded-2xl border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-900/10 font-bold text-xs text-indigo-900 dark:text-indigo-100 disabled:opacity-50 transition-all">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <GitBranch size={14} className="text-indigo-400 shrink-0" />
                      <div className="truncate">
                        <SelectValue placeholder="Chọn Kết quả then chốt" />
                      </div>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800">
                    <SelectItem value="ALL" className="font-bold">Tất cả Kết quả</SelectItem>
                    {keyResults.map(kr => (
                      <SelectItem key={kr.id} value={kr.id} className="font-medium">[{kr.code}] {kr.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Status Tabs Row */}
        <div id="tour-pending-tabs" className="flex flex-wrap items-center gap-2.5 sm:gap-3 py-2">
          {(['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ALL'] as const).map((tab) => {
            const labels: Record<string, string> = { 
              PENDING_APPROVAL: 'Đợi duyệt', 
              APPROVED: 'Đã duyệt', 
              REJECTED: 'Từ chối', 
              ALL: 'Tất cả' 
            }
            const active = activeTab === tab
            return (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={cn(
                  "px-7 py-3 rounded-full text-[11px] font-black uppercase tracking-[0.15em] transition-all duration-300 border-2 shadow-sm whitespace-nowrap",
                  active 
                    ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900 shadow-indigo-500/10 scale-105' 
                    : 'bg-white border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-white'
                )}
              >
                {labels[tab]}
              </button>
            )
          })}
        </div>

        {/* Bulk Action Bar */}
        {selectedKpis.length > 0 && (
          <div className="fixed bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 duration-500 w-[92vw] sm:w-auto">
            <div className="bg-slate-900 dark:bg-indigo-950 text-white px-4 sm:px-8 py-3.5 rounded-[24px] shadow-2xl flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-6 border border-white/10 backdrop-blur-xl">
              <div className="flex items-center justify-between sm:justify-start gap-3 sm:border-r border-white/10 sm:pr-6 whitespace-nowrap">
                <div className="flex flex-col items-start">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500/50">Đã chọn</span>
                  <span className="text-sm font-black tracking-tight">{selectedKpis.length} mục</span>
                </div>
                <button 
                  onClick={() => setSelectedKpis([])}
                  className="text-[10px] font-black uppercase tracking-widest bg-white/10 px-2 py-1 rounded-lg hover:bg-white/20 transition-all ml-2"
                >
                  Bỏ chọn
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => bulkApproveMutation.mutate(selectedKpis)}
                  disabled={bulkApproveMutation.isPending}
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 whitespace-nowrap"
                >
                   {bulkApproveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />} Duyệt hàng loạt
                </button>
              </div>
            </div>
          </div>
        )}

        {hitFetchCap && (
          <div className="flex items-center gap-3 px-6 py-4 rounded-[20px] bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40">
            <AlertCircle size={18} className="text-amber-500 shrink-0" />
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
              Dữ liệu quá lớn nên chỉ hiển thị {GROUPING_FETCH_SIZE} chỉ tiêu gần nhất — hãy lọc thêm theo đợt hoặc phòng ban để xem đầy đủ.
            </p>
          </div>
        )}

        {/* Content Section */}
        {isLoading ? (
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
            <LoadingSkeleton type="table" rows={8} />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-[40px] border border-dashed border-slate-300 dark:border-slate-700 p-24 shadow-sm text-center">
            <EmptyState 
              title={activeTab === 'PENDING_APPROVAL' ? 'Không có chỉ tiêu nào đang chờ' : 'Không có dữ liệu'} 
              description="Hãy thay đổi bộ lọc hoặc đợi báo cáo từ các phòng ban." 
            />
          </div>
        ) : (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[32px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
            {viewMode === 'list' && <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <th className="px-4 py-5 w-12">
                      {items.some(k => k.status === 'PENDING_APPROVAL') && (
                        <input 
                          type="checkbox" 
                          checked={items.length > 0 && items.filter(k => k.status === 'PENDING_APPROVAL').length > 0 && selectedKpis.length === items.filter(k => k.status === 'PENDING_APPROVAL').length}
                          onChange={toggleSelectAll}
                          className="w-5 h-5 rounded-lg border-2 border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer accent-indigo-600"
                        />
                      )}
                    </th>
                    <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Trạng thái</th>
                    <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">
                      <button onClick={() => { setSortBy('name'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc') }} className="flex items-center gap-2 hover:text-indigo-600 transition-colors group">
                        Chỉ tiêu <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </th>
                    {enableOkr && (
                      <>
                        <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Mục tiêu (OKR)</th>
                        <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Kết quả (KR)</th>
                      </>
                    )}
                    {/* Gom nhóm rồi thì đơn vị và tên nhân sự đã nằm ở header nhóm — bỏ hẳn
                        cột này khi gom ba cấp, bỏ nửa "nhân sự" khi gom hai cấp. */}
                    {!unitMode && (
                      <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">
                        {personMode ? 'Phòng ban' : 'Phòng ban / Nhân sự'}
                      </th>
                    )}
                    <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right whitespace-nowrap">Mục tiêu</th>
                    <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Trọng số</th>
                    <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {displayRows.map((row, i: number) => {
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
                    const { kpi, depth } = row
                    const status = STATUS_CONFIG[kpi.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG['PENDING_APPROVAL']!
                    const StatusIcon = status.icon
                    const isSelected = selectedKpis.includes(kpi.id)
                    const isChildRow = depth > 0
                    const childKpis = childrenByParentId.get(kpi.id) ?? []

                    return (
                      <tr
                        key={kpi.id}
                        className={cn(
                          "group transition-all duration-300 animate-in fade-in slide-in-from-left-4",
                          isSelected ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : isChildRow ? 'bg-slate-50/40 dark:bg-slate-800/20 hover:bg-slate-100/60 dark:hover:bg-slate-800/40' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                        )}
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <td className="px-4 py-5">
                          {kpi.status === 'PENDING_APPROVAL' && (
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => toggleSelect(kpi.id)}
                              className="w-5 h-5 rounded-lg border-2 border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer accent-indigo-600"
                            />
                          )}
                        </td>
                        <td className="px-4 py-5">
                          <div className="flex flex-col items-start gap-1.5">
                            <div className={cn(
                              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest shadow-sm whitespace-nowrap",
                              status.bgColor, status.color
                            )}>
                              <StatusIcon size={12} className={kpi.status === 'PENDING_APPROVAL' ? 'animate-pulse' : ''} /> {status.label}
                            </div>
                            {kpi.effectivePerspectiveName && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border whitespace-nowrap"
                                style={{
                                  color: kpi.effectivePerspectiveColor || '#8b5cf6',
                                  borderColor: `${kpi.effectivePerspectiveColor || '#8b5cf6'}55`,
                                  backgroundColor: `${kpi.effectivePerspectiveColor || '#8b5cf6'}1a`,
                                }}
                                title={`Hạng mục BSC: ${kpi.effectivePerspectiveName}`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: kpi.effectivePerspectiveColor || '#8b5cf6' }} />
                                {kpi.effectivePerspectiveName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-5">
                          <div className="flex items-start gap-1.5" style={{ paddingLeft: isChildRow ? 28 : 0 }}>
                            {!isChildRow && childKpis.length > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleParentCollapse(kpi.id) }}
                                className="shrink-0 mt-1 w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 transition-all"
                                title={collapsedParents.has(kpi.id) ? 'Mở rộng KPI con' : 'Thu gọn KPI con'}
                              >
                                <ChevronDown size={14} className={cn("transition-transform", collapsedParents.has(kpi.id) && "-rotate-90")} />
                              </button>
                            )}
                            {isChildRow && (
                              <CornerDownRight size={14} className="shrink-0 mt-1 text-slate-300 dark:text-slate-600" />
                            )}
                            <button onClick={() => setReviewKpi(kpi)} className="max-w-[240px] text-left group/name focus:outline-none">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-sm font-black text-slate-900 dark:text-white group-hover/name:text-indigo-600 transition-colors line-clamp-1">
                                  {kpi.name}
                                </p>
                                {!isChildRow && childKpis.length > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-black uppercase tracking-wider border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                                    {childKpis.length} KPI con
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{FREQUENCY_MAP[kpi.frequency as keyof typeof FREQUENCY_MAP] || kpi.frequency}</p>
                                {kpi.kpiType === 'QUALITATIVE' && (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 text-[9px] font-black uppercase tracking-wider border border-teal-200 dark:border-teal-800/50 whitespace-nowrap">
                                    ★ Định tính
                                  </span>
                                )}
                                {kpi.isReverseKpi && (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[9px] font-black uppercase tracking-wider border border-orange-200 dark:border-orange-800/50 whitespace-nowrap">
                                    ↓ KPI Ngược
                                  </span>
                                )}
                                {kpi.isBonusKpi && (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-wider border border-emerald-200 dark:border-emerald-800/50 whitespace-nowrap">
                                    + KPI Thưởng
                                  </span>
                                )}
                                {isChildRow && kpi.parentRelationType && (
                                  <span className={cn(
                                    "inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border whitespace-nowrap",
                                    kpi.parentRelationType === 'DECOMPOSITION'
                                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50"
                                      : "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800/50"
                                  )}>
                                    {kpi.parentRelationType === 'DECOMPOSITION' ? 'Chia nhỏ' : 'Phân rã'}
                                  </span>
                                )}
                              </div>
                            </button>
                          </div>
                        </td>
                        {enableOkr && (
                          <>
                            <td className="px-4 py-5">
                              <div className="flex flex-col max-w-[150px]">
                                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tight truncate">{kpi.objectiveCode || 'N/A'}</span>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 line-clamp-1">{kpi.objectiveName || 'N/A'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-5">
                              <div className="flex flex-col max-w-[150px]">
                                <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-tight truncate">{kpi.keyResultCode || 'N/A'}</span>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 line-clamp-1">{kpi.keyResultName || 'N/A'}</span>
                              </div>
                            </td>
                          </>
                        )}
                        {!unitMode && (
                          <td className="px-4 py-5">
                            <div className="space-y-1.5 max-w-[200px]">
                              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1 rounded-lg w-fit border border-slate-100 dark:border-slate-800 shadow-sm">
                                <Building2 size={12} className="text-slate-400 shrink-0" />
                                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate">{kpi.orgUnitName || 'N/A'}</span>
                              </div>
                              {!personMode && (
                                <div className="flex items-center gap-2 px-2.5 text-[10px] font-medium text-slate-500" title={formatAssigneeNames(kpi.assigneeNames)}>
                                  <Users size={12} className="text-slate-400 shrink-0" /> <span className="truncate">{formatAssigneeNames(kpi.assigneeNames)}</span>
                                </div>
                              )}
                            </div>
                          </td>
                        )}
                        <td className="px-4 py-5 text-right whitespace-nowrap">
                          <div className="flex items-baseline justify-end gap-1">
                            <span className="text-sm font-black text-slate-900 dark:text-white">
                              {formatNumber(kpi.targetValue || 0)}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400">{kpi.unit}</span>
                          </div>
                        </td>
                        <td className="px-4 py-5 whitespace-nowrap">
                          <div className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100/50 dark:border-indigo-800/50 flex items-center justify-center gap-1.5 w-fit"
                            title={realWeightById.get(kpi.id) != null ? `Trọng số thật (form ${kpi.weight}% × %hạng mục)` : undefined}>
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{realWeightById.get(kpi.id) != null ? `${realWeightById.get(kpi.id)!.toFixed(1)}%` : `${kpi.weight}%`}</span>
                            {realWeightById.get(kpi.id) != null && <span className="text-[9px] font-bold text-slate-400">/ {kpi.weight}%</span>}
                          </div>
                        </td>
                        <td className="px-4 py-5 text-right">
                          <button 
                            onClick={() => setReviewKpi(kpi)}
                            className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                          >
                            <ChevronRight size={20} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>}

            {/* Card View */}
            {viewMode === 'card' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
                {displayRows.map((row) => {
                  // Header đơn vị/người chiếm trọn hàng để ngắt lưới thẻ thành từng khối.
                  if (row.kind === 'unit') {
                    return (
                      <div key={`unit-${row.unit.id}`} className="col-span-full">
                        <UnitGroupHeaderCard
                          unit={row.unit}
                          expanded={unitCollapse.isExpanded(row.unit.id)}
                          onToggle={() => unitCollapse.toggle(row.unit.id)}
                          isCurrentUnit={row.unit.id === myUnitId}
                          badges={renderUnitBadges(row.unit)}
                        />
                      </div>
                    )
                  }
                  if (row.kind === 'person') {
                    return (
                      <div key={`person-${row.key}`} className={cn("col-span-full", unitMode && "pl-4 sm:pl-8")}>
                        <PersonGroupHeaderCard
                          person={row.group}
                          expanded={personCollapse.isExpanded(row.key)}
                          onToggle={() => personCollapse.toggle(row.key)}
                          isCurrentUser={row.group.id === user?.id}
                          badges={renderPersonBadges(row.group.items)}
                          actions={renderPersonApproveAction(row.group.items)}
                        />
                      </div>
                    )
                  }
                  const { kpi, depth } = row
                  const status = STATUS_CONFIG[kpi.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG['PENDING_APPROVAL']!
                  const StatusIcon = status.icon
                  const isSelected = selectedKpis.includes(kpi.id)
                  const isChildRow = depth > 0
                  const childKpis = childrenByParentId.get(kpi.id) ?? []

                  return (
                    <div
                      key={kpi.id}
                      className={cn(
                        "relative bg-white dark:bg-slate-900 rounded-2xl border overflow-hidden shadow-sm transition-all active:scale-[0.98]",
                        isSelected ? "border-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-500/20" : "border-slate-200 dark:border-slate-800",
                        isChildRow && "ml-4"
                      )}
                    >
                      {/* Status color strip */}
                      <div className={cn("h-1 w-full",
                        kpi.status === 'APPROVED' ? 'bg-emerald-400' :
                        kpi.status === 'REJECTED' ? 'bg-red-400' : 'bg-amber-400'
                      )} />

                      <div className="p-4 space-y-3">
                        {/* Header */}
                        <div className="flex items-start gap-2">
                          {kpi.status === 'PENDING_APPROVAL' && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => { e.stopPropagation(); toggleSelect(kpi.id) }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-5 h-5 mt-0.5 rounded-lg border-2 border-slate-300 dark:border-slate-600 text-indigo-600 accent-indigo-600 shrink-0 cursor-pointer"
                            />
                          )}
                          <button onClick={() => setReviewKpi(kpi)} className="text-left flex-1 min-w-0">
                            <p className="text-sm font-black text-slate-900 dark:text-white line-clamp-2 leading-snug">{kpi.name}</p>
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{FREQUENCY_MAP[kpi.frequency as keyof typeof FREQUENCY_MAP] || kpi.frequency}</p>
                              {!isChildRow && childKpis.length > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-black uppercase tracking-wider border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                                  {childKpis.length} KPI con
                                </span>
                              )}
                              {kpi.kpiType === 'QUALITATIVE' && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 text-[9px] font-black uppercase tracking-wider border border-teal-200 dark:border-teal-800/50 whitespace-nowrap">★ Định tính</span>
                              )}
                              {kpi.isReverseKpi && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[9px] font-black uppercase tracking-wider border border-orange-200 dark:border-orange-800/50 whitespace-nowrap">↓ Ngược</span>
                              )}
                              {kpi.isBonusKpi && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-wider border border-emerald-200 dark:border-emerald-800/50 whitespace-nowrap">+ Thưởng</span>
                              )}
                            </div>
                          </button>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest shadow-sm", status.bgColor, status.color)}>
                              <StatusIcon size={10} className={kpi.status === 'PENDING_APPROVAL' ? 'animate-pulse' : ''} />
                              {status.label}
                            </div>
                            {kpi.effectivePerspectiveName && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border whitespace-nowrap"
                                style={{
                                  color: kpi.effectivePerspectiveColor || '#8b5cf6',
                                  borderColor: `${kpi.effectivePerspectiveColor || '#8b5cf6'}55`,
                                  backgroundColor: `${kpi.effectivePerspectiveColor || '#8b5cf6'}1a`,
                                }}
                                title={`Hạng mục BSC: ${kpi.effectivePerspectiveName}`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: kpi.effectivePerspectiveColor || '#8b5cf6' }} />
                                {kpi.effectivePerspectiveName}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* OKR info */}
                        {enableOkr && (kpi.objectiveName || kpi.keyResultName) && (
                          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/40">
                            <Target size={12} className="text-indigo-400 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <p className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase truncate">{kpi.objectiveCode && `[${kpi.objectiveCode}]`} {kpi.objectiveName || 'N/A'}</p>
                              {kpi.keyResultName && (
                                <p className="text-[9px] font-bold text-violet-600 dark:text-violet-400 truncate">{kpi.keyResultCode && `[${kpi.keyResultCode}]`} {kpi.keyResultName}</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Org + Assignees — đã nằm ở header nhóm thì không lặp lại trên thẻ. */}
                        {!unitMode && (
                          <div className="flex items-center gap-3 text-[10px] font-medium text-slate-500">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <Building2 size={11} className="text-slate-400 shrink-0" />
                              <span className="truncate">{kpi.orgUnitName || 'N/A'}</span>
                            </div>
                            {!personMode && (
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <Users size={11} className="text-slate-400 shrink-0" />
                                <span className="truncate">{formatAssigneeNames(kpi.assigneeNames)}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-3">
                            <div className="flex items-baseline gap-1">
                              <span className="text-base font-black text-slate-900 dark:text-white">{formatNumber(kpi.targetValue || 0)}</span>
                              <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400">{kpi.unit}</span>
                            </div>
                            <span className="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100/50 dark:border-indigo-800/50 text-xs font-black text-indigo-600 dark:text-indigo-400" title={realWeightById.get(kpi.id) != null ? `Trọng số thật (form ${kpi.weight}%)` : undefined}>{realWeightById.get(kpi.id) != null ? `${realWeightById.get(kpi.id)!.toFixed(1)}% / ${kpi.weight}%` : `${kpi.weight}%`}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {!isChildRow && childKpis.length > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleParentCollapse(kpi.id) }}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                              >
                                <ChevronDown size={16} className={cn("transition-transform", collapsedParents.has(kpi.id) && "-rotate-90")} />
                              </button>
                            )}
                            <button onClick={() => setReviewKpi(kpi)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all">
                              <ChevronRight size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Phân trang theo ĐƠN VỊ (hoặc theo NGƯỜI khi chỉ có một đơn vị); danh sách phẳng chỉ cần dòng đếm. */}
        {items.length > 0 && (
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {unitMode || personMode ? (
              <Pagination
                currentPage={groupPage}
                totalPages={totalPages}
                onPageChange={setPage}
                totalElements={totalGroups}
                size={GROUP_PAGE_SIZE}
                itemLabel={unitMode ? 'đơn vị' : 'nhân sự'}
              />
            ) : (
              <p className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Tổng <span className="text-slate-900 dark:text-white">{totalElements}</span> mục
              </p>
            )}
          </div>
        )}

        <KpiReviewModal 
          open={!!reviewKpi} 
          onClose={() => setReviewKpi(null)} 
          kpi={reviewKpi} 
          onEdit={handleEdit}
        />

        <KpiFormModal
          open={showEditForm}
          onClose={() => setShowEditForm(false)}
          editKpi={editKpi}
        />
      </div>
    </div>
  )
}

function StatChip({ label, value, color }: { label: string; value: number; color: 'amber' | 'emerald' | 'red' | 'indigo' }) {
  const colorMap = {
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/30',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30',
  }
  
  return (
    <div className={cn(
      "flex flex-col items-center justify-center min-w-0 px-2 sm:px-4 py-2.5 rounded-2xl border backdrop-blur-sm transition-all hover:scale-105 duration-300",
      colorMap[color]
    )}>
      <span className="text-xl font-black tracking-tighter">{value}</span>
      <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 truncate">{label}</span>
    </div>
  )
}
