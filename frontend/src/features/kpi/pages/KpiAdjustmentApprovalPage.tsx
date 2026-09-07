import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import KpiAdjustmentReviewModal from '../components/KpiAdjustmentReviewModal'
import { useKpiAdjustments, useBulkReviewAdjustments } from '../hooks/useKpiAdjustments'
import { cn } from '@/lib/utils'
import type { KpiAdjustmentRequest, AdjustmentStatus } from '@/types/adjustment'
import {
  Clock, CheckCircle2, XCircle,
  Users, ChevronRight, ChevronDown, Calendar,
  Search, MessageSquare, Target, GitBranch,
  LayoutGrid, List
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
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

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  PENDING: { label: 'Đợi xử lý', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50/50 border-amber-200/50 dark:bg-amber-900/20 dark:border-amber-900/30', icon: Clock },
  APPROVED: { label: 'Đã chấp thuận', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50/50 border-emerald-200/50 dark:bg-emerald-900/20 dark:border-emerald-900/30', icon: CheckCircle2 },
  REJECTED: { label: 'Đã từ chối', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50/50 border-red-200/50 dark:bg-red-900/20 dark:border-red-900/30', icon: XCircle },
}

const CountdownTimer = ({ createdAt, status }: { createdAt: string, status: string }) => {
  const [timeLeft, setTimeLeft] = useState<string>('')

  useEffect(() => {
    if (status !== 'PENDING') {
      setTimeLeft('---')
      return
    }

    const targetTime = new Date(createdAt).getTime() + 24 * 60 * 60 * 1000
    
    const update = () => {
      const now = new Date().getTime()
      const diff = targetTime - now
      
      if (diff <= 0) {
        setTimeLeft('Hết hạn')
        return
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
    }
    
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [createdAt, status])

  if (status !== 'PENDING') return <span className="text-slate-300">---</span>

  return (
    <div className="flex flex-col">
      <span className={cn(
        "text-[11px] font-black tracking-tighter",
        timeLeft === 'Hết hạn' ? 'text-red-500' : 'text-amber-500 animate-pulse'
      )}>
        {timeLeft}
      </span>
      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Thời hạn duyệt</span>
    </div>
  )
}

type AdjustmentTab = AdjustmentStatus | 'ALL'
const ADJUSTMENT_TABS: AdjustmentTab[] = ['PENDING', 'APPROVED', 'REJECTED', 'ALL']

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
  const tableColSpan = 6 + (activeTab === 'PENDING' ? 0 : 1) - (personMode ? 1 : 0)

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
      <button
        onClick={() => setSelectedIds(prev => allSelected
          ? prev.filter(id => !ids.includes(id))
          : Array.from(new Set([...prev, ...ids]))
        )}
        title={`Chọn ${ids.length} yêu cầu đang chờ của người này`}
        className={cn(
          'flex items-center gap-2 px-3 h-8 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all active:scale-95',
          allSelected
            ? 'bg-amber-500 border-amber-500 text-white'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-600 hover:border-amber-300'
        )}
      >
        <CheckCircle2 size={12} /> {allSelected ? 'Bỏ chọn' : `Chọn ${ids.length}`}
      </button>
    )
  }

  const { data: objectivesData } = useObjectives(organizationId)
  const selectedObjective = objectivesData?.find((o: ObjectiveResponse) => o.id === selectedObjectiveId)
  const keyResults = selectedObjective?.keyResults || []

  const { data: customLabels = {} } = useSidebarSettings(organizationId!)
  const rawTitle = ((customLabels as Record<string, string>)['/kpi-criteria/adjustments'] || 'Duyệt điều chỉnh')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  const titleParts = rawTitle.trim().split(' ')
  const lastWord = titleParts.length > 1 ? titleParts.pop() : ''
  const mainTitle = titleParts.join(' ')

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
        toast.success(`Đã ${status === 'APPROVED' ? 'duyệt' : 'từ chối'} ${selectedIds.length} yêu cầu thành công`)
        setSelectedIds([])
        setBulkNote('')
      },
      onError: () => {
        toast.error('Có lỗi xảy ra khi xử lý hàng loạt')
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

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
        
        {/* Header Section with Glass Card */}
        <div className="relative group" id="tour-adj-header">
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 rounded-[40px] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
          <div className="relative bg-white dark:bg-slate-900 rounded-[28px] p-6 border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
                  <MessageSquare size={12} className="animate-pulse" /> Trung tâm Yêu cầu
                </div>
                <div className="space-y-0.5">
                  <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                    {mainTitle} <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600">{lastWord}</span>
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm max-w-xl leading-relaxed">
                    Xử lý các đề xuất thay đổi hoặc hủy bỏ chỉ tiêu từ nhân viên.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full sm:w-auto">
                <StatChip label="Đợi xử lý" value={stats.pending} color="amber" />
                <StatChip label="Từ chối" value={stats.rejected} color="red" />
                <StatChip label="Chấp thuận" value={stats.approved} color="emerald" />
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div id="tour-adj-toolbar" className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-6 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          {/* Row 1: Primary Filters */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 w-full">
            <div className="relative group flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors" size={18} />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0) }}
                placeholder="Tìm tên chỉ tiêu, người yêu cầu..."
                className="w-full h-11 pl-12 pr-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Mở/đóng nhanh mọi nhóm đang hiển thị — đặt cạnh nút đổi chế độ xem vì
                cùng là thao tác lên cách hiển thị danh sách, không phải bộ lọc. */}
            {(unitMode || personMode) && (
              <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 self-start md:self-auto shrink-0">
                <button
                  onClick={() => {
                    if (unitMode) unitCollapse.expandAll(visibleUnits.map(u => u.id))
                    else personCollapse.expandAll(visibleGroups.map(g => g.id))
                  }}
                  title="Mở tất cả nhóm"
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-amber-600 hover:bg-white dark:hover:bg-slate-700 transition-all active:scale-95"
                >
                  <ChevronDown size={14} /> Mở
                </button>
                <button
                  onClick={() => { unitCollapse.collapseAll(); personCollapse.collapseAll() }}
                  title="Đóng tất cả nhóm"
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-amber-600 hover:bg-white dark:hover:bg-slate-700 transition-all active:scale-95"
                >
                  <ChevronRight size={14} /> Đóng
                </button>
              </div>
            )}

            <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 self-start md:self-auto shrink-0">
              <button
                onClick={() => setViewMode('list')}
                title="Dạng danh sách"
                className={cn(
                  "w-9 h-9 flex items-center justify-center rounded-xl transition-all",
                  viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-600' : 'text-slate-400 hover:text-slate-600'
                )}
              >
                <List size={18} />
              </button>
              <button
                onClick={() => setViewMode('card')}
                title="Dạng thẻ"
                className={cn(
                  "w-9 h-9 flex items-center justify-center rounded-xl transition-all",
                  viewMode === 'card' ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-600' : 'text-slate-400 hover:text-slate-600'
                )}
              >
                <LayoutGrid size={18} />
              </button>
            </div>

            {/* Danh sách đã gom theo Đơn vị → Người nên bỏ hẳn bộ lọc "Chọn đơn vị". */}

            <div className="w-full md:w-52">
              <Select value={selectedPeriodId} onValueChange={(v) => { setSelectedPeriodId(v); setPage(0); resetGroups() }}>
                <SelectTrigger className="h-11 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold text-xs focus:ring-2 focus:ring-amber-500/20">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-amber-500 shrink-0" />
                    <SelectValue placeholder="Đợt KPI..." />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800">
                  <SelectItem value="ALL" className="font-bold">Tất cả đợt KPI</SelectItem>
                  {periodsData?.content.map(p => (
                    <SelectItem key={p.id} value={p.id} className="font-medium">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Strategic Filters (OKR) */}
          {enableOkr && (
            <div className="flex flex-col md:flex-row items-center gap-4 w-full pt-4 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-500">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 min-w-[140px] px-2">
                <Target size={18} className="animate-bounce" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">Bộ lọc OKR</span>
              </div>
              
              <div className="w-full md:flex-1 md:max-w-[480px]">
                <Select value={selectedObjectiveId} onValueChange={(v) => { setSelectedObjectiveId(v); setSelectedKeyResultId('ALL'); setPage(0) }}>
                  <SelectTrigger className="h-12 rounded-2xl border-amber-100 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-900/10 font-bold text-sm text-amber-900 dark:text-amber-100">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Target size={16} className="text-amber-400 shrink-0" />
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

              <div className="w-full md:flex-1 md:max-w-[480px]">
                <Select value={selectedKeyResultId} onValueChange={(v) => { setSelectedKeyResultId(v); setPage(0) }} disabled={selectedObjectiveId === 'ALL'}>
                  <SelectTrigger className="h-12 rounded-2xl border-amber-100 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-900/10 font-bold text-sm text-amber-900 dark:text-amber-100 disabled:opacity-50 transition-all">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <GitBranch size={16} className="text-amber-400 shrink-0" />
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
        <div id="tour-adj-tabs" className="flex flex-wrap items-center gap-3 py-2">
          {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((tab) => {
            const labels: Record<string, string> = { 
              PENDING: 'Đợi xử lý', 
              APPROVED: 'Đã chấp thuận', 
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
                    ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900 shadow-amber-500/10 scale-105' 
                    : 'bg-white border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-white'
                )}
              >
                {labels[tab]}
              </button>
            )
          })}
        </div>

        {hitFetchCap && (
          <div className="flex items-center gap-3 px-6 py-4 rounded-[20px] bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40">
            <Clock size={18} className="text-amber-500 shrink-0" />
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
              Dữ liệu quá lớn nên chỉ hiển thị {GROUPING_FETCH_SIZE} yêu cầu gần nhất — hãy lọc thêm theo đợt hoặc phòng ban để xem đầy đủ.
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
              title={activeTab === 'PENDING' ? 'Không có yêu cầu nào đang chờ' : 'Không có dữ liệu'} 
              description="Hệ thống hiện tại không có yêu cầu điều chỉnh chỉ tiêu nào khớp với bộ lọc." 
            />
          </div>
        ) : (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[32px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
            {viewMode === 'list' && <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <th className="pl-6 py-5 w-10">
                      {items.some(i => i.status === 'PENDING' && !i.deactivationRequest) && (
                        <Checkbox
                          checked={items.length > 0 && items.filter(i => i.status === 'PENDING' && !i.deactivationRequest).every(i => selectedIds.includes(i.id))}
                          onCheckedChange={toggleSelectAll}
                          className="border-slate-300"
                        />
                      )}
                    </th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Trạng thái</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Chỉ tiêu đề xuất</th>
                    {/* Gom theo người rồi thì tên người yêu cầu đã nằm ở header nhóm. */}
                    {!personMode && <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Người yêu cầu</th>}
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Hạn xử lý (24h)</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Lý do điều chỉnh</th>
                    {(activeTab === 'APPROVED' || activeTab === 'REJECTED' || activeTab === 'ALL') && (
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Phản hồi của bạn</th>
                    )}
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {displayRows.map((row, i) => {
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
                          actions={renderPersonSelectAction(row.group.items)}
                        />
                      )
                    }
                    const { request } = row
                    const status = statusConfig[request.status] ?? statusConfig['PENDING']!
                    const StatusIcon = status.icon
                    const isSelected = selectedIds.includes(request.id)
                    return (
                      <tr 
                        key={request.id} 
                        className={cn(
                          "group hover:bg-amber-50/30 dark:hover:bg-amber-900/10 transition-all duration-300",
                          isSelected && "bg-amber-50/50 dark:bg-amber-900/20"
                        )} 
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <td className="pl-6 py-5">
                          {request.status === 'PENDING' && !request.deactivationRequest && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(request.id)}
                              className="border-slate-300"
                            />
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col items-start gap-1.5">
                            <div className={cn(
                              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest shadow-sm whitespace-nowrap",
                              status.bgColor, status.color
                            )}>
                              <StatusIcon size={12} className={request.status === 'PENDING' ? 'animate-pulse' : ''} /> {status.label}
                            </div>
                            {request.perspectiveName && (
                              <span
                                className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full uppercase whitespace-nowrap"
                                style={{ color: request.perspectiveColor || '#8b5cf6', backgroundColor: `${request.perspectiveColor || '#8b5cf6'}1a` }}
                                title={`Hạng mục BSC: ${request.perspectiveName}`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: request.perspectiveColor || '#8b5cf6' }} />
                                {request.perspectiveName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <button onClick={() => setReviewAdjustment(request)} className="text-left group/name focus:outline-none">
                            <p className="text-sm font-black text-slate-900 dark:text-white group-hover/name:text-amber-600 transition-colors line-clamp-1">
                              {request.kpiCriteriaName}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {request.kpiType === 'QUALITATIVE' && (
                                <span className="text-[9px] font-black bg-teal-100 text-teal-600 px-1.5 py-0.5 rounded uppercase">★ Định tính</span>
                              )}
                              {request.deactivationRequest ? (
                                <span className="text-[9px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase">Huỷ bỏ KPI</span>
                              ) : (
                                <span className="text-[9px] font-black bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded uppercase">Điều chỉnh số liệu</span>
                              )}
                            </div>
                          </button>
                        </td>
                        {!personMode && (
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <Users size={12} className="text-slate-400" />
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{request.requesterName}</span>
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-5">
                           <CountdownTimer createdAt={request.createdAt} status={request.status} />
                        </td>
                        <td className="px-6 py-5">
                           <p className="text-xs text-slate-500 font-medium line-clamp-1 italic">"{request.reason}"</p>
                        </td>
                        {(activeTab === 'APPROVED' || activeTab === 'REJECTED' || activeTab === 'ALL') && (
                          <td className="px-6 py-5">
                            {request.reviewerNote ? (
                              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold line-clamp-1">{request.reviewerNote}</p>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Không có phản hồi</span>
                            )}
                          </td>
                        )}
                        <td className="px-8 py-5 text-right">
                          <button 
                            onClick={() => setReviewAdjustment(request)}
                            className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm border border-transparent hover:border-amber-200 dark:hover:border-slate-700"
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
                          actions={renderPersonSelectAction(row.group.items)}
                        />
                      </div>
                    )
                  }
                  const { request } = row
                  const status = statusConfig[request.status] ?? statusConfig['PENDING']!
                  const StatusIcon = status.icon
                  const isSelected = selectedIds.includes(request.id)
                  return (
                    <div
                      key={request.id}
                      className={cn(
                        "relative bg-white dark:bg-slate-900 rounded-2xl border overflow-hidden shadow-sm transition-all active:scale-[0.98]",
                        isSelected ? "border-amber-300 dark:border-amber-700 ring-2 ring-amber-500/20" : "border-slate-200 dark:border-slate-800"
                      )}
                    >
                      <div className={cn("h-1 w-full",
                        request.status === 'APPROVED' ? 'bg-emerald-400' :
                        request.status === 'REJECTED' ? 'bg-red-400' : 'bg-amber-400'
                      )} />
                      <div className="p-4 space-y-3">
                        {/* Header */}
                        <div className="flex items-start gap-2">
                          {request.status === 'PENDING' && !request.deactivationRequest && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(request.id)}
                              className="border-slate-300 mt-0.5 shrink-0"
                            />
                          )}
                          <button onClick={() => setReviewAdjustment(request)} className="text-left flex-1 min-w-0">
                            <p className="text-sm font-black text-slate-900 dark:text-white line-clamp-2 leading-snug">{request.kpiCriteriaName}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {request.kpiType === 'QUALITATIVE' && (
                                <span className="text-[9px] font-black bg-teal-100 text-teal-600 px-1.5 py-0.5 rounded uppercase">★ Định tính</span>
                              )}
                              {request.deactivationRequest ? (
                                <span className="text-[9px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase">Huỷ bỏ KPI</span>
                              ) : (
                                <span className="text-[9px] font-black bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded uppercase">Điều chỉnh số liệu</span>
                              )}
                            </div>
                          </button>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest shadow-sm", status.bgColor, status.color)}>
                              <StatusIcon size={10} className={request.status === 'PENDING' ? 'animate-pulse' : ''} />
                              {status.label}
                            </div>
                            {request.perspectiveName && (
                              <span
                                className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full uppercase whitespace-nowrap"
                                style={{ color: request.perspectiveColor || '#8b5cf6', backgroundColor: `${request.perspectiveColor || '#8b5cf6'}1a` }}
                                title={`Hạng mục BSC: ${request.perspectiveName}`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: request.perspectiveColor || '#8b5cf6' }} />
                                {request.perspectiveName}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Requester + Timer */}
                        <div className={cn("flex items-center gap-2", personMode ? "justify-end" : "justify-between")}>
                          {!personMode && (
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                              <Users size={11} className="text-slate-400 shrink-0" />
                              <span className="truncate">{request.requesterName}</span>
                            </div>
                          )}
                          <CountdownTimer createdAt={request.createdAt} status={request.status} />
                        </div>

                        {/* Reason */}
                        <p className="text-[11px] text-slate-500 font-medium italic line-clamp-2 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-xl">"{request.reason}"</p>

                        {/* Reviewer note */}
                        {(activeTab === 'APPROVED' || activeTab === 'REJECTED' || activeTab === 'ALL') && (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                            {request.reviewerNote ? (
                              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold line-clamp-1">{request.reviewerNote}</p>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Không có phản hồi</span>
                            )}
                          </div>
                        )}

                        {/* Footer action */}
                        <div className="flex justify-end pt-1 border-t border-slate-100 dark:border-slate-800">
                          <button
                            onClick={() => setReviewAdjustment(request)}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-xl transition-all"
                          >
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Bulk Actions Bar */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 sm:px-6 py-3 rounded-[24px] shadow-2xl flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-5 animate-in slide-in-from-bottom-10 duration-500 border border-slate-700/50 dark:border-slate-200/50 backdrop-blur-xl w-[92vw] sm:w-auto max-w-xl">
             <div className="flex items-center justify-between sm:justify-start gap-4 sm:pr-5 sm:border-r border-slate-700/50 dark:border-slate-200/50 whitespace-nowrap">
                <div className="flex flex-col items-start">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/50 dark:text-slate-400">Đã chọn</span>
                  <span className="text-sm font-black uppercase tracking-tight">{selectedIds.length} mục</span>
                </div>
                <button onClick={() => { setSelectedIds([]); setBulkNote('') }} className="text-[10px] font-black uppercase tracking-widest bg-white/10 dark:bg-slate-100 px-2 py-1 rounded-lg hover:bg-white/20 transition-all">Bỏ chọn</button>
             </div>

             <div className="flex items-center gap-3">
               <input
                 value={bulkNote}
                 onChange={e => setBulkNote(e.target.value)}
                 placeholder="Nhập phản hồi chung..."
                 className="bg-slate-800 dark:bg-slate-50 text-[11px] font-bold px-4 py-2.5 rounded-xl border border-slate-700 dark:border-slate-200 outline-none focus:ring-2 focus:ring-amber-500/50 w-full sm:w-64 transition-all"
               />
             </div>

             <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBulkReview('REJECTED')}
                  disabled={bulkReviewMutation.isPending}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-all disabled:opacity-50 whitespace-nowrap"
                >
                   Từ chối
                </button>
                <button
                  onClick={() => handleBulkReview('APPROVED')}
                  disabled={bulkReviewMutation.isPending}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 whitespace-nowrap"
                >
                   Duyệt hàng loạt
                </button>
             </div>
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

        <KpiAdjustmentReviewModal 
          open={!!reviewAdjustment} 
          onClose={() => setReviewAdjustment(null)} 
          request={reviewAdjustment} 
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
