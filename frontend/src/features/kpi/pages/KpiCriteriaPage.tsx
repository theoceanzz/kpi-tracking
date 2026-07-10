import { useState, useRef, useEffect, useMemo } from 'react'
import { format } from 'date-fns'

import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { DatePicker } from '@/components/common/DateTimePicker'
import EmptyState from '@/components/common/EmptyState'
import KpiFormModal from '../components/KpiFormModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useKpiCriteria } from '../hooks/useKpiCriteria'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/store/authStore'
import { useSubmitKpi } from '../hooks/useSubmitKpi'
import { useDeleteKpi } from '../hooks/useDeleteKpi'
import { useSidebarSettings } from '@/features/organization/hooks/useSidebarSettings'
import { formatNumber, formatAssigneeNames, FREQUENCY_MAP, STATUS_CONFIG } from '@/lib/utils'
import type { KpiCriteria } from '@/types/kpi'
import {
  Target, Plus, Send, Pencil, Trash2, MoreVertical,
  Calendar, AlertCircle, Search, HelpCircle,
  Filter, UserCircle2, Upload, Gauge, Eye,
  LayoutGrid, List, ArrowUpDown, ChevronLeft, ChevronRight, ChevronDown, GitBranch, ListPlus, CornerDownRight
} from 'lucide-react'
import KpiDetailModal from '../components/KpiDetailModal'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import KpiImportGuideModal from '../components/KpiImportGuideModal'
import UrgentTaskModal from '../components/UrgentTaskModal'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import { useKpiTotalWeight } from '../hooks/useKpiTotalWeight'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { usePermission } from '@/hooks/usePermission'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useObjectives } from '../../okr/hooks/useOkr'
import KpiExcelPreviewModal from '../components/KpiExcelPreviewModal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import PageTour from '@/components/common/PageTour'
import { kpiCriteriaSteps } from '@/components/common/tourSteps'
import { ObjectiveResponse } from '@/features/okr/types'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useBulkSubmitKpi } from '../hooks/useBulkSubmitKpi'
import { Check, CheckSquare, Zap } from 'lucide-react'
import type { KpiType } from '@/types/kpi'

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
  const [showForm, setShowForm] = useState(false)
  const [editKpi, setEditKpi] = useState<KpiCriteria | null>(null)
  const [deleteKpi, setDeleteKpi] = useState<KpiCriteria | null>(null)
  const [submitKpiId, setSubmitKpiId] = useState<string | null>(null)
  const [selectedKpi, setSelectedKpi] = useState<KpiCriteria | null>(null)
  const [delegateKpi, setDelegateKpi] = useState<KpiCriteria | null>(null)
  const [decomposeKpi, setDecomposeKpi] = useState<KpiCriteria | null>(null)
  const [selectedKpiIds, setSelectedKpiIds] = useState<string[]>([])
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const [showUrgentModal, setShowUrgentModal] = useState(false)
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set())
  
  const [activeTab, setActiveTab] = useState<'ALL' | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'>('ALL')
  const [search, setSearch] = useState('')
  const [showImportGuide, setShowImportGuide] = useState(false)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('')
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState<string>('')
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARD'>(() => window.matchMedia('(max-width: 767px)').matches ? 'CARD' : 'TABLE')
  const [page, setPage] = useState(0)
  const [pageSize] = useState(10)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>('ALL')
  const [selectedKeyResultId, setSelectedKeyResultId] = useState<string>('ALL')
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('ALL')
  const [kpiTypeFilter, setKpiTypeFilter] = useState<KpiTypeFilterKey>('ALL')
  
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importType, setImportType] = useState<KpiType>('QUANTITATIVE')
  const [showPreview, setShowPreview] = useState(false)
  
  const fileRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()
  const { hasPermission } = usePermission()
  const canManageOrg = hasPermission('ORG:VIEW') || hasPermission('ORG:VIEW_TREE')

  const user = useAuthStore(s => s.user)
  const isStaff = !canManageOrg

  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(organizationId)
  const enableOkr = org?.enableOkr
  const enableWaterfall = org?.enableWaterfall
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
  
  const isRootUnit = useMemo(() => {
    const unit = flatOrgUnits.find(u => u.id === selectedOrgUnitId)
    return unit ? unit.parentId === null : false
  }, [flatOrgUnits, selectedOrgUnitId])
  
  useEffect(() => {
    if (isStaff && user?.id && selectedAssigneeId === 'ALL') {
      setSelectedAssigneeId(user.id)
    }
  }, [isStaff, user?.id, selectedAssigneeId])

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
  
  useEffect(() => {
    if (periodsData?.content && !selectedPeriodId) {
      const now = new Date()
      const currentPeriod = periodsData.content.find(p => {
        const start = p.startDate ? new Date(p.startDate) : null
        const end = p.endDate ? new Date(p.endDate) : null
        return start && end && now >= start && now <= end
      })
      
      if (currentPeriod) {
        setSelectedPeriodId(currentPeriod.id)
      } else if (periodsData?.content && periodsData.content.length > 0) {
        setSelectedPeriodId(periodsData.content[0]?.id || '')
      }
    }
  }, [periodsData, selectedPeriodId])


  const { data, isLoading } = useKpiCriteria(
    { 
      page,
      size: pageSize, 
      // Show all KPIs the user has permission for (including colleagues in same unit as per BE update)
      createdById: undefined, 
      kpiPeriodId: selectedPeriodId === 'ALL' ? undefined : selectedPeriodId,
      orgUnitId: selectedOrgUnitId === 'ALL' ? undefined : selectedOrgUnitId,
      organizationId: user?.memberships?.[0]?.organizationId,
      status: activeTab === 'ALL' ? undefined : activeTab as any,
      keyword: search,
      startDate: startDateFilter ? new Date(startDateFilter).toISOString() : undefined,
      endDate: endDateFilter ? new Date(endDateFilter).toISOString() : undefined,
      sortBy,
      sortDir,
      objectiveId: selectedObjectiveId === 'ALL' ? undefined : selectedObjectiveId,
      keyResultId: selectedKeyResultId === 'ALL' ? undefined : selectedKeyResultId,
      assigneeId: selectedAssigneeId === 'ALL' ? undefined : selectedAssigneeId,
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

  const { data: membersData } = useUsers({ 
    orgUnitIds: selectedOrgUnitId === 'ALL' || !selectedOrgUnitId ? undefined : [selectedOrgUnitId],
    size: 500 
  })

  const { data: objectivesData } = useObjectives(user?.memberships?.[0]?.organizationId)
  
  const selectedObjective = objectivesData?.find((o: ObjectiveResponse) => o.id === selectedObjectiveId)
  const keyResults = selectedObjective?.keyResults || []

  const { data: totalWeightData } = useKpiTotalWeight(
    selectedOrgUnitId === 'ALL' ? undefined : selectedOrgUnitId,
    selectedPeriodId === 'ALL' ? '' : selectedPeriodId,
    selectedAssigneeId === 'ALL' ? undefined : selectedAssigneeId
  )
  const deleteMutation = useDeleteKpi()
  const submitMutation = useSubmitKpi()
  const bulkSubmitMutation = useBulkSubmitKpi()

  const { data: customLabels = {} } = useSidebarSettings(organizationId!)
  const rawTitle = ((customLabels as Record<string, string>)['/kpi-criteria'] || 'Quản lý chỉ tiêu')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  const titleParts = rawTitle.trim().split(' ')
  const lastWord = titleParts.length > 1 ? titleParts.pop() : ''
  const mainTitle = titleParts.join(' ')

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
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || 'Import thất bại'
      toast.error(errorMessage)
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

  // Group child KPIs (parentId pointing to another KPI on the same page) directly under their parent,
  // so the table/card views render a collapsible parent → children hierarchy instead of a flat list.
  const { rows: kpiRows, childrenByParentId } = useMemo(() => {
    const list = flatKpis || []
    const byId = new Map(list.map(k => [k.id, k]))
    const childrenMap = new Map<string, KpiCriteria[]>()
    list.forEach(k => {
      if (k.parentId && byId.has(k.parentId)) {
        const arr = childrenMap.get(k.parentId) || []
        arr.push(k)
        childrenMap.set(k.parentId, arr)
      }
    })
    const topLevel = list.filter(k => !k.parentId || !byId.has(k.parentId))
    const rows: { kpi: KpiCriteria; depth: number }[] = []
    topLevel.forEach(k => {
      rows.push({ kpi: k, depth: 0 })
      const children = childrenMap.get(k.id)
      if (children && !collapsedParents.has(k.id)) {
        children.forEach(c => rows.push({ kpi: c, depth: 1 }))
      }
    })
    return { rows, childrenByParentId: childrenMap }
  }, [flatKpis, collapsedParents])

  const filteredKpis = flatKpis || []

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

  const handleBulkSubmit = () => {
    if (selectedKpiIds.length === 0) return
    bulkSubmitMutation.mutate(selectedKpiIds, {
      onSuccess: () => {
        setSelectedKpiIds([])
        setShowBulkConfirm(false)
      }
    })
  }

  const displayTotalWeight = totalWeightData ?? 0

  const stats = {
    total: data?.totalElements || 0,
    draft: (data?.content || []).filter((k: KpiCriteria) => k.status === 'DRAFT').length,
    pending: (data?.content || []).filter((k: KpiCriteria) => k.status === 'PENDING_APPROVAL').length,
  }


  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50">
      <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8">
        <PageTour pageKey="kpi-criteria" steps={kpiCriteriaSteps} />
        
        {/* Bulk Action Float Bar */}
        {selectedKpiIds.length > 0 && (
          <div className="fixed bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-8 duration-500 w-[92vw] sm:w-auto">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-6 px-5 sm:px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[28px] shadow-2xl border border-white/10 dark:border-slate-200 backdrop-blur-xl">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 dark:bg-indigo-50 flex items-center justify-center shrink-0">
                    <CheckSquare size={20} className="text-indigo-400 dark:text-indigo-600" />
                  </div>
                  <div className="flex flex-col">
                    <p className="text-sm font-black uppercase tracking-tight">Đã chọn {selectedKpiIds.length} chỉ tiêu</p>
                    <p className="text-[10px] opacity-60 font-black tracking-widest uppercase">Để thực hiện gửi duyệt hàng loạt</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedKpiIds([])}
                  className="text-xs font-black uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity sm:hidden shrink-0"
                >
                  Hủy
                </button>
              </div>
              <div className="hidden sm:block h-8 w-px bg-white/10 dark:bg-slate-200" />
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowBulkConfirm(true)}
                  disabled={bulkSubmitMutation.isPending}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl bg-indigo-600 dark:bg-indigo-600 text-white text-xs font-black uppercase tracking-widest hover:bg-indigo-700 active:scale-95 transition-all shadow-lg whitespace-nowrap"
                >
                  {bulkSubmitMutation.isPending ? 'Đang xử lý...' : 'Gửi duyệt toàn bộ'} <Send size={14} />
                </button>
                <button
                  onClick={() => setSelectedKpiIds([])}
                  className="hidden sm:inline text-xs font-black uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity"
                >
                  Hủy chọn
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Header Section with Glass Card */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[40px] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
          <div className="relative bg-white dark:bg-slate-900 rounded-[32px] p-8 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-[0.2em] shadow-sm">
                  <Target size={14} className="animate-pulse" /> Trung tâm Chỉ tiêu
                </div>
                <div className="space-y-1">
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                    {mainTitle} <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">{lastWord}</span>
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-lg max-w-xl leading-relaxed">
                    Thiết lập chiến lược, phân bổ trọng số và kiến tạo thành công cho đội ngũ của bạn.
                  </p>
                </div>
              </div>

              <div className="flex items-stretch gap-4">
                <div className="flex bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-md rounded-[28px] border border-slate-200/60 dark:border-slate-700/60 p-2 shadow-inner group/stats">
                  <div className="px-4 sm:px-8 py-3 text-center border-r border-slate-200 dark:border-slate-700 group-hover/stats:scale-105 transition-transform duration-500">
                    <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{stats.total}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Tổng chỉ tiêu</p>
                  </div>
                  <div className="px-4 sm:px-8 py-3 text-center group-hover/stats:scale-105 transition-transform duration-500">
                    <div className={`flex items-center gap-3 justify-center ${
                      displayTotalWeight === 100 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      <Gauge size={24} className={displayTotalWeight !== 100 ? 'animate-bounce' : ''} />
                      <p className="text-3xl font-black tracking-tighter">{displayTotalWeight}%</p>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Trọng số kỳ này</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Warning for Weight */}
        {selectedPeriodId !== 'ALL' && !isRootUnit && allKpis.length > 0 && displayTotalWeight !== 100 && (
          <div className="flex items-center gap-4 p-5 rounded-3xl bg-rose-50/80 dark:bg-rose-900/10 backdrop-blur-md border border-rose-100 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 shadow-lg animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center shrink-0 shadow-sm shadow-rose-200 dark:shadow-none">
              <AlertCircle size={24} className="animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-tight">Cấu hình trọng số chưa hoàn tất</p>
              <p className="text-xs font-bold opacity-80 mt-1">
                Tổng trọng số hiện tại là {displayTotalWeight}%. Vui lòng điều chỉnh để đạt chính xác 100% trước khi gửi phê duyệt.
              </p>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="space-y-6">
          {/* Advanced Toolbar */}
          <div id="tour-kpi-toolbar" className="flex flex-col gap-4 p-5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm transition-all">
            {/* Row 1: Search & Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="relative group flex-1 w-full lg:max-w-2xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input 
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(0) }}
                  placeholder="Tìm KPI, nhân viên..." 
                  className="w-full pl-12 pr-4 h-12 rounded-[20px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-400 shadow-inner"
                />
              </div>

              <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-[18px]">
                  <button
                    onClick={() => setViewMode('TABLE')}
                    className={cn(
                      "p-2.5 rounded-xl transition-all duration-300",
                      viewMode === 'TABLE' ? 'bg-white dark:bg-slate-700 shadow-md text-indigo-600 scale-105' : 'text-slate-400 hover:text-slate-600'
                    )}
                  >
                    <List size={20} />
                  </button>
                  <button
                    onClick={() => setViewMode('CARD')}
                    className={cn(
                      "p-2.5 rounded-xl transition-all duration-300",
                      viewMode === 'CARD' ? 'bg-white dark:bg-slate-700 shadow-md text-indigo-600 scale-105' : 'text-slate-400 hover:text-slate-600'
                    )}
                  >
                    <LayoutGrid size={20} />
                  </button>
                </div>

                <div className="flex items-center gap-2 lg:gap-3">
                  <button
                    onClick={() => setShowImportGuide(true)}
                    className="flex items-center gap-2 px-3 sm:px-5 h-11 sm:h-[52px] rounded-[20px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-black text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 shadow-sm"
                  >
                    <Upload size={16} /> <span className="hidden sm:inline">Import</span>
                  </button>

                  {selectedPeriodId && selectedOrgUnitId && (
                    <button
                      onClick={() => setShowUrgentModal(true)}
                      className="cursor-pointer relative z-10 flex items-center gap-2 px-3 sm:px-5 h-11 sm:h-[52px] rounded-[20px] bg-amber-500 text-white text-xs sm:text-sm font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 active:scale-95"
                    >
                      <Zap size={16} /> <span className="hidden sm:inline">Task khẩn</span>
                    </button>
                  )}

                  <button
                    id="tour-kpi-add-btn"
                    onClick={() => { setEditKpi(null); setShowForm(true) }}
                    className="cursor-pointer relative z-10 flex items-center gap-2 px-3 sm:px-8 h-11 sm:h-[52px] rounded-[20px] bg-indigo-600 text-white text-xs sm:text-sm font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 group"
                  >
                    <Plus size={18} className="group-hover:rotate-90 transition-transform duration-500" /> <span className="hidden sm:inline">Tạo mới</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Filters Row 1: Period, Org Unit, Date Range & Sort */}
            {/* Filters Bar: Grouped by logical category */}
            <div className="flex flex-col xl:flex-row xl:items-center gap-6 pt-6 border-t border-slate-100 dark:border-slate-800/60">
              <div className="flex flex-wrap items-center gap-4 flex-1">
                {/* Group: Organization Context */}
                <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100/50 dark:bg-slate-800/50 rounded-[22px] border border-slate-200/50 dark:border-slate-700/50">
                  <Select value={selectedPeriodId} onValueChange={val => { setSelectedPeriodId(val); setPage(0) }}>
                    <SelectTrigger className="w-full sm:w-64 h-10 rounded-[16px] border-none bg-white dark:bg-slate-900 shadow-sm font-bold text-xs ring-offset-transparent focus:ring-2 focus:ring-indigo-500/20">
                      <Calendar size={14} className="text-indigo-500 mr-2" />
                      <SelectValue placeholder="Đợt KPI..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2">
                      {periodsData?.content.map(p => (
                        <SelectItem key={p.id} value={p.id} className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-sm font-bold">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {canManageOrg && flatOrgUnits.length > 1 && (
                    <Select value={selectedOrgUnitId} onValueChange={val => { setSelectedOrgUnitId(val); setSelectedAssigneeId('ALL'); setPage(0) }}>
                      <SelectTrigger className="w-full sm:w-72 h-10 rounded-[16px] border-none bg-white dark:bg-slate-900 shadow-sm font-bold text-xs ring-offset-transparent focus:ring-2 focus:ring-indigo-500/20">
                        <Filter size={14} className="text-emerald-500 mr-2" />
                        <SelectValue placeholder="Phòng ban..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2 max-h-[400px]">
                        {flatOrgUnits.map((o: any) => (
                          <SelectItem key={o.id} value={o.id} className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-sm font-medium">{o.levelLabel}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <div className="w-full sm:w-64">
                    <Select 
                      value={selectedAssigneeId} 
                      onValueChange={val => { setSelectedAssigneeId(val); setPage(0) }}
                      disabled={!selectedOrgUnitId}
                    >
                      <SelectTrigger className="w-full h-10 rounded-[16px] border-none bg-white dark:bg-slate-900 shadow-sm font-bold text-xs disabled:opacity-50 ring-offset-transparent focus:ring-2 focus:ring-indigo-500/20 transition-all">
                        <UserCircle2 size={14} className="text-amber-500 mr-2" />
                        <SelectValue placeholder="Nhân viên..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2 max-h-[400px]">
                        {!isStaff && <SelectItem value="ALL" className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-xs font-black uppercase">Tất cả nhân viên</SelectItem>}
                        
                        {/* Always show current user for staff, or include in list for managers */}
                        {isStaff && user && (
                          <SelectItem key={user.id} value={user.id} className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-sm font-medium">
                            {user.fullName} {(user as any).employeeCode ? `(${(user as any).employeeCode})` : ''}
                          </SelectItem>
                        )}

                        {!isStaff && membersData?.content.map(u => (
                          <SelectItem key={u.id} value={u.id} className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-sm font-medium">
                            {u.fullName} {u.employeeCode ? `(${u.employeeCode})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Group: KPI Type */}
                <div className="w-full sm:w-56">
                  <Select value={kpiTypeFilter} onValueChange={val => { setKpiTypeFilter(val as KpiTypeFilterKey); setPage(0) }}>
                    <SelectTrigger className="w-full h-10 rounded-[16px] border-none bg-slate-100/50 dark:bg-slate-800/50 shadow-sm font-bold text-xs ring-offset-transparent focus:ring-2 focus:ring-indigo-500/20">
                      <Filter size={14} className="text-violet-500 mr-2" />
                      <SelectValue placeholder="Loại KPI..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2 max-h-[420px]">
                      <SelectItem value="ALL" className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-xs font-black uppercase">Tất cả loại KPI</SelectItem>

                      <SelectGroup>
                        <SelectLabel className="px-2 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-indigo-500">Định lượng</SelectLabel>
                        <SelectItem value="QT_ALL" className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-sm font-bold">Tất cả định lượng</SelectItem>
                        <SelectItem value="QT_PARENT" className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-sm font-bold">KPI cha</SelectItem>
                        <SelectItem value="QT_NORMAL" className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-sm font-bold">KPI thường</SelectItem>
                        <SelectItem value="QT_BONUS" className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-sm font-bold">KPI thưởng (cộng điểm)</SelectItem>
                        <SelectItem value="QT_REVERSE" className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-sm font-bold">KPI ngược</SelectItem>
                      </SelectGroup>

                      {org?.enableQualitative && (
                        <SelectGroup>
                          <SelectLabel className="px-2 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-teal-500">Định tính</SelectLabel>
                          <SelectItem value="QL_ALL" className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-sm font-bold">Tất cả định tính</SelectItem>
                          <SelectItem value="QL_PARENT" className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-sm font-bold">KPI cha</SelectItem>
                          <SelectItem value="QL_NORMAL" className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-sm font-bold">KPI thường</SelectItem>
                          <SelectItem value="QL_BONUS" className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-sm font-bold">KPI thưởng (cộng điểm)</SelectItem>
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Group: Time Range */}
                {/* Mobile: custom picker */}
                <div className="flex md:hidden items-center gap-2 w-full">
                  <DatePicker
                    value={startDateFilter}
                    onChange={(v) => { setStartDateFilter(v); setPage(0) }}
                    onClear={() => { setStartDateFilter(''); setPage(0) }}
                    placeholder="Từ ngày"
                    className="flex-1"
                  />
                  <div className="w-4 h-[1px] bg-slate-300 dark:bg-slate-600 shrink-0" />
                  <DatePicker
                    value={endDateFilter}
                    onChange={(v) => { setEndDateFilter(v); setPage(0) }}
                    onClear={() => { setEndDateFilter(''); setPage(0) }}
                    placeholder="Đến ngày"
                    className="flex-1"
                  />
                </div>
                {/* Desktop: original inputs */}
                <div className="hidden md:flex items-center gap-1 p-1.5 bg-slate-100/50 dark:bg-slate-800/50 rounded-[22px] border border-slate-200/50 dark:border-slate-700/50">
                  <div className="relative group/date">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={12} />
                    <input
                      type="date"
                      value={startDateFilter}
                      onChange={(e) => { setStartDateFilter(e.target.value); setPage(0) }}
                      className="pl-8 pr-2 h-9 rounded-xl border-none bg-white dark:bg-slate-900 text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-transparent w-[130px]"
                    />
                    <div className="absolute inset-0 left-8 flex items-center pointer-events-none text-[10px] font-black uppercase text-slate-600 dark:text-slate-400">
                      {startDateFilter ? format(new Date(startDateFilter), 'dd/MM/yyyy') : 'Từ ngày'}
                    </div>
                  </div>
                  <div className="w-4 h-[1px] bg-slate-300 dark:bg-slate-600 mx-1" />
                  <div className="relative group/date">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={12} />
                    <input
                      type="date"
                      value={endDateFilter}
                      onChange={(e) => { setEndDateFilter(e.target.value); setPage(0) }}
                      className="pl-8 pr-2 h-9 rounded-xl border-none bg-white dark:bg-slate-900 text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-transparent w-[130px]"
                    />
                    <div className="absolute inset-0 left-8 flex items-center pointer-events-none text-[10px] font-black uppercase text-slate-600 dark:text-slate-400">
                      {endDateFilter ? format(new Date(endDateFilter), 'dd/MM/yyyy') : 'Đến ngày'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Group: Sorting */}
              <div className="xl:ml-auto min-w-[180px]">
                <Select value={`${sortBy}-${sortDir}`} onValueChange={(val) => {
                  const [field, dir] = val.split('-')
                  if (field && dir) {
                    setSortBy(field)
                    setSortDir(dir as 'asc' | 'desc')
                    setPage(0)
                  }
                }}>
                  <SelectTrigger className="w-full h-11 rounded-2xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm font-black text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                        <ArrowUpDown size={14} className="text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <SelectValue placeholder="Sắp xếp..." />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2">
                    <SelectItem value="createdAt-desc" className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-xs font-bold">Mới nhất</SelectItem>
                    <SelectItem value="createdAt-asc" className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-xs font-bold">Cũ nhất</SelectItem>
                    <SelectItem value="name-asc" className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-xs font-bold">Tên A-Z</SelectItem>
                    <SelectItem value="name-desc" className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-xs font-black uppercase">Tên Z-A</SelectItem>
                    <SelectItem value="weight-desc" className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-xs font-bold">Trọng số cao</SelectItem>
                    <SelectItem value="weight-asc" className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-xs font-bold">Trọng số thấp</SelectItem>
                    <SelectItem value="targetValue-desc" className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-xs font-bold">Mục tiêu cao</SelectItem>
                    <SelectItem value="targetValue-asc" className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-xs font-bold">Mục tiêu thấp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Filters Row 2: Strategic Filters (OKR) */}
            {enableOkr && (
              <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-3 pt-4 border-t border-slate-50 dark:border-slate-800/30 animate-in slide-in-from-top-2 duration-500">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 md:min-w-[140px] px-2">
                  <Target size={18} className="animate-bounce" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">Bộ lọc OKR</span>
                </div>

                <div className="w-full md:flex-1 md:max-w-[480px]">
                  <Select value={selectedObjectiveId} onValueChange={(v) => { setSelectedObjectiveId(v); setSelectedKeyResultId('ALL'); setPage(0) }}>
                    <SelectTrigger className="h-11 rounded-xl border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-900/10 font-bold text-xs text-indigo-900 dark:text-indigo-100">
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

                <div className="w-full md:flex-1 md:max-w-[480px]">
                  <Select value={selectedKeyResultId} onValueChange={(v) => { setSelectedKeyResultId(v); setPage(0) }} disabled={selectedObjectiveId === 'ALL'}>
                    <SelectTrigger className="h-11 rounded-xl border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-900/10 font-bold text-xs text-indigo-900 dark:text-indigo-100 disabled:opacity-50 transition-all">
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
          <div id="tour-kpi-tabs" className="flex flex-wrap items-center gap-3 py-2 w-full">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {['ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'].map((tab) => {
                const tabLabels: Record<string, string> = {
                  ALL: 'Tất cả',
                  DRAFT: 'Bản nháp',
                  PENDING_APPROVAL: 'Chờ duyệt',
                  APPROVED: 'Đã duyệt',
                  REJECTED: 'Từ chối'
                }
                const active = activeTab === tab
                return (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab as any); setPage(0) }}
                    className={cn(
                      "px-4 sm:px-7 py-2 sm:py-3 rounded-full text-[11px] font-black uppercase tracking-[0.1em] transition-all duration-300 border-2 shadow-sm whitespace-nowrap",
                      active
                        ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900 shadow-indigo-500/10 scale-105'
                        : 'bg-white border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-white'
                    )}
                  >
                    {tabLabels[tab]}
                  </button>
                )
              })}
            </div>

            {hasPersonalDrafts && (
              <div className="ml-auto animate-in fade-in slide-in-from-right-4 duration-500">
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="group relative flex items-center gap-3 px-6 py-3 rounded-full bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all active:scale-95 shadow-sm shadow-rose-200/20">
                      <div className="relative">
                        <HelpCircle size={20} className="relative z-10" />
                        <div className="absolute inset-0 bg-rose-500/20 blur-md rounded-full animate-ping scale-75" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.1em]">Bạn có {personalDraftsData?.totalElements} KPI cần gửi duyệt</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="end" className="w-80 p-5 rounded-[24px] border-rose-100 dark:border-rose-900 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-rose-500/10">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
                        <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
                          <AlertCircle size={20} />
                        </div>
                        <p className="text-sm font-black uppercase tracking-tight">Cần gửi phê duyệt</p>
                      </div>
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
                        Bạn hiện đang có <span className="text-rose-600 dark:text-rose-500 font-black">{personalDraftsData?.totalElements} KPI</span> ở trạng thái <span className="text-rose-600 dark:text-rose-500 font-black">Bản nháp</span>. Vui lòng kiểm tra và gửi phê duyệt để các chỉ tiêu này được chính thức ghi nhận vào kỳ đánh giá.
                      </p>
                      <button 
                        onClick={() => { setActiveTab('DRAFT'); setPage(0) }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-100 transition-all active:scale-95 mt-2"
                      >
                        Xem {personalDraftsData?.totalElements} bản nháp
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {/* Table/Grid Content */}
          {isLoading ? (
            <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
              <LoadingSkeleton type="table" rows={8} />
            </div>
          ) : filteredKpis.length === 0 ? (
            <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-[40px] border border-dashed border-slate-300 dark:border-slate-700 p-24 shadow-sm text-center">
              <EmptyState 
                title="Chưa có dữ liệu" 
                description={search || activeTab !== 'ALL' ? 'Không tìm thấy chỉ tiêu phù hợp với bộ lọc hiện tại.' : 'Hãy bắt đầu bằng cách tạo chỉ tiêu KPI đầu tiên cho đơn vị.'} 
              />
            </div>
          ) : viewMode === 'TABLE' ? (
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[32px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      <th className="px-4 py-4 w-10">
                        <div className="flex items-center justify-center">
                          <button 
                            onClick={toggleSelectAll}
                            disabled={selectableKpis.length === 0}
                            className={cn(
                              "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                              allSelectableSelected 
                                ? "bg-indigo-600 border-indigo-600 text-white" 
                                : "border-slate-200 dark:border-slate-700 hover:border-indigo-400"
                            )}
                          >
                            {allSelectableSelected && <Check size={14} className="stroke-[4]" />}
                          </button>
                        </div>
                      </th>
                      <th className="px-2 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">
                        <button onClick={() => { setSortBy('status'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc') }} className="flex items-center gap-2 hover:text-indigo-600 transition-colors group">
                          Trạng thái <ArrowUpDown size={12} className={cn("transition-opacity", sortBy === 'status' ? "opacity-100 text-indigo-600" : "opacity-0 group-hover:opacity-100")} />
                        </button>
                      </th>
                      <th className="px-2 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">
                        <button onClick={() => { setSortBy('name'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc') }} className="flex items-center gap-2 hover:text-indigo-600 transition-colors group">
                          Chỉ tiêu <ArrowUpDown size={12} className={cn("transition-opacity", sortBy === 'name' ? "opacity-100 text-indigo-600" : "opacity-0 group-hover:opacity-100")} />
                        </button>
                      </th>
                      {enableOkr && (
                        <>
                          <th className="px-2 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Mục tiêu (OKR)</th>
                          <th className="px-2 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Kết quả (KR)</th>
                        </>
                      )}
                      <th className="px-2 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Giao cho</th>
                      <th className="px-2 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right whitespace-nowrap">
                        <button onClick={() => { setSortBy('targetValue'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc') }} className="flex items-center justify-end gap-2 hover:text-indigo-600 transition-colors group w-full">
                          Mục tiêu <ArrowUpDown size={12} className={cn("transition-opacity", sortBy === 'targetValue' ? "opacity-100 text-indigo-600" : "opacity-0 group-hover:opacity-100")} />
                        </button>
                      </th>
                      <th className="px-2 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">
                        <button onClick={() => { setSortBy('weight'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc') }} className="flex items-center gap-2 hover:text-indigo-600 transition-colors group">
                          Trọng số <ArrowUpDown size={12} className={cn("transition-opacity", sortBy === 'weight' ? "opacity-100 text-indigo-600" : "opacity-0 group-hover:opacity-100")} />
                        </button>
                      </th>
                      <th className="px-2 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right whitespace-nowrap">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {kpiRows.map(({ kpi, depth }) => (
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
                        selected={selectedKpiIds.includes(kpi.id)}
                        onToggleSelect={() => toggleSelect(kpi.id)}
                        isSelectable={(kpi.status === 'DRAFT' || kpi.status === 'REJECTED') && kpi.createdById === user?.id}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {kpiRows.map(({ kpi, depth }) => (
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
                />
              ))}
            </div>
          )}

          {/* Premium Pagination */}
          {data && data.totalElements > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 px-8 py-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Hiển thị <span className="text-slate-900 dark:text-white px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">{page * pageSize + 1} - {Math.min((page + 1) * pageSize, data.totalElements)}</span> của <span className="text-slate-900 dark:text-white">{data.totalElements}</span> chỉ tiêu
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p: number) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="flex items-center gap-1.5">
                  {[...Array(data.totalPages)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i)}
                      className={cn(
                        "w-10 h-10 rounded-xl text-xs font-black transition-all duration-300",
                        page === i 
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40 scale-110' 
                          : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-500 dark:text-slate-400'
                      )}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setPage((p: number) => Math.min(data.totalPages - 1, p + 1))}
                  disabled={page === data.totalPages - 1}
                  className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modals & Inputs */}
        <KpiFormModal
          open={showForm}
          onClose={() => { setShowForm(false); setEditKpi(null); setDelegateKpi(null); setDecomposeKpi(null) }}
          editKpi={editKpi}
          parentKpi={delegateKpi || decomposeKpi}
          parentRelationType={delegateKpi ? 'DELEGATION' : decomposeKpi ? 'DECOMPOSITION' : undefined}
        />
        <KpiImportGuideModal 
          open={showImportGuide} 
          onClose={() => setShowImportGuide(false)} 
          onSelectFile={(kpiType) => { setImportType(kpiType); fileRef.current?.click() }}
        />
        <ConfirmDialog 
          open={!!submitKpiId} 
          onClose={() => setSubmitKpiId(null)} 
          onConfirm={() => submitKpiId && submitMutation.mutate(submitKpiId, { onSuccess: () => setSubmitKpiId(null) })} 
          title="Gửi duyệt KPI" 
          description="Gửi chỉ tiêu này lên hệ thống để cấp quản lý phê duyệt?" 
          confirmLabel="Gửi phê duyệt" 
          loading={submitMutation.isPending} 
        />
        <ConfirmDialog 
          open={!!deleteKpi} 
          onClose={() => setDeleteKpi(null)} 
          onConfirm={() => deleteKpi && deleteMutation.mutate(deleteKpi.id, { onSuccess: () => setDeleteKpi(null) })} 
          title="Xoá vĩnh viễn" 
          description={`Bạn có chắc chắn muốn xoá chỉ tiêu "${deleteKpi?.name}" không? Hành động này không thể hoàn tác.`} 
          confirmLabel="Xoá vĩnh viễn" 
          loading={deleteMutation.isPending} 
        />
        <KpiDetailModal open={!!selectedKpi} onClose={() => setSelectedKpi(null)} kpi={selectedKpi} />
        <ConfirmDialog 
          open={showBulkConfirm} 
          onClose={() => setShowBulkConfirm(false)} 
          onConfirm={handleBulkSubmit} 
          title="Gửi duyệt hàng loạt" 
          description={`Bạn đang gửi ${selectedKpiIds.length} chỉ tiêu lên hệ thống để phê duyệt. Hãy đảm bảo tổng trọng số của nhân sự đã đạt 100%. Tiếp tục?`} 
          confirmLabel="Gửi phê duyệt tất cả" 
          loading={bulkSubmitMutation.isPending} 
        />
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
        <UrgentTaskModal
          open={showUrgentModal}
          onClose={() => setShowUrgentModal(false)}
          kpiPeriodId={selectedPeriodId}
          orgUnitId={selectedOrgUnitId}
        />
        <KpiExcelPreviewModal
          open={showPreview}
          file={importFile}
          kpiType={importType}
          onClose={() => { setShowPreview(false); setImportFile(null) }}
          isImporting={importMutation.isPending}
          onImport={(file, kpiType) => importMutation.mutate({ file, kpiType }, { onSuccess: () => { setShowPreview(false); setImportFile(null) } })}
        />
      </div>
    </div>
  )
}

function KpiTableRow({ kpi, depth = 0, childCount = 0, isCollapsed, onToggleCollapse, onView, onEdit, onDelete, onSubmit, onDelegate, onDecompose, enableOkr, enableWaterfall, selected, onToggleSelect, isSelectable }: {
  kpi: KpiCriteria; depth?: number; childCount?: number; isCollapsed?: boolean; onToggleCollapse?: () => void;
  onView: () => void; onEdit: () => void; onDelete: () => void; onSubmit: () => void; onDelegate: () => void; onDecompose: () => void; enableOkr?: boolean; enableWaterfall?: boolean;
  selected: boolean; onToggleSelect: () => void; isSelectable: boolean;
}) {
  const user = useAuthStore(s => s.user)
  const { hasPermission } = usePermission()
  const status = STATUS_CONFIG[kpi.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG['DRAFT']!
  const StatusIcon = status.icon

  const primaryAssigneeId = kpi.assigneeIds?.[0]
  const { data: assigneeWeight } = useKpiTotalWeight(undefined, kpi.kpiPeriodId, primaryAssigneeId)
  const canSubmit = Math.round(assigneeWeight ?? 0) === 100
  const isChildRow = depth > 0

  return (
    <tr className={cn(
      "group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors",
      selected && "bg-indigo-50/30 dark:bg-indigo-900/10",
      isChildRow && "bg-slate-50/40 dark:bg-slate-800/20"
    )}>
      <td className="px-4 py-5 w-10">
        <div className="flex items-center justify-center">
          <button 
            onClick={(e) => { e.stopPropagation(); onToggleSelect() }}
            disabled={!isSelectable}
            className={cn(
              "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
              selected ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-200 dark:border-slate-700",
              !isSelectable && "opacity-20 cursor-not-allowed group-hover:opacity-40"
            )}
          >
            {selected && <Check size={14} className="stroke-[4]" />}
          </button>
        </div>
      </td>
      <td className="px-4 py-5">
        <div className={cn(
          "inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest shadow-sm whitespace-nowrap",
          status.bgColor, status.color
        )}>
          <StatusIcon size={10} className={kpi.status === 'PENDING_APPROVAL' ? 'animate-spin-slow' : ''} /> {status.label}
        </div>
      </td>
      <td className="px-2 py-4">
        <div className="flex items-start gap-1.5" style={{ paddingLeft: isChildRow ? 28 : 0 }}>
          {!isChildRow && childCount > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleCollapse?.() }}
              className="shrink-0 mt-1.5 w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 transition-all"
              title={isCollapsed ? 'Mở rộng KPI con' : 'Thu gọn KPI con'}
            >
              <ChevronDown size={14} className={cn("transition-transform", isCollapsed && "-rotate-90")} />
            </button>
          )}
          {isChildRow && (
            <CornerDownRight size={14} className="shrink-0 mt-1.5 text-slate-300 dark:text-slate-600" />
          )}
          <button onClick={onView} className="max-w-[280px] text-left group/name focus:outline-none">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className={cn(
                "font-black text-slate-900 dark:text-white group-hover/name:text-indigo-600 transition-colors line-clamp-1",
                isChildRow ? "text-[13px]" : "text-sm"
              )}>
                {kpi.name}
              </p>
              {!isChildRow && childCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-black uppercase tracking-wider border border-slate-200 dark:border-slate-700">
                  {childCount} KPI con
                </span>
              )}
            </div>
            {kpi.kpiType === 'QUALITATIVE' && (
              <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 text-[9px] font-black uppercase tracking-wider border border-teal-200 dark:border-teal-800/50">
                ★ Định tính
              </span>
            )}
            {kpi.isReverseKpi && (
              <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[9px] font-black uppercase tracking-wider border border-orange-200 dark:border-orange-800/50">
                ↓ KPI Ngược
              </span>
            )}
            {kpi.isBonusKpi && (
              <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-wider border border-emerald-200 dark:border-emerald-800/50">
                + KPI Thưởng
              </span>
            )}
            {isChildRow && kpi.parentRelationType && (
              <span className={cn(
                "inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                kpi.parentRelationType === 'DECOMPOSITION'
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50"
                  : "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800/50"
              )}>
                {kpi.parentRelationType === 'DECOMPOSITION' ? 'Chia nhỏ' : 'Phân rã'}
              </span>
            )}
            {/* We hide the inline KR name if enableOkr is true because it now has its own column */}
            {!enableOkr && kpi.keyResultName && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
                <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-tight">
                  KR: {kpi.keyResultName}
                </span>
              </div>
            )}
            {!isChildRow && kpi.parentName && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
                <span className="text-[10px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-tight">
                  Thuộc: {kpi.parentName}
                </span>
              </div>
            )}
            <p className="text-[11px] text-slate-400 font-medium line-clamp-1 mt-0.5 group-hover/name:text-slate-500 transition-colors">
              {kpi.description || 'Không có mô tả chi tiết'}
            </p>
          </button>
        </div>
      </td>
      {enableOkr && (
        <>
          <td className="px-2 py-4">
            {kpi.objectiveName ? (
              <div className="flex flex-col max-w-[180px]">
                <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tight truncate" title={kpi.objectiveCode || ''}>
                  {kpi.objectiveCode || 'N/A'}
                </span>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 line-clamp-1" title={kpi.objectiveName}>
                  {kpi.objectiveName}
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-400 italic">N/A</span>
            )}
          </td>
          <td className="px-2 py-4">
            {kpi.keyResultName ? (
              <div className="flex flex-col max-w-[180px]">
                <span className="text-[9px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-tight truncate" title={kpi.keyResultCode || ''}>
                  {kpi.keyResultCode || 'N/A'}
                </span>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 line-clamp-1" title={kpi.keyResultName}>
                  {kpi.keyResultName}
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-400 italic">N/A</span>
            )}
          </td>
        </>
      )}
      <td className="px-2 py-4">
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-2 py-1.5 rounded-xl w-fit max-w-[160px] border border-slate-100 dark:border-slate-800 shadow-sm" title={formatAssigneeNames(kpi.assigneeNames)}>
          <UserCircle2 size={12} className="text-slate-400 shrink-0" />
          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">
            {formatAssigneeNames(kpi.assigneeNames)}
          </span>
        </div>
      </td>
      <td className="px-2 py-4 text-right whitespace-nowrap">
        <div className="flex items-baseline justify-end gap-1">
          <span className="text-sm font-black text-slate-900 dark:text-white">
            {formatNumber(kpi.targetValue || 0)}
          </span>
          <span className="text-[9px] font-black uppercase tracking-tighter text-slate-400">{kpi.unit}</span>
        </div>
      </td>
      <td className="px-2 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <div className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100/50 dark:border-indigo-800/50 flex items-center gap-1.5">
            <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400">{kpi.weight}%</span>
          </div>
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-1.5 py-1 rounded-md">
            {FREQUENCY_MAP[kpi.frequency as keyof typeof FREQUENCY_MAP] || kpi.frequency}
          </div>
        </div>
      </td>

      <td className="px-2 py-4 text-right">
        <div onClick={e => e.stopPropagation()}>
          <Popover>
            <PopoverTrigger asChild>
              <button 
                className="p-2 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 outline-none transition-all hover:bg-white dark:hover:bg-slate-800 data-[state=open]:bg-white dark:data-[state=open]:bg-slate-800 data-[state=open]:border-slate-200 dark:data-[state=open]:border-slate-700 data-[state=open]:text-indigo-600"
                title="Thao tác"
              >
                <MoreVertical size={18} />
              </button>
            </PopoverTrigger>

            <PopoverContent align="end" className="w-64 p-2 rounded-[24px] bg-white dark:bg-slate-800 shadow-2xl border border-slate-200/60 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200 z-[100]">
              <div className="p-0 space-y-1">
                <button 
                  onClick={() => onView()}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold rounded-[14px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all whitespace-nowrap group"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-900/40 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Eye size={15} className="text-slate-500" />
                  </div>
                  Xem chi tiết
                </button>

                {enableWaterfall && kpi.status === 'APPROVED' && (
                  <button
                    onClick={() => onDelegate()}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold rounded-[14px] text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-all whitespace-nowrap group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <GitBranch size={15} />
                    </div>
                    Phân rã chỉ tiêu
                  </button>
                )}

                {!kpi.parentId && (kpi.status === 'APPROVED' || kpi.status === 'DRAFT' || kpi.status === 'REJECTED') && (kpi.createdById === user?.id || kpi.assigneeIds?.includes(user?.id ?? '')) && (
                  <button
                    onClick={() => onDecompose()}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold rounded-[14px] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all whitespace-nowrap group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <ListPlus size={15} />
                    </div>
                    Thêm KPI con
                  </button>
                )}

                {(kpi.status === 'DRAFT' || kpi.status === 'REJECTED') && (
                  <>
                    <div className="h-px bg-slate-100 dark:bg-slate-700/50 mx-2 my-1" />
                    
                    {kpi.createdById === user?.id && (
                      <div className="relative flex items-center w-full">
                        <button
                          onClick={() => { 
                            if (canSubmit) {
                              onSubmit(); 
                            } else {
                              toast.error(`Trọng số của nhân viên đang là ${Math.round(assigneeWeight ?? 0)}%, cần đạt 100% để gửi duyệt.`)
                            }
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold rounded-[14px] transition-all whitespace-nowrap group",
                            canSubmit ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20' : 'text-slate-300 cursor-not-allowed opacity-50'
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform",
                            canSubmit ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-slate-50 dark:bg-slate-900/20'
                          )}>
                              <Send size={15} className={canSubmit ? 'text-blue-600' : 'text-slate-300'} />
                          </div>
                          <span className="flex-1 text-left">Gửi phê duyệt</span>
                          {!canSubmit && (
                            <div 
                              title={`Trọng số hiện tại: ${Math.round(assigneeWeight ?? 0)}%. Cần đạt chính xác 100% để có thể gửi duyệt.`}
                              className="shrink-0"
                            >
                              <AlertCircle size={18} className="text-red-600 drop-shadow-sm" />
                            </div>
                          )}
                        </button>
                      </div>
                    )}

                    {(kpi.createdById === user?.id || hasPermission('KPI:UPDATE')) && (
                      <button 
                        onClick={() => onEdit()}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold rounded-[14px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all whitespace-nowrap group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <Pencil size={15} className="text-indigo-600" />
                        </div>
                        Chỉnh sửa
                      </button>
                    )}

                    {(kpi.createdById === user?.id || hasPermission('KPI:DELETE')) && (
                      <button 
                        onClick={() => onDelete()}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold rounded-[14px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all whitespace-nowrap group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <Trash2 size={15} className="text-red-600" />
                        </div>
                        Xoá vĩnh viễn
                      </button>
                    )}
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </td>
    </tr>
  )
}

function KpiCard({ kpi, depth = 0, childCount = 0, isCollapsed, onToggleCollapse, onView, onEdit, onDelete, onSubmit, onDelegate, onDecompose, enableOkr, enableWaterfall }: {
  kpi: KpiCriteria; depth?: number; childCount?: number; isCollapsed?: boolean; onToggleCollapse?: () => void;
  onView: () => void; onEdit: () => void; onDelete: () => void; onSubmit: () => void; onDelegate: () => void; onDecompose: () => void; enableOkr?: boolean; enableWaterfall?: boolean
}) {
  const user = useAuthStore(s => s.user)
  const { hasPermission } = usePermission()

  const primaryAssigneeId = kpi.assigneeIds?.[0]
  const { data: assigneeWeight } = useKpiTotalWeight(undefined, kpi.kpiPeriodId, primaryAssigneeId)
  const canSubmit = Math.round(assigneeWeight ?? 0) === 100

  const status = STATUS_CONFIG[kpi.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG['DRAFT']!
  const StatusIcon = status.icon
  const isChildCard = depth > 0

  return (
    <div
      className={cn(
        "group relative bg-white dark:bg-slate-900 rounded-[32px] border shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden",
        isChildCard
          ? "border-l-4 border-l-emerald-400 dark:border-l-emerald-600 border-slate-200 dark:border-slate-800 ml-6 lg:ml-10"
          : "border-slate-200 dark:border-slate-800"
      )}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-indigo-500/10 transition-colors" />

      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 relative">
        <div className="flex items-center gap-2 flex-wrap">
          <div className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest shadow-sm",
            status.bgColor, status.color
          )}>
            <StatusIcon size={12} /> {status.label}
          </div>
          {!isChildCard && childCount > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleCollapse?.() }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-black uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              <ChevronDown size={11} className={cn("transition-transform", isCollapsed && "-rotate-90")} />
              {childCount} KPI con
            </button>
          )}
        </div>
        <div className="relative">
          <Popover>
            <PopoverTrigger asChild>
              <button 
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 transition-all border border-transparent hover:border-slate-200 data-[state=open]:bg-slate-50 dark:data-[state=open]:bg-slate-800 data-[state=open]:border-slate-200 dark:data-[state=open]:border-slate-700"
              >
                <MoreVertical size={20} />
              </button>
            </PopoverTrigger>

            <PopoverContent align="end" className="w-52 p-1.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200 z-[100]">
              <div className="space-y-0.5">
                <button 
                  onClick={() => onView()} 
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <Eye size={18} className="text-slate-400" /> Chi tiết
                </button>
                {enableWaterfall && kpi.status === 'APPROVED' && (
                  <button 
                    onClick={() => onDelegate()} 
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 transition-colors"
                  >
                    <GitBranch size={18} /> Phân rã (Delegate)
                  </button>
                )}
                {!kpi.parentId && (kpi.status === 'APPROVED' || kpi.status === 'DRAFT' || kpi.status === 'REJECTED') && (kpi.createdById === user?.id || kpi.assigneeIds?.includes(user?.id ?? '')) && (
                  <button
                    onClick={() => onDecompose()}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                  >
                    <ListPlus size={18} /> Thêm KPI con
                  </button>
                )}
                {(kpi.status === 'DRAFT' || kpi.status === 'REJECTED') && (
                  <>
                    <div className="h-px bg-slate-100 dark:bg-slate-800 mx-2 my-1" />
                    {kpi.createdById === user?.id && (
                      <button
                        onClick={() => {
                          if (canSubmit) {
                            onSubmit()
                          } else {
                            toast.error(`Trọng số của nhân viên đang là ${Math.round(assigneeWeight ?? 0)}%, cần đạt 100% để gửi duyệt.`)
                          }
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all group",
                          canSubmit ? 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30' : 'text-slate-400 cursor-not-allowed opacity-50'
                        )}
                      >
                        <Send size={18} /> 
                        <span className="flex-1 text-left">Gửi phê duyệt</span>
                        {!canSubmit && (
                          <div 
                            title={`Trọng số hiện tại: ${Math.round(assigneeWeight ?? 0)}%. Cần đạt chính xác 100% để có thể gửi duyệt.`}
                            className="shrink-0"
                          >
                            <AlertCircle size={18} className="text-red-600 drop-shadow-sm" />
                          </div>
                        )}
                      </button>
                    )}
                    {(kpi.createdById === user?.id || hasPermission('KPI:UPDATE')) && (
                      <button 
                        onClick={() => onEdit()} 
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Pencil size={18} className="text-slate-400" /> Chỉnh sửa
                      </button>
                    )}
                    {(kpi.createdById === user?.id || hasPermission('KPI:DELETE')) && (
                      <button 
                        onClick={() => onDelete()} 
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                      >
                        <Trash2 size={18} /> Xóa vĩnh viễn
                      </button>
                    )}
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="p-7 flex-1 space-y-6 relative">
        <button onClick={onView} className="text-left w-full group/title">
          <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight group-hover/title:text-indigo-600 transition-colors line-clamp-2">
            {kpi.name}
          </h3>
          {kpi.kpiType === 'QUALITATIVE' && (
            <span className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-1 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 text-[9px] font-black uppercase tracking-wider border border-teal-200 dark:border-teal-800/50">
              ★ Định tính
            </span>
          )}
          {kpi.isReverseKpi && (
            <span className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[9px] font-black uppercase tracking-wider border border-orange-200 dark:border-orange-800/50">
              ↓ KPI Ngược
            </span>
          )}
          {isChildCard && kpi.parentRelationType && (
            <span className={cn(
              "inline-flex items-center gap-1 mt-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border",
              kpi.parentRelationType === 'DECOMPOSITION'
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50"
                : "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800/50"
            )}>
              {kpi.parentRelationType === 'DECOMPOSITION' ? 'Chia nhỏ' : 'Phân rã'} · {kpi.parentName}
            </span>
          )}
          {kpi.isBonusKpi && (
            <span className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-wider border border-emerald-200 dark:border-emerald-800/50">
              + KPI Thưởng
            </span>
          )}
          {enableOkr && kpi.keyResultName && (
            <div className="flex items-center gap-2 mt-2 px-3 py-1 bg-violet-50 dark:bg-violet-900/20 rounded-lg w-fit border border-violet-100 dark:border-violet-800/50">
              <Target size={12} className="text-violet-600" />
              <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest">
                {kpi.keyResultName}
              </span>
            </div>
          )}
          {enableWaterfall && kpi.parentName && (
            <div className="flex items-center gap-2 mt-2 px-3 py-1 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg w-fit border border-cyan-100 dark:border-cyan-800/50">
              <GitBranch size={12} className="text-cyan-600" />
              <span className="text-[10px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">
                Parent: {kpi.parentName}
              </span>
            </div>
          )}
          <p className="text-sm font-medium text-slate-400 mt-3 line-clamp-2 leading-relaxed">
            {kpi.description || 'Không có mô tả bổ sung cho chỉ tiêu này'}
          </p>
        </button>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-inner">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Mục tiêu</p>
            <p className="text-xl font-black text-slate-900 dark:text-white flex items-baseline gap-1">
              {formatNumber(kpi.targetValue || 0)} 
              <span className="text-[10px] font-black text-slate-400 uppercase">{kpi.unit}</span>
            </p>
          </div>
          <div className="p-4 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-3xl border border-indigo-100/50 dark:border-indigo-900/20 shadow-inner">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Trọng số</p>
            <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">
              {kpi.weight}%
            </p>
          </div>
        </div>
      </div>

      <div className="px-7 py-5 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between mt-auto">
        <div className="flex items-center gap-2.5 max-w-[65%]">
          <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center border border-slate-200/50 dark:border-slate-700/50">
            <UserCircle2 size={16} className="text-slate-400" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Giao cho</span>
            <span className="text-xs font-black text-slate-700 dark:text-slate-200 truncate">
              {formatAssigneeNames(kpi.assigneeNames)}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Tần suất</span>
          <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase">
            {FREQUENCY_MAP[kpi.frequency as keyof typeof FREQUENCY_MAP] || kpi.frequency}
          </span>
        </div>
      </div>
    </div>
  )
}