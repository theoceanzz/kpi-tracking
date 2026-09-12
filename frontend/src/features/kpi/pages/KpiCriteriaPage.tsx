import { useState, useRef, useEffect, useMemo, Fragment } from 'react'

import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { DatePicker } from '@/components/common/DateTimePicker'
import EmptyState from '@/components/common/EmptyState'
import KpiFormModal from '../components/KpiFormModal'
import BscKpiSplitModal from '../components/BscKpiSplitModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useKpiCriteria } from '../hooks/useKpiCriteria'
import { useAuthStore } from '@/store/authStore'
import { useSubmitKpi } from '../hooks/useSubmitKpi'
import { useDeleteKpi } from '../hooks/useDeleteKpi'
import { useSidebarSettings } from '@/features/organization/hooks/useSidebarSettings'
import { formatNumber, formatAssigneeNames } from '@/lib/utils'
import type { KpiCriteria } from '@/types/kpi'
import {
  Target, Plus, Send, Pencil, Trash2, MoreVertical, AlertCircle, Upload, Eye,
  LayoutGrid, List, ChevronDown, GitBranch, ListPlus, CornerDownRight,
  ChevronsDownUp, ChevronsUpDown, Inbox, FileText, Clock, Loader2,
} from 'lucide-react'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import FilterBar, { SegmentedControl } from '@/components/common/FilterBar'
import BulkActionBar from '@/components/common/BulkActionBar'
import StatusBadge from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import KpiTagChips from '../components/KpiTagChips'
import KpiDetailModal from '../components/KpiDetailModal'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { useSearchParams } from 'react-router-dom'
import { useWorkflowNavigator, WORKFLOW_PARAMS } from '../workflow/hooks/useWorkflowNavigator'
import KpiImportGuideModal from '../components/KpiImportGuideModal'
import UrgentTaskModal from '../components/UrgentTaskModal'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import ScopeSelectItems from '@/components/common/ScopeSelectItems'
import { pickCurrentOrNearest } from '@/components/common/dateScope'
import { useKpiTotalWeight } from '../hooks/useKpiTotalWeight'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { usePermission } from '@/hooks/usePermission'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useObjectives } from '../../okr/hooks/useOkr'
import { useBscPerspectives, useScorecards } from '../../bsc/hooks/useBsc'
import KpiExcelPreviewModal from '../components/KpiExcelPreviewModal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ObjectiveResponse } from '@/features/okr/types'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useBulkSubmitKpi } from '../hooks/useBulkSubmitKpi'
import { useBulkDeleteKpi } from '../hooks/useBulkDeleteKpi'
import { Zap, Layers } from 'lucide-react'
import type { KpiType } from '@/types/kpi'
import Pagination from '@/components/common/Pagination'
import {
  PersonGroupBadge, PersonGroupHeaderCard, PersonGroupHeaderRow,
  UnitGroupHeaderCard, UnitGroupHeaderRow,
} from '@/components/common/PersonGroupHeader'
import { groupByPerson, groupByUnitThenPerson, personGroupKey } from '@/lib/personGrouping'
import { usePersonGroupCollapse } from '@/hooks/usePersonGroupCollapse'
import { buildKpiRows } from '../utils/kpiTree'
import { findDecompositionParentIds, sumWeightForPerson, totalWeightForUnit } from '../utils/realWeight'
import { scorecardsForPeriod } from '@/features/bsc/utils/scorecardScope'

/** Số nhóm (đơn vị, hoặc người khi chỉ có một đơn vị) hiển thị mỗi trang. */
const GROUP_PAGE_SIZE = 10
/** Trần số KPI tải về một lần để gom nhóm — chạm trần thì nhắc người dùng lọc hẹp lại. */
const GROUPING_FETCH_SIZE = 1000

type KpiTypeFilterKey =
  | 'ALL'
  | 'QT_ALL' | 'QT_PARENT' | 'QT_NORMAL' | 'QT_BONUS' | 'QT_REVERSE'
  | 'QL_ALL' | 'QL_PARENT' | 'QL_NORMAL' | 'QL_BONUS'

type KpiTypeFilterParams = {
  kpiType?: KpiType
  kpiNature?: 'PARENT_CHILD' | 'STANDALONE'
  isBonusKpi?: boolean
  isReverseKpi?: boolean
}

// Maps each filter option to the independent BE query params it implies.
// This also fixes the leak where quantitative sub-filters returned qualitative KPIs.
const KPI_TYPE_FILTERS: Record<KpiTypeFilterKey, KpiTypeFilterParams> = {
  ALL: {},
  QT_ALL: { kpiType: 'QUANTITATIVE' },
  QT_PARENT: { kpiType: 'QUANTITATIVE', kpiNature: 'PARENT_CHILD' },
  QT_NORMAL: { kpiType: 'QUANTITATIVE', kpiNature: 'STANDALONE', isBonusKpi: false, isReverseKpi: false },
  QT_BONUS: { kpiType: 'QUANTITATIVE', isBonusKpi: true },
  QT_REVERSE: { kpiType: 'QUANTITATIVE', isReverseKpi: true },
  QL_ALL: { kpiType: 'QUALITATIVE' },
  QL_PARENT: { kpiType: 'QUALITATIVE', kpiNature: 'PARENT_CHILD' },
  QL_NORMAL: { kpiType: 'QUALITATIVE', kpiNature: 'STANDALONE', isBonusKpi: false },
  QL_BONUS: { kpiType: 'QUALITATIVE', isBonusKpi: true },
}

export default function KpiCriteriaPage() {
  const [searchParams] = useSearchParams()
  const { goToNext, nextReachableStage } = useWorkflowNavigator()

  // Bối cảnh do bước tạo đợt bàn giao. Trước đây trang này không đọc URL một chút nào, nên
  // ?periodId= mà thanh tiến trình mang tới bị bỏ qua hoàn toàn.
  const incomingPeriodId = searchParams.get(WORKFLOW_PARAMS.period)
  const openCreateOnArrival = searchParams.get(WORKFLOW_PARAMS.openCreate) === '1'

  const [showForm, setShowForm] = useState(openCreateOnArrival)
  const [editKpi, setEditKpi] = useState<KpiCriteria | null>(null)
  const [deleteKpi, setDeleteKpi] = useState<KpiCriteria | null>(null)
  const [submitKpiId, setSubmitKpiId] = useState<string | null>(null)
  const [selectedKpi, setSelectedKpi] = useState<KpiCriteria | null>(null)
  const [delegateKpi, setDelegateKpi] = useState<KpiCriteria | null>(null)
  const [decomposeKpi, setDecomposeKpi] = useState<KpiCriteria | null>(null)
  const [selectedKpiIds, setSelectedKpiIds] = useState<string[]>([])
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
  const [showUrgentModal, setShowUrgentModal] = useState(false)
  const [showBscSplit, setShowBscSplit] = useState(false)
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set())
  
  const [activeTab, setActiveTab] = useState<'ALL' | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'>('ALL')
  const [search, setSearch] = useState('')
  const [showImportGuide, setShowImportGuide] = useState(false)
  // Đợt đến từ URL thắng phép tự đoán bên dưới: người dùng vừa chủ động tạo đúng đợt này ở bước
  // trước, nên đoán lại theo ngày hiện tại sẽ chọn nhầm sang đợt khác.
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(incomingPeriodId ?? '')
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState<string>('')
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARD'>(() => window.matchMedia('(max-width: 767px)').matches ? 'CARD' : 'TABLE')
  const [page, setPage] = useState(0)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>('ALL')
  const [selectedKeyResultId, setSelectedKeyResultId] = useState<string>('ALL')
  const [selectedPerspectiveId, setSelectedPerspectiveId] = useState<string>('ALL')
  const [kpiTypeFilter, setKpiTypeFilter] = useState<KpiTypeFilterKey>('ALL')
  
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importType, setImportType] = useState<KpiType>('QUANTITATIVE')
  const [showPreview, setShowPreview] = useState(false)
  
  const fileRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const user = useAuthStore(s => s.user)
  const { hasPermission } = usePermission()
  /** Người lập bộ tiêu chí của đơn vị (hoặc quản trị BSC) — chỉ họ mới chia hạng mục thành KPI. */
  const canSplitBsc = hasPermission('BSC:MANAGE_UNIT') || hasPermission('BSC:MANAGE')

  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(organizationId)
  const enableOkr = org?.enableOkr
  const enableBsc = org?.enableBsc
  const enableWaterfall = org?.enableWaterfall
  const { data: bscPerspectives } = useBscPerspectives(enableBsc ? organizationId : undefined)
  const { data: periodsData } = useKpiPeriods({ organizationId })
  const { data: orgUnitTreeData } = useOrgUnitTree()
  
  const flattenTree = (nodes: any[], level = 0): any[] => {
    let result: any[] = []
    nodes.forEach(node => {
      result.push({ 
        ...node, 
        level,
        levelLabel: '—'.repeat(level) + (level > 0 ? ' ' : '') + node.name 
      })
      if (node.children?.length) {
        result = result.concat(flattenTree(node.children, level + 1))
      }
    })
    return result
  }
  const flatOrgUnits = useMemo(() => orgUnitTreeData ? flattenTree(orgUnitTreeData) : [], [orgUnitTreeData])
  
  // Thứ tự đơn vị trong cây tổ chức, để các nhóm đơn vị hiện theo đúng trật tự cây
  // thay vì theo bảng chữ cái.
  const unitOrder = useMemo(
    () => new Map<string, number>(flatOrgUnits.map((u: any, i: number) => [u.id, i])),
    [flatOrgUnits]
  )

  // Danh sách không còn lọc theo đơn vị, nhưng import Excel và "Task khẩn" vẫn cần biết
  // tạo cho đơn vị nào — giữ lại đơn vị mặc định của người đang đăng nhập cho hai việc đó.
  useEffect(() => {
    if (flatOrgUnits.length > 0 && !selectedOrgUnitId) {
      const userUnitIds = user?.memberships?.map(m => m.orgUnitId) || []
      const myUnitsInTree = flatOrgUnits.filter(u => userUnitIds.includes(u.id))
      
      if (myUnitsInTree.length > 0) {
        const deepestUnit = myUnitsInTree.reduce((prev, curr) => (curr.level > prev.level ? curr : prev), myUnitsInTree[0])
        setSelectedOrgUnitId(deepestUnit.id)
      } else {
        setSelectedOrgUnitId(flatOrgUnits[0].id)
      }
    } else if (flatOrgUnits.length === 0 && !selectedOrgUnitId && user?.memberships?.length) {
      // Fallback: no org tree access, use user's own org unit from membership
      setSelectedOrgUnitId(user?.memberships?.[0]?.orgUnitId ?? '')
    }
  }, [flatOrgUnits, user, selectedOrgUnitId])
  
  // Chọn sẵn đợt đang chạy; đang ở kẽ giữa hai đợt thì giữ nguyên đợt vừa kết thúc.
  useEffect(() => {
    if (periodsData?.content && !selectedPeriodId) {
      const period = pickCurrentOrNearest(periodsData.content)
      if (period) setSelectedPeriodId(period.id)
    }
  }, [periodsData, selectedPeriodId])


  // Tải trọn phạm vi đang lọc (không phân trang ở server) để gom nhóm theo người cho đủ:
  // phân trang 10 KPI/trang sẽ cắt ngang một người thành hai trang. Phân trang lại theo
  // NGƯỜI ở phía dưới. Các bộ lọc server-side bên dưới vẫn thu hẹp dữ liệu trước.
  const { data, isLoading } = useKpiCriteria(
    {
      page: 0,
      size: GROUPING_FETCH_SIZE,
      // Show all KPIs the user has permission for (including colleagues in same unit as per BE update)
      createdById: undefined,
      kpiPeriodId: selectedPeriodId === 'ALL' ? undefined : selectedPeriodId,
      // Không lọc theo đơn vị nữa — lấy trọn phạm vi được phép xem rồi gom theo Đơn vị → Người.
      organizationId: user?.memberships?.[0]?.organizationId,
      status: activeTab === 'ALL' ? undefined : activeTab as any,
      keyword: search,
      startDate: startDateFilter ? new Date(startDateFilter).toISOString() : undefined,
      endDate: endDateFilter ? new Date(endDateFilter).toISOString() : undefined,
      sortBy,
      sortDir,
      objectiveId: selectedObjectiveId === 'ALL' ? undefined : selectedObjectiveId,
      keyResultId: selectedKeyResultId === 'ALL' ? undefined : selectedKeyResultId,
      perspectiveId: selectedPerspectiveId === 'ALL' ? undefined : selectedPerspectiveId,
      ...KPI_TYPE_FILTERS[kpiTypeFilter]
    },
    { enabled: !!user?.id }
  )

  // Quick check for personal drafts to show reminder
  const { data: personalDraftsData } = useKpiCriteria(
    {
      status: 'DRAFT',
      assigneeId: user?.id,
      kpiPeriodId: selectedPeriodId === 'ALL' ? undefined : selectedPeriodId,
      organizationId: user?.memberships?.[0]?.organizationId,
      size: 1
    },
    { enabled: !!user?.id }
  )
  const hasPersonalDrafts = (personalDraftsData?.totalElements ?? 0) > 0

  const { data: objectivesData } = useObjectives(user?.memberships?.[0]?.organizationId)
  
  const selectedObjective = objectivesData?.find((o: ObjectiveResponse) => o.id === selectedObjectiveId)
  const keyResults = selectedObjective?.keyResults || []

  const deleteMutation = useDeleteKpi()
  const submitMutation = useSubmitKpi()
  const bulkSubmitMutation = useBulkSubmitKpi()
  const bulkDeleteMutation = useBulkDeleteKpi()

  const { data: customLabels = {} } = useSidebarSettings(organizationId!)
  const rawTitle = (customLabels as Record<string, string>)['/kpi-criteria'] || 'Thiết lập chỉ tiêu'

  const importMutation = useMutation({
    mutationFn: (vars: { file: File; kpiType: KpiType }) => kpiApi.importFile(vars.file, selectedPeriodId === 'ALL' ? undefined : selectedPeriodId, selectedOrgUnitId === 'ALL' ? undefined : selectedOrgUnitId, vars.kpiType),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      setActiveTab('ALL')
      setPage(0)
      toast.success(`Import thành công ${result.successfulImports}/${result.totalRows} dòng`)
      if (result.errors.length > 0) {
        result.errors.forEach((e) => toast.error(e))
      }
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Import thất bại'))
    },
  })

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImportFile(file)
      setShowPreview(true)
      e.target.value = ''
    }
  }

  const allKpis = data?.content || []
  const flatKpis = data?.content

  // Trọng số THẬT mỗi KPI = form × %hạng_mục (từ bộ tiêu chí của đơn vị KPI). Hiển thị ngoài danh sách.
  const { data: bscScorecards } = useScorecards(enableBsc ? organizationId : undefined)
  const unitParentMap = useMemo(() => {
    const map = new Map<string, string | null>()
    const walk = (nodes: any[]) => (nodes || []).forEach((n: any) => { map.set(n.id, n.parentId ?? null); if (n.children) walk(n.children) })
    walk(orgUnitTreeData || [])
    return map
  }, [orgUnitTreeData])
  const realWeightById = useMemo(() => {
    const map = new Map<string, number>()
    if (!enableBsc || !bscScorecards) return map
    const resolveSc = (unitId: string, periodScs: any[]) => {
      let cur: string | null = unitId, guard = 0
      while (cur && guard++ < 100) {
        const found = periodScs.find(s => (s.orgUnits || []).some((u: any) => u.id === cur))
        if (found) return found
        cur = unitParentMap.get(cur) ?? null
      }
      return periodScs.find(s => !s.orgUnits || s.orgUnits.length === 0) || null
    }
    for (const kpi of allKpis) {
      if (kpi.weight == null || !kpi.effectivePerspectiveId || !kpi.kpiPeriodId) continue
      const periodScs = scorecardsForPeriod(bscScorecards, kpi.kpiPeriodId)
      if (periodScs.length === 0) continue
      const unitId = kpi.orgUnitId || kpi.orgUnitIds?.[0]
      const sc = unitId ? resolveSc(unitId, periodScs) : (periodScs.find(s => !s.orgUnits || s.orgUnits.length === 0) || null)
      if (!sc) continue
      const sp = sc.perspectives.find((p: any) => p.perspectiveId === kpi.effectivePerspectiveId)
      if (!sp || sp.weightPercentage == null) continue
      map.set(kpi.id, kpi.weight * sp.weightPercentage / 100)
    }
    return map
  }, [enableBsc, bscScorecards, allKpis, unitParentMap])

  const filteredKpis = flatKpis || []

  // Gom ĐƠN VỊ → NGƯỜI → KPI, thay cho hai bộ lọc "Phòng ban" và "Nhân viên" trước đây.
  // Một KPI thuộc đúng một đơn vị, nhưng giao cho nhiều người thì nằm ở nhóm của từng người.
  const extractAssignees = (kpi: KpiCriteria) =>
    (kpi.assignees ?? []).map(a => ({ id: a.id, name: a.fullName, avatarUrl: a.avatarUrl }))

  const unitGroups = useMemo(
    () => groupByUnitThenPerson(
      filteredKpis,
      kpi => {
        const id = kpi.orgUnitId || kpi.orgUnitIds?.[0]
        return id ? { id, name: kpi.orgUnitName || 'Đơn vị không tên' } : null
      },
      extractAssignees,
      unitOrder,
    ),
    [filteredKpis, unitOrder]
  )
  const personGroups = useMemo(() => groupByPerson(filteredKpis, extractAssignees), [filteredKpis])

  // Gom nhóm ngay từ MỘT đơn vị / MỘT người.
  //
  // Trước đây phải có ≥2 mới gom, với lập luận "một mục thì danh sách phẳng gọn hơn". Nhưng phần
  // gọn đi lại là thứ quan trọng nhất: dòng tiêu đề nhóm chính là nơi hiện tổng trọng số và cảnh
  // báo "chưa đủ 100%". Lọc về đúng một đơn vị — thao tác thường xuyên nhất — là mất luôn con số
  // dùng để biết đã cấu hình xong hay chưa, đúng lúc cần nó nhất.
  const unitMode = unitGroups.length >= 1
  const personMode = personGroups.length >= 1

  const myUnitId = user?.memberships?.[0]?.orgUnitId
  const unitCollapse = usePersonGroupCollapse(myUnitId)
  // Nhóm người được đánh khoá kèm đơn vị ở chế độ ba cấp, nhưng chỉ bằng id người khi rơi
  // về hai cấp — mở sẵn cả hai dạng khoá cho chính người đang đăng nhập.
  const personCollapse = usePersonGroupCollapse(
    user?.id ? [user.id, myUnitId ? personGroupKey(myUnitId, user.id) : null] : null
  )
  const resetGroups = () => { unitCollapse.reset(); personCollapse.reset() }

  // Phân trang theo ĐƠN VỊ khi gom ba cấp, theo NGƯỜI khi chỉ có một đơn vị.
  const pagedGroups: { id: string }[] = unitMode ? unitGroups : personGroups
  const totalGroups = pagedGroups.length
  const totalGroupPages = Math.max(1, Math.ceil(totalGroups / GROUP_PAGE_SIZE))
  // Đổi bộ lọc có thể làm số trang co lại — kẹp ngay lúc render để không kẹt ở trang trống.
  const groupPage = Math.min(page, totalGroupPages - 1)
  const pageSlice = <T,>(list: T[]) =>
    list.slice(groupPage * GROUP_PAGE_SIZE, groupPage * GROUP_PAGE_SIZE + GROUP_PAGE_SIZE)
  const visibleUnits = unitMode ? pageSlice(unitGroups) : []
  const visibleGroups = !unitMode && personMode ? pageSlice(personGroups) : []

  const hitFetchCap = filteredKpis.length >= GROUPING_FETCH_SIZE

  const toggleParentCollapse = (parentId: string) => {
    setCollapsedParents(prev => {
      const next = new Set(prev)
      if (next.has(parentId)) next.delete(parentId)
      else next.add(parentId)
      return next
    })
  }

  // Logic for bulk selection
  const selectableKpis = filteredKpis.filter(k => (k.status === 'DRAFT' || k.status === 'REJECTED') && k.createdById === user?.id)
  const allSelectableSelected = selectableKpis.length > 0 && selectableKpis.every(k => selectedKpiIds.includes(k.id))
  
  const toggleSelectAll = () => {
    if (selectableKpis.length === 0) return
    if (allSelectableSelected) {
      setSelectedKpiIds([])
    } else {
      setSelectedKpiIds(selectableKpis.map(k => k.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedKpiIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const isSelectableKpi = (k: KpiCriteria) =>
    (k.status === 'DRAFT' || k.status === 'REJECTED') && k.createdById === user?.id

  /** Chọn/bỏ chọn toàn bộ KPI gửi duyệt được của riêng một người. */
  const toggleSelectPerson = (kpis: KpiCriteria[]) => {
    const ids = kpis.filter(isSelectableKpi).map(k => k.id)
    if (ids.length === 0) return
    const allSelected = ids.every(id => selectedKpiIds.includes(id))
    setSelectedKpiIds(prev => allSelected
      ? prev.filter(id => !ids.includes(id))
      : Array.from(new Set([...prev, ...ids]))
    )
  }

  /** Chỉ cho xoá hàng loạt khi mọi chỉ tiêu đang chọn đều còn là bản nháp. */
  const selectedKpis = filteredKpis.filter(k => selectedKpiIds.includes(k.id))
  const allSelectedAreDraft = selectedKpiIds.length > 0
    && selectedKpis.length === selectedKpiIds.length
    && selectedKpis.every(k => k.status === 'DRAFT')

  const handleBulkDelete = () => {
    if (selectedKpiIds.length === 0) return
    bulkDeleteMutation.mutate(selectedKpiIds, {
      onSuccess: () => {
        setSelectedKpiIds([])
        setShowBulkDeleteConfirm(false)
      }
    })
  }

  const handleBulkSubmit = () => {
    if (selectedKpiIds.length === 0) return
    bulkSubmitMutation.mutate(selectedKpiIds, {
      onSuccess: () => {
        setSelectedKpiIds([])
        setShowBulkConfirm(false)
        // Điểm bàn giao của bước soạn chỉ tiêu là GỬI DUYỆT, không phải TẠO MỚI: tổng trọng số
        // đơn vị phải đúng 100% mới gửi được, nên sau khi tạo một chỉ tiêu người dùng gần như
        // luôn phải tạo tiếp — nhảy đi ngay sau mỗi lần tạo là phá đúng thao tác thường gặp nhất.
        //
        // Chỉ nhảy khi đích ĐÚNG LÀ màn duyệt chỉ tiêu. goToNext vốn bỏ qua những bước người dùng
        // không có quyền mở, nên người gửi duyệt mà không có quyền duyệt sẽ bị đẩy tới một bước
        // chẳng liên quan gì tới việc vừa làm; ở lại chỗ cũ đúng hơn.
        if (nextReachableStage('CRITERIA_DRAFT')?.code === 'CRITERIA_APPROVAL') {
          goToNext('CRITERIA_DRAFT', { periodId: selectedPeriodId }, { openCreate: false })
        }
      }
    })
  }

  // Số cột của bảng — header nhóm phải trải hết chiều ngang.
  const tableColSpan = 6 + (enableOkr ? 1 : 0) + (personMode ? 0 : 1)

  // Nhận diện KPI cha phân rã trên toàn danh sách đã tải, không tính lại trong từng nhóm.
  const decompositionParentIds = useMemo(() => findDecompositionParentIds(filteredKpis), [filteredKpis])

  /** Tổng trọng số của một người, dựng theo đúng công thức backend (bỏ KPI thưởng và KPI cha phân rã). */
  const sumWeight = (items: KpiCriteria[]) => sumWeightForPerson(items, realWeightById, decompositionParentIds)

  /** Số liệu tóm tắt của một người, đọc từ chính các KPI đang lọc. */
  const renderPersonBadges = (items: KpiCriteria[]) => {
    const draft = items.filter(k => k.status === 'DRAFT').length
    const pending = items.filter(k => k.status === 'PENDING_APPROVAL').length
    const weight = sumWeight(items)
    return (
      <>
        <PersonGroupBadge label="chỉ tiêu" value={items.length} />
        {draft > 0 && <PersonGroupBadge label="nháp" value={draft} tone="rose" />}
        {pending > 0 && <PersonGroupBadge label="chờ duyệt" value={pending} tone="amber" />}
        <PersonGroupBadge
          label="trọng số"
          value={`${formatNumber(weight)}%`}
          tone={Math.round(weight) === 100 ? 'emerald' : 'indigo'}
        />
      </>
    )
  }

  /**
   * Số liệu tóm tắt của một đơn vị. "Tổng trọng số" dùng đúng công thức backend
   * (KPI chưa giao + người cao nhất), nên đơn vị cấu hình xong luôn ra tròn 100%
   * dù có bao nhiêu nhân sự — cùng con số backend chặn khi gửi duyệt.
   */
  const renderUnitBadges = (unit: { items: KpiCriteria[]; people: { items: KpiCriteria[] }[] }) => {
    const pending = unit.items.filter(k => k.status === 'PENDING_APPROVAL').length
    const offTarget = unit.people.filter(p => Math.round(sumWeight(p.items)) !== 100).length
    const unitWeight = totalWeightForUnit(unit.items, realWeightById, decompositionParentIds)
    return (
      <>
        <PersonGroupBadge label="nhân sự" value={unit.people.length} tone="indigo" />
        <PersonGroupBadge label="chỉ tiêu" value={unit.items.length} />
        {pending > 0 && <PersonGroupBadge label="chờ duyệt" value={pending} tone="amber" />}
        <PersonGroupBadge
          label="tổng trọng số"
          value={`${formatNumber(unitWeight)}%`}
          tone={Math.round(unitWeight) === 100 ? 'emerald' : 'rose'}
        />
        {offTarget > 0 && <PersonGroupBadge label="chưa đủ 100%" value={offTarget} tone="rose" />}
      </>
    )
  }

  /** Nút chọn nhanh toàn bộ KPI gửi duyệt được của một người. */
  const renderPersonSelectAction = (items: KpiCriteria[]) => {
    const selectable = items.filter(isSelectableKpi)
    if (selectable.length === 0) return null
    const allSelected = selectable.every(k => selectedKpiIds.includes(k.id))
    return (
      <Button variant={allSelected ? 'secondary' : 'outline'} size="sm" onClick={() => toggleSelectPerson(items)} title={`Chọn ${selectable.length} chỉ tiêu có thể gửi duyệt`} aria-pressed={allSelected}>
        {allSelected ? 'Bỏ chọn' : `Chọn ${selectable.length}`}
      </Button>
    )
  }

  /** Dựng các dòng KPI (giữ nguyên lồng cha → con) cho một danh sách KPI. */
  const renderKpiTableRows = (list: KpiCriteria[]) => {
    const { rows, childrenByParentId } = buildKpiRows(list, collapsedParents)
    return rows.map(({ kpi, depth }) => (
      <KpiTableRow
        key={kpi.id}
        kpi={kpi}
        depth={depth}
        childCount={childrenByParentId.get(kpi.id)?.length ?? 0}
        isCollapsed={collapsedParents.has(kpi.id)}
        onToggleCollapse={() => toggleParentCollapse(kpi.id)}
        onView={() => setSelectedKpi(kpi)}
        onEdit={() => { setEditKpi(kpi); setShowForm(true) }}
        onDelete={() => setDeleteKpi(kpi)}
        onSubmit={() => setSubmitKpiId(kpi.id)}
        onDelegate={() => { setDelegateKpi(kpi); setShowForm(true) }}
        onDecompose={() => { setDecomposeKpi(kpi); setShowForm(true) }}
        enableOkr={enableOkr}
        enableWaterfall={enableWaterfall}
        realWeight={realWeightById.get(kpi.id) ?? null}
        selected={selectedKpiIds.includes(kpi.id)}
        onToggleSelect={() => toggleSelect(kpi.id)}
        isSelectable={isSelectableKpi(kpi)}
        hideAssignee={personMode}
      />
    ))
  }

  const renderKpiCards = (list: KpiCriteria[]) => {
    const { rows, childrenByParentId } = buildKpiRows(list, collapsedParents)
    return rows.map(({ kpi, depth }) => (
      <KpiCard
        key={kpi.id}
        kpi={kpi}
        depth={depth}
        childCount={childrenByParentId.get(kpi.id)?.length ?? 0}
        isCollapsed={collapsedParents.has(kpi.id)}
        onToggleCollapse={() => toggleParentCollapse(kpi.id)}
        onView={() => setSelectedKpi(kpi)}
        onEdit={() => { setEditKpi(kpi); setShowForm(true) }}
        onDelete={() => setDeleteKpi(kpi)}
        onSubmit={() => setSubmitKpiId(kpi.id)}
        onDelegate={() => { setDelegateKpi(kpi); setShowForm(true) }}
        onDecompose={() => { setDecomposeKpi(kpi); setShowForm(true) }}
        enableOkr={enableOkr}
        enableWaterfall={enableWaterfall}
        hideAssignee={personMode}
      />
    ))
  }


  const stats = {
    total: data?.totalElements || 0,
    draft: (data?.content || []).filter((k: KpiCriteria) => k.status === 'DRAFT').length,
    pending: (data?.content || []).filter((k: KpiCriteria) => k.status === 'PENDING_APPROVAL').length,
  }

  const overflowActive = (startDateFilter ? 1 : 0) + (endDateFilter ? 1 : 0) + (selectedPerspectiveId !== 'ALL' ? 1 : 0) + (selectedObjectiveId !== 'ALL' ? 1 : 0) + (selectedKeyResultId !== 'ALL' ? 1 : 0)
  const TAB_LABELS: Record<string, string> = { ALL: 'Tất cả', DRAFT: 'Nháp', PENDING_APPROVAL: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Bị trả lại' }
  const selectableCount = selectableKpis.length

  const groupToggle = (unitMode || personMode) && (
    <>
      <Button variant="ghost" size="icon-sm" title="Mở tất cả nhóm" aria-label="Mở tất cả nhóm" onClick={() => { if (unitMode) unitCollapse.expandAll(visibleUnits.map(u => u.id)); else personCollapse.expandAll(visibleGroups.map(g => g.id)) }}><ChevronsUpDown aria-hidden="true" /></Button>
      <Button variant="ghost" size="icon-sm" title="Thu gọn tất cả nhóm" aria-label="Thu gọn tất cả nhóm" onClick={() => { unitCollapse.collapseAll(); personCollapse.collapseAll() }}><ChevronsDownUp aria-hidden="true" /></Button>
    </>
  )

  const emptyTitle = search ? 'Không tìm thấy chỉ tiêu' : activeTab !== 'ALL' ? `Không có chỉ tiêu ${TAB_LABELS[activeTab]?.toLowerCase()}` : 'Chưa có chỉ tiêu nào'
  const emptyDesc = search || activeTab !== 'ALL' ? 'Thử đổi bộ lọc hoặc xoá tìm kiếm.' : 'Tạo chỉ tiêu mới, nhập từ Excel, hoặc dùng trình thiết lập nhanh.'

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <WorkspaceHeader
        id="tour-kpi-header"
        title={rawTitle}
        description="Tạo, giao và gửi duyệt chỉ tiêu cho nhân sự, đơn vị. Tổng trọng số mỗi người phải đúng 100% mới gửi duyệt được."
        stats={[
          { label: 'Chỉ tiêu', value: stats.total, icon: Target },
          { label: 'Nháp', value: stats.draft, icon: FileText },
          { label: 'Chờ duyệt', value: stats.pending, icon: Clock },
        ]}
        /* Hàng trên: khối số liệu + nút chính "Tạo chỉ tiêu"; ba nút phụ xuống hàng dưới qua khe `children`. */
        actions={<Button id="tour-kpi-add-btn" onClick={() => { setEditKpi(null); setShowForm(true) }}><Plus aria-hidden="true" /> Tạo chỉ tiêu</Button>}
      >
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => setShowImportGuide(true)}><Upload aria-hidden="true" /> Nhập Excel</Button>
          {selectedPeriodId && selectedOrgUnitId && (
            <Button variant="outline" onClick={() => setShowUrgentModal(true)}><Zap aria-hidden="true" /> Việc khẩn</Button>
          )}
          {enableBsc && canSplitBsc && (
            <Button variant="outline" onClick={() => setShowBscSplit(true)} title="Lấy mục tiêu của một hạng mục BSC và chia ra KPI theo từng đợt"><Layers aria-hidden="true" /> Từ hạng mục BSC</Button>
          )}
        </div>
      </WorkspaceHeader>

      {/* Hàng filter: đợt · loại · sắp xếp · [Bộ lọc phụ] … tìm kiếm · mở/đóng nhóm · dạng xem */}
      <FilterBar
        id="tour-kpi-toolbar"
        search={{ value: search, onChange: v => { setSearch(v); setPage(0) }, placeholder: 'Tìm chỉ tiêu, nhân sự…' }}
        overflowActiveCount={overflowActive}
        overflow={
          <div className="space-y-3">
    <div>
              <p className="text-label mb-1.5">Khoảng ngày tạo</p>
              <div className="flex items-center gap-2">
                <DatePicker value={startDateFilter} onChange={(v) => { setStartDateFilter(v); setPage(0) }} onClear={() => { setStartDateFilter(''); setPage(0) }} placeholder="Từ ngày" className="flex-1" />
                <span className="text-caption">–</span>
                <DatePicker value={endDateFilter} onChange={(v) => { setEndDateFilter(v); setPage(0) }} onClear={() => { setEndDateFilter(''); setPage(0) }} placeholder="Đến ngày" className="flex-1" />
                  </div>
                </div>
                {enableBsc && (
              <div>
                <p className="text-label mb-1.5">Hạng mục BSC</p>
                    <Select value={selectedPerspectiveId} onValueChange={val => { setSelectedPerspectiveId(val); setPage(0) }}>
                  <SelectTrigger aria-label="Hạng mục BSC"><SelectValue placeholder="Tất cả hạng mục" /></SelectTrigger>
                  <SelectContent className="z-[1100]">
                    <SelectItem value="ALL">Tất cả hạng mục</SelectItem>
                        {(bscPerspectives || []).map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color || 'var(--color-primary)' }} aria-hidden="true" />{p.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
            {enableOkr && (
              <>
                <div>
                  <p className="text-label mb-1.5">Mục tiêu OKR</p>
                  <Select value={selectedObjectiveId} onValueChange={(v) => { setSelectedObjectiveId(v); setSelectedKeyResultId('ALL'); setPage(0) }}>
                    <SelectTrigger aria-label="Mục tiêu OKR"><SelectValue placeholder="Tất cả mục tiêu" /></SelectTrigger>
                    <SelectContent className="z-[1100]">
                      <SelectItem value="ALL">Tất cả mục tiêu</SelectItem>
                      {objectivesData?.map(obj => <SelectItem key={obj.id} value={obj.id}>{obj.code} · {obj.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-label mb-1.5">Kết quả then chốt</p>
                  <Select value={selectedKeyResultId} onValueChange={(v) => { setSelectedKeyResultId(v); setPage(0) }} disabled={selectedObjectiveId === 'ALL'}>
                    <SelectTrigger aria-label="Kết quả then chốt"><SelectValue placeholder="Tất cả kết quả" /></SelectTrigger>
                    <SelectContent className="z-[1100]">
                      <SelectItem value="ALL">Tất cả kết quả</SelectItem>
                      {keyResults.map(kr => <SelectItem key={kr.id} value={kr.id}>{kr.code} · {kr.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {overflowActive > 0 && (
              <Button variant="ghost" size="sm" onClick={() => { setStartDateFilter(''); setEndDateFilter(''); setSelectedPerspectiveId('ALL'); setSelectedObjectiveId('ALL'); setSelectedKeyResultId('ALL'); setPage(0) }}>Xoá bộ lọc phụ</Button>
            )}
          </div>
        }
        trailing={
          <>
            {groupToggle}
            <SegmentedControl ariaLabel="Dạng hiển thị" value={viewMode} onChange={setViewMode}
              options={[{ value: 'TABLE', label: <List aria-hidden="true" />, title: 'Dạng bảng' }, { value: 'CARD', label: <LayoutGrid aria-hidden="true" />, title: 'Dạng thẻ' }]} />
          </>
        }
      >
        <Select value={selectedPeriodId} onValueChange={val => { setSelectedPeriodId(val); setPage(0); resetGroups() }}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Đợt đánh giá"><SelectValue placeholder="Đợt đánh giá" /></SelectTrigger>
          <SelectContent><ScopeSelectItems items={periodsData?.content} selectedId={selectedPeriodId} /></SelectContent>
        </Select>

        <Select value={kpiTypeFilter} onValueChange={val => { setKpiTypeFilter(val as KpiTypeFilterKey); setPage(0) }}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Loại chỉ tiêu"><SelectValue placeholder="Loại chỉ tiêu" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả loại</SelectItem>
            <SelectGroup>
              <SelectLabel>Định lượng</SelectLabel>
              <SelectItem value="QT_ALL">Tất cả định lượng</SelectItem>
              <SelectItem value="QT_PARENT">KPI cha</SelectItem>
              <SelectItem value="QT_NORMAL">KPI thường</SelectItem>
              <SelectItem value="QT_BONUS">KPI thưởng</SelectItem>
              <SelectItem value="QT_REVERSE">KPI ngược</SelectItem>
            </SelectGroup>
            {org?.enableQualitative && (
              <SelectGroup>
                <SelectLabel>Định tính</SelectLabel>
                <SelectItem value="QL_ALL">Tất cả định tính</SelectItem>
                <SelectItem value="QL_PARENT">KPI cha</SelectItem>
                <SelectItem value="QL_NORMAL">KPI thường</SelectItem>
                <SelectItem value="QL_BONUS">KPI thưởng</SelectItem>
              </SelectGroup>
            )}
                    </SelectContent>
                  </Select>

        <Select value={`${sortBy}-${sortDir}`} onValueChange={(val) => { const [field, dir] = val.split('-'); if (field && dir) { setSortBy(field); setSortDir(dir as 'asc' | 'desc'); setPage(0) } }}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Sắp xếp"><SelectValue placeholder="Sắp xếp" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt-desc">Mới nhất trước</SelectItem>
            <SelectItem value="createdAt-asc">Cũ nhất trước</SelectItem>
            <SelectItem value="name-asc">Tên A → Z</SelectItem>
            <SelectItem value="name-desc">Tên Z → A</SelectItem>
            <SelectItem value="weight-desc">Trọng số cao → thấp</SelectItem>
            <SelectItem value="weight-asc">Trọng số thấp → cao</SelectItem>
            <SelectItem value="targetValue-desc">Mục tiêu cao → thấp</SelectItem>
            <SelectItem value="targetValue-asc">Mục tiêu thấp → cao</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <div id="tour-kpi-tabs" className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          ariaLabel="Lọc theo trạng thái"
          value={activeTab}
          onChange={(t) => { setActiveTab(t as typeof activeTab); setPage(0) }}
          options={(['ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'] as const).map(t => ({ value: t, label: TAB_LABELS[t] }))}
        />
        {hasPersonalDrafts && activeTab !== 'DRAFT' && (
          <Button variant="ghost" type="button" onClick={() => { setActiveTab('DRAFT'); setPage(0) }}>
            <AlertCircle aria-hidden="true" /> {personalDraftsData?.totalElements} chỉ tiêu của bạn chưa gửi duyệt
                  </Button>
            )}
          </div>

          {hitFetchCap && (
        <div role="status" className="flex items-start gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
          <p className="text-sm text-[var(--color-foreground)]">Chỉ hiển thị {GROUPING_FETCH_SIZE} chỉ tiêu gần nhất. Lọc theo đợt hoặc đơn vị để xem đủ.</p>
            </div>
          )}

          {isLoading ? (
              <LoadingSkeleton type="table" rows={8} />
          ) : filteredKpis.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
          <EmptyState icon={Inbox} title={emptyTitle} description={emptyDesc} action={!search && activeTab === 'ALL' ? <Button onClick={() => { setEditKpi(null); setShowForm(true) }}><Plus aria-hidden="true" /> Tạo chỉ tiêu</Button> : undefined} />
            </div>
          ) : viewMode === 'TABLE' ? (
        <div id="tour-kpi-list" className="overflow-x-auto rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
          <table className="w-full">
                  <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                <th scope="col" className="w-10 px-3 py-2.5">
                  {selectableCount > 0 && (
                    <input type="checkbox" aria-label={allSelectableSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả chỉ tiêu gửi duyệt được'} checked={allSelectableSelected} ref={el => { if (el) el.indeterminate = selectedKpiIds.length > 0 && !allSelectableSelected }} onChange={toggleSelectAll} className={CHECKBOX} />
                            )}
                      </th>
                <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Chỉ tiêu</th>
                {enableOkr && <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Mục tiêu / KR</th>}
                {!personMode && <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Giao cho</th>}
                <th scope="col" className="px-4 py-2.5 text-right text-eyebrow">Mục tiêu</th>
                <th scope="col" className="px-4 py-2.5 text-right text-eyebrow">Trọng số</th>
                <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Trạng thái</th>
                <th scope="col" className="px-3 py-2.5 text-right text-eyebrow">Hành động</th>
                    </tr>
                  </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
                    {unitMode
                      ? visibleUnits.map(unit => (
                          <Fragment key={unit.id}>
                      <UnitGroupHeaderRow colSpan={tableColSpan} unit={unit} expanded={unitCollapse.isExpanded(unit.id)} onToggle={() => unitCollapse.toggle(unit.id)} isCurrentUnit={unit.id === myUnitId} badges={renderUnitBadges(unit)} />
                            {unitCollapse.isExpanded(unit.id) && unit.people.map(group => {
                              const key = personGroupKey(unit.id, group.id)
                              return (
                                <Fragment key={key}>
                            <PersonGroupHeaderRow colSpan={tableColSpan} indent person={group} expanded={personCollapse.isExpanded(key)} onToggle={() => personCollapse.toggle(key)} isCurrentUser={group.id === user?.id} badges={renderPersonBadges(group.items)} actions={renderPersonSelectAction(group.items)} />
                                  {personCollapse.isExpanded(key) && renderKpiTableRows(group.items)}
                                </Fragment>
                              )
                            })}
                          </Fragment>
                        ))
                      : personMode
                      ? visibleGroups.map(group => (
                          <Fragment key={group.id}>
                      <PersonGroupHeaderRow colSpan={tableColSpan} person={group} expanded={personCollapse.isExpanded(group.id)} onToggle={() => personCollapse.toggle(group.id)} isCurrentUser={group.id === user?.id} badges={renderPersonBadges(group.items)} actions={renderPersonSelectAction(group.items)} />
                            {personCollapse.isExpanded(group.id) && renderKpiTableRows(group.items)}
                          </Fragment>
                        ))
                      : renderKpiTableRows(filteredKpis)}
                  </tbody>
                </table>
              </div>
          ) : unitMode ? (
        <div className="space-y-4">
              {visibleUnits.map(unit => (
            <div key={unit.id} className="space-y-3">
              <UnitGroupHeaderCard unit={unit} expanded={unitCollapse.isExpanded(unit.id)} onToggle={() => unitCollapse.toggle(unit.id)} isCurrentUnit={unit.id === myUnitId} badges={renderUnitBadges(unit)} />
                  {unitCollapse.isExpanded(unit.id) && (
                <div className="space-y-3 pl-4">
                      {unit.people.map(group => {
                        const key = personGroupKey(unit.id, group.id)
                        return (
                      <div key={key} className="space-y-3">
                        <PersonGroupHeaderCard person={group} expanded={personCollapse.isExpanded(key)} onToggle={() => personCollapse.toggle(key)} isCurrentUser={group.id === user?.id} badges={renderPersonBadges(group.items)} actions={renderPersonSelectAction(group.items)} />
                        {personCollapse.isExpanded(key) && <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{renderKpiCards(group.items)}</div>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : personMode ? (
        <div className="space-y-4">
              {visibleGroups.map(group => (
            <div key={group.id} className="space-y-3">
              <PersonGroupHeaderCard person={group} expanded={personCollapse.isExpanded(group.id)} onToggle={() => personCollapse.toggle(group.id)} isCurrentUser={group.id === user?.id} badges={renderPersonBadges(group.items)} actions={renderPersonSelectAction(group.items)} />
              {personCollapse.isExpanded(group.id) && <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{renderKpiCards(group.items)}</div>}
                </div>
              ))}
            </div>
          ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{renderKpiCards(filteredKpis)}</div>
      )}

      {filteredKpis.length > 0 && (unitMode || personMode) && (
        <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
          <Pagination currentPage={groupPage} totalPages={totalGroupPages} onPageChange={setPage} totalElements={totalGroups} size={GROUP_PAGE_SIZE} itemLabel={unitMode ? 'đơn vị' : 'nhân sự'} />
            </div>
          )}

      <BulkActionBar count={selectedKpiIds.length} onClear={() => setSelectedKpiIds([])} itemLabel="chỉ tiêu">
        {allSelectedAreDraft && (
          <Button variant="outline" onClick={() => setShowBulkDeleteConfirm(true)} disabled={bulkDeleteMutation.isPending} className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)]">
            <Trash2 aria-hidden="true" /> Xoá
          </Button>
              )}
        <Button onClick={() => setShowBulkConfirm(true)} disabled={bulkSubmitMutation.isPending}>
          {bulkSubmitMutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
          Gửi duyệt {selectedKpiIds.length} chỉ tiêu
        </Button>
      </BulkActionBar>

        {/* Modals & Inputs */}
        <KpiFormModal
          open={showForm}
          onClose={() => { setShowForm(false); setEditKpi(null); setDelegateKpi(null); setDecomposeKpi(null) }}
          editKpi={editKpi}
          parentKpi={delegateKpi || decomposeKpi}
          parentRelationType={delegateKpi ? 'DELEGATION' : decomposeKpi ? 'DECOMPOSITION' : undefined}
          onSplitFromBsc={enableBsc && canSplitBsc ? () => { setShowForm(false); setEditKpi(null); setShowBscSplit(true) } : undefined}
        />
        <BscKpiSplitModal open={showBscSplit} onClose={() => setShowBscSplit(false)} />
      <KpiImportGuideModal open={showImportGuide} onClose={() => setShowImportGuide(false)} onSelectFile={(kpiType) => { setImportType(kpiType); fileRef.current?.click() }} />
        <ConfirmDialog 
          open={!!submitKpiId} 
          onClose={() => setSubmitKpiId(null)} 
          onConfirm={() => submitKpiId && submitMutation.mutate(submitKpiId, { onSuccess: () => setSubmitKpiId(null) })} 
        title="Gửi chỉ tiêu này để duyệt?"
        description="Cấp quản lý sẽ nhận thông báo và phê duyệt. Sau khi gửi bạn không sửa được cho tới khi được trả lại."
        confirmLabel="Gửi duyệt"
          loading={submitMutation.isPending} 
        />
        <ConfirmDialog 
          open={!!deleteKpi} 
          onClose={() => setDeleteKpi(null)} 
          onConfirm={() => deleteKpi && deleteMutation.mutate(deleteKpi.id, { onSuccess: () => setDeleteKpi(null) })} 
        title="Xoá chỉ tiêu?"
        description={`"${deleteKpi?.name}" sẽ bị xoá vĩnh viễn. Không hoàn tác được.`}
        confirmLabel="Xoá"
          loading={deleteMutation.isPending} 
        />
        <KpiDetailModal open={!!selectedKpi} onClose={() => setSelectedKpi(null)} kpi={selectedKpi} />
        <ConfirmDialog 
          open={showBulkConfirm} 
          onClose={() => setShowBulkConfirm(false)} 
          onConfirm={handleBulkSubmit} 
        title={`Gửi duyệt ${selectedKpiIds.length} chỉ tiêu?`}
        description="Tổng trọng số của mỗi nhân sự phải đúng 100%. Chỉ tiêu đã gửi không sửa được cho tới khi được trả lại."
        confirmLabel="Gửi duyệt tất cả"
          loading={bulkSubmitMutation.isPending} 
        />
        <ConfirmDialog
          open={showBulkDeleteConfirm}
          onClose={() => setShowBulkDeleteConfirm(false)}
          onConfirm={handleBulkDelete}
        title={`Xoá ${selectedKpiIds.length} chỉ tiêu nháp?`}
        description="Các bản nháp đã chọn sẽ bị xoá vĩnh viễn. Không hoàn tác được."
          confirmLabel="Xoá tất cả"
          loading={bulkDeleteMutation.isPending}
        />
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
      <UrgentTaskModal open={showUrgentModal} onClose={() => setShowUrgentModal(false)} kpiPeriodId={selectedPeriodId} orgUnitId={selectedOrgUnitId} />
        <KpiExcelPreviewModal
          open={showPreview}
          file={importFile}
          kpiType={importType}
          onClose={() => { setShowPreview(false); setImportFile(null) }}
          isImporting={importMutation.isPending}
          onImport={(file, kpiType) => importMutation.mutate({ file, kpiType }, { onSuccess: () => { setShowPreview(false); setImportFile(null) } })}
        />
      </div>
  )
}

const CHECKBOX = 'h-4 w-4 cursor-pointer rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-card)] accent-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2'

interface RowProps {
  kpi: KpiCriteria; depth?: number; childCount?: number; isCollapsed?: boolean; onToggleCollapse?: () => void
  onView: () => void; onEdit: () => void; onDelete: () => void; onSubmit: () => void; onDelegate: () => void; onDecompose: () => void
  enableOkr?: boolean; enableWaterfall?: boolean; realWeight?: number | null
  selected?: boolean; onToggleSelect?: () => void; isSelectable?: boolean
  /** Ẩn cột "Giao cho" khi danh sách đã gom theo người — tên người nằm ở header nhóm. */
  hideAssignee?: boolean
}

/**
 * Menu hành động "…" của một chỉ tiêu. Đây là trường hợp DUY NHẤT dùng menu thay vì icon rời
 * (UX_PATTERNS.md P1): có tới 6 hành động tuỳ trạng thái/quyền, xếp thành hàng icon thì không đọc được.
 * Thứ tự cố định: Xem · Phân rã · Thêm KPI con · — · Gửi duyệt · Sửa · Xoá.
 */
function KpiRowMenu({ kpi, onView, onEdit, onDelete, onSubmit, onDelegate, onDecompose, enableWaterfall }: RowProps) {
  const user = useAuthStore(s => s.user)
  const { hasPermission } = usePermission()
  const primaryAssigneeId = kpi.assigneeIds?.[0]
  const { data: assigneeWeight } = useKpiTotalWeight(undefined, kpi.kpiPeriodId, primaryAssigneeId)
  const canSubmit = Math.round(assigneeWeight ?? 0) === 100
  const editable = kpi.status === 'DRAFT' || kpi.status === 'REJECTED'
  const canDecompose = !kpi.parentId && (kpi.status === 'APPROVED' || kpi.status === 'DRAFT' || kpi.status === 'REJECTED') && (kpi.createdById === user?.id || kpi.assigneeIds?.includes(user?.id ?? ''))

  const item = 'flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[var(--color-muted-foreground)]'

  return (
    <div onClick={e => e.stopPropagation()}>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Thao tác" title="Thao tác"><MoreVertical aria-hidden="true" /></Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-1">
          <button type="button" onClick={onView} className={item}><Eye aria-hidden="true" /> Xem chi tiết</button>
          {enableWaterfall && kpi.status === 'APPROVED' && (
            <button type="button" onClick={onDelegate} className={item}><GitBranch aria-hidden="true" /> Phân rã chỉ tiêu</button>
          )}
          {canDecompose && (
            <button type="button" onClick={onDecompose} className={item}><ListPlus aria-hidden="true" /> Thêm KPI con</button>
          )}
          {editable && (
            <>
              <div className="my-1 h-px bg-[var(--color-border)]" role="separator" />
              {kpi.createdById === user?.id && (
                <button
                  type="button"
                  onClick={() => { if (canSubmit) onSubmit(); else toast.error(`Tổng trọng số của nhân sự đang là ${Math.round(assigneeWeight ?? 0)}%. Cần đúng 100% mới gửi duyệt được.`) }}
                  aria-disabled={!canSubmit}
                  title={!canSubmit ? `Trọng số hiện tại ${Math.round(assigneeWeight ?? 0)}% — cần đúng 100%` : undefined}
                  className={cn(item, !canSubmit && 'text-[var(--color-muted-foreground)]')}
                >
                  <Send aria-hidden="true" /> <span className="flex-1">Gửi duyệt</span>
                  {!canSubmit && <AlertCircle aria-hidden="true" className="!text-[var(--color-warning)]" />}
                </button>
              )}
              {(kpi.createdById === user?.id || hasPermission('KPI:UPDATE')) && (
                <button type="button" onClick={onEdit} className={item}><Pencil aria-hidden="true" /> Sửa</button>
              )}
              {(kpi.createdById === user?.id || hasPermission('KPI:DELETE')) && (
                <button type="button" onClick={onDelete} className={cn(item, 'text-[var(--color-error)] hover:bg-[var(--color-error-bg)] [&_svg]:!text-[var(--color-error)]')}><Trash2 aria-hidden="true" /> Xoá</button>
              )}
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function WeightText({ kpi, real }: { kpi: KpiCriteria; real?: number | null }) {
  return (
    <span className="tabular-nums" title={real != null ? `Trọng số thật = ${kpi.weight}% × tỷ trọng hạng mục` : undefined}>
      {real != null
        ? <><span className="font-medium text-[var(--color-foreground)]">{real.toFixed(1)}%</span><span className="text-caption"> / {kpi.weight}%</span></>
        : <span className="font-medium text-[var(--color-foreground)]">{kpi.weight}%</span>}
    </span>
  )
}

function KpiTableRow(props: RowProps) {
  const { kpi, depth = 0, childCount = 0, isCollapsed, onToggleCollapse, onView, enableOkr, realWeight, selected, onToggleSelect, isSelectable, hideAssignee } = props
  const isChildRow = depth > 0
  return (
    <tr aria-selected={selected || undefined} className={cn('transition-colors', selected ? 'bg-[var(--color-primary-soft)]' : 'hover:bg-[var(--color-muted)]', isChildRow && !selected && 'bg-[var(--color-background)]')}>
      <td className="w-10 px-3 py-3">
        {isSelectable && <input type="checkbox" aria-label="Chọn chỉ tiêu" checked={!!selected} onChange={onToggleSelect} className={CHECKBOX} />}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-start gap-1.5" style={{ paddingLeft: isChildRow ? 24 : 0 }}>
          {!isChildRow && childCount > 0 && (
            <Button variant="secondary" size="icon" className="mt-0.5 shrink-0" type="button" onClick={onToggleCollapse} aria-expanded={!isCollapsed} aria-label={isCollapsed ? 'Mở rộng KPI con' : 'Thu gọn KPI con'}>
              <ChevronDown aria-hidden="true" className={cn('transition-transform', isCollapsed && '-rotate-90')} />
            </Button>
          )}
          {isChildRow && <CornerDownRight size={14} className="mt-1 shrink-0 text-[var(--color-subtle-foreground)]" aria-hidden="true" />}
          <div className="min-w-0 max-w-[360px]">
            <button className="max-w-full truncate text-left text-sm font-medium text-[var(--color-foreground)] transition-colors hover:text-[var(--color-primary)] hover:underline max-w-full" type="button" onClick={onView} title={kpi.name}>{kpi.name}</button>
            <div className="mt-0.5"><KpiTagChips kpi={kpi} childCount={childCount} isChildRow={isChildRow} /></div>
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
      {!hideAssignee && (
        <td className="px-4 py-3">
          <div className="max-w-[220px]">
            <p className="truncate text-sm text-[var(--color-foreground)]" title={formatAssigneeNames(kpi.assigneeNames)}>{formatAssigneeNames(kpi.assigneeNames) || '—'}</p>
            {kpi.orgUnitName && <p className="truncate text-caption" title={kpi.orgUnitName}>{kpi.orgUnitName}</p>}
        </div>
      </td>
      )}
      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
        {kpi.kpiType === 'QUALITATIVE' ? <span className="text-caption">—</span> : <><span className="font-medium text-[var(--color-foreground)]">{formatNumber(kpi.targetValue || 0)}</span>{kpi.unit && <span className="text-caption"> {kpi.unit}</span>}</>}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap"><WeightText kpi={kpi} real={realWeight} /></td>
      <td className="px-4 py-3"><StatusBadge status={kpi.status} /></td>
      <td className="px-3 py-2 text-right"><KpiRowMenu {...props} /></td>
    </tr>
  )
}

function KpiCard(props: RowProps) {
  const { kpi, depth = 0, childCount = 0, isCollapsed, onToggleCollapse, onView, enableOkr, realWeight, hideAssignee } = props
  const isChildRow = depth > 0
  return (
    <div className={cn('rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4', isChildRow && 'ml-4')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <button className="max-w-full truncate text-left text-sm font-medium text-[var(--color-foreground)] transition-colors hover:text-[var(--color-primary)] hover:underline" type="button" onClick={onView}>{kpi.name}</button>
          <div className="mt-1"><KpiTagChips kpi={kpi} childCount={childCount} isChildRow={isChildRow} /></div>
        </div>
        <StatusBadge status={kpi.status} />
      </div>
      {!hideAssignee && <p className="mt-2 truncate text-caption">{formatAssigneeNames(kpi.assigneeNames) || 'Chưa giao'}{kpi.orgUnitName ? ` · ${kpi.orgUnitName}` : ''}</p>}
      {enableOkr && kpi.objectiveName && <p className="mt-1 truncate text-caption">OKR: {kpi.objectiveName}</p>}
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
        <div className="flex items-baseline gap-3 tabular-nums">
          {kpi.kpiType !== 'QUALITATIVE' && <span className="text-sm font-medium text-[var(--color-foreground)]">{formatNumber(kpi.targetValue || 0)}{kpi.unit && <span className="text-caption"> {kpi.unit}</span>}</span>}
          <WeightText kpi={kpi} real={realWeight} />
        </div>
        <div className="flex items-center gap-0.5">
          {!isChildRow && childCount > 0 && (
            <Button variant="ghost" size="icon-sm" onClick={onToggleCollapse} aria-label="Mở/thu KPI con"><ChevronDown className={cn('transition-transform', isCollapsed && '-rotate-90')} aria-hidden="true" /></Button>
      )}
          <KpiRowMenu {...props} />
        </div>
      </div>
    </div>
  )
}
