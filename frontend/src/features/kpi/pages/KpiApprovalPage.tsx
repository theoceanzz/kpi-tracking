import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import KpiReviewModal from '../components/KpiReviewModal'
import { useKpiCriteria } from '../hooks/useKpiCriteria'
import { formatNumber, formatAssigneeNames, cn, FREQUENCY_MAP, STATUS_CONFIG } from '@/lib/utils'
import type { KpiCriteria } from '@/types/kpi'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import { 
  Users, Building2, ChevronRight, ArrowUpDown,
  Calendar, ChevronLeft, Search, CheckCircle, 
  ShieldCheck, Target, GitBranch,
  Loader2
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useObjectives } from '../../okr/hooks/useOkr'
import PageTour from '@/components/common/PageTour'
import { kpiPendingSteps } from '@/components/common/tourSteps'
import { ObjectiveResponse } from '@/features/okr/types'





export default function KpiApprovalPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as any) || 'PENDING_APPROVAL'
  
  const [activeTab, setActiveTab] = useState<'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ALL'>(initialTab)
  
  const [selectedPeriodId, setSelectedPeriodId] = useState('ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize] = useState(10)
  const [sortBy, setSortBy] = useState('updatedAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState<string>('ALL')
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>('ALL')
  const [selectedKeyResultId, setSelectedKeyResultId] = useState<string>('ALL')
  
  // Selection state
  const [selectedKpis, setSelectedKpis] = useState<string[]>([])
  
  const user = useAuthStore(s => s.user)
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

  // Default to Root unit
  useEffect(() => {
    if (flatOrgUnits.length > 0 && selectedOrgUnitId === 'ALL') {
      setSelectedOrgUnitId(flatOrgUnits[0].id)
    }
  }, [flatOrgUnits])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && tab !== activeTab) {
      setActiveTab(tab as any)
    }
  }, [searchParams])

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab)
    setSearchParams({ tab })
    setPage(0)
    setSelectedKpis([])
  }

  // Data for KPI Criteria
  const { data: criteriaData, isLoading } = useKpiCriteria(
    { 
      status: activeTab === 'ALL' ? undefined : activeTab,
      kpiPeriodId: selectedPeriodId === 'ALL' ? undefined : selectedPeriodId,
      orgUnitId: selectedOrgUnitId === 'ALL' ? undefined : selectedOrgUnitId,
      organizationId: user?.memberships?.[0]?.organizationId,
      page,
      size: pageSize,
      sortBy,
      sortDir,
      objectiveId: selectedObjectiveId === 'ALL' ? undefined : selectedObjectiveId,
      keyResultId: selectedKeyResultId === 'ALL' ? undefined : selectedKeyResultId
    }
  )

  const { data: objectivesData } = useObjectives(user?.memberships?.[0]?.organizationId)
  const selectedObjective = objectivesData?.find((o: ObjectiveResponse) => o.id === selectedObjectiveId)
  const keyResults = selectedObjective?.keyResults || []

  const [reviewKpi, setReviewKpi] = useState<KpiCriteria | null>(null)

  const items = criteriaData?.content ?? []
  const totalPages = criteriaData?.totalPages || 1
  const totalElements = criteriaData?.totalElements || 0

  // Quick stats
  const { data: statsData } = useKpiCriteria({ size: 1000, organizationId: user?.memberships?.[0]?.organizationId })
  const stats = useMemo(() => {
    const all = statsData?.content ?? []
    return {
      total: all.length,
      pending: all.filter(k => k.status === 'PENDING_APPROVAL').length,
      approved: all.filter(k => k.status === 'APPROVED').length,
      rejected: all.filter(k => k.status === 'REJECTED').length,
    }
  }, [statsData])

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
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
        <PageTour pageKey="kpi-pending" steps={kpiPendingSteps} />
        
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
                    Xét duyệt <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Chỉ tiêu KPI</span>
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm max-w-xl leading-relaxed">
                    Hệ thống hóa quy trình phê duyệt chỉ tiêu cho toàn bộ tổ chức.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <StatChip label="Đợi duyệt" value={stats.pending} color="amber" />
                <StatChip label="Từ chối" value={stats.rejected} color="red" />
                <StatChip label="Đã duyệt" value={stats.approved} color="emerald" />
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div id="tour-pending-toolbar" className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0) }}
                placeholder="Tìm tên, phòng ban, nhân sự..." 
                className="w-full pl-12 pr-4 h-12 rounded-[18px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              />
            </div>
            
            <div className="w-full md:w-64">
              <Select value={selectedOrgUnitId} onValueChange={(v) => { setSelectedOrgUnitId(v); setPage(0) }}>
                <SelectTrigger className="h-12 rounded-[18px] border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold text-sm">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-slate-400" />
                    <SelectValue placeholder="Chọn đơn vị" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800">
                  {flatOrgUnits.map(unit => (
                    <SelectItem key={unit.id} value={unit.id} className="font-medium">{unit.levelLabel}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full md:w-64">
              <Select value={selectedPeriodId} onValueChange={(v) => { setSelectedPeriodId(v); setPage(0) }}>
                <SelectTrigger className="h-12 rounded-[18px] border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-slate-400" />
                    <SelectValue placeholder="Chọn đợt KPI" />
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

            {enableOkr && (
              <>
                <div className="w-full md:w-64">
                  <Select value={selectedObjectiveId} onValueChange={(v) => { setSelectedObjectiveId(v); setSelectedKeyResultId('ALL'); setPage(0) }}>
                    <SelectTrigger className="h-12 rounded-[18px] border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold text-sm">
                      <div className="flex items-center gap-2">
                        <Target size={16} className="text-slate-400" />
                        <SelectValue placeholder="Chọn Mục tiêu" />
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

                <div className="w-full md:w-64">
                  <Select value={selectedKeyResultId} onValueChange={(v) => { setSelectedKeyResultId(v); setPage(0) }} disabled={selectedObjectiveId === 'ALL'}>
                    <SelectTrigger className="h-12 rounded-[18px] border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold text-sm">
                      <div className="flex items-center gap-2">
                        <GitBranch size={16} className="text-slate-400" />
                        <SelectValue placeholder="Chọn Kết quả" />
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
              </>
            )}
          </div>
        </div>

        {/* Status Tabs Row */}
        <div id="tour-pending-tabs" className="flex flex-wrap items-center gap-3 py-2">
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
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 duration-500">
            <div className="bg-slate-900 dark:bg-indigo-950 text-white px-8 py-3.5 rounded-[24px] shadow-2xl flex items-center gap-6 border border-white/10 backdrop-blur-xl">
              <div className="flex items-center gap-3 border-r border-white/10 pr-6 whitespace-nowrap">
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
            <div className="overflow-x-auto scrollbar-thin">
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
                    <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">
                      Phòng ban / Nhân sự
                    </th>
                    <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right whitespace-nowrap">Mục tiêu</th>
                    <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Trọng số</th>
                    <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {items.map((item: any, i: number) => {
                    const kpi = item as KpiCriteria
                    const status = STATUS_CONFIG[kpi.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG['PENDING_APPROVAL']!
                    const StatusIcon = status.icon
                    const isSelected = selectedKpis.includes(kpi.id)

                    return (
                      <tr 
                        key={kpi.id} 
                        className={cn(
                          "group transition-all duration-300 animate-in fade-in slide-in-from-left-4",
                          isSelected ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
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
                          <div className={cn(
                            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest shadow-sm whitespace-nowrap",
                            status.bgColor, status.color
                          )}>
                            <StatusIcon size={12} className={kpi.status === 'PENDING_APPROVAL' ? 'animate-pulse' : ''} /> {status.label}
                          </div>
                        </td>
                        <td className="px-4 py-5">
                          <button onClick={() => setReviewKpi(kpi)} className="max-w-[240px] text-left group/name focus:outline-none">
                            <p className="text-sm font-black text-slate-900 dark:text-white group-hover/name:text-indigo-600 transition-colors line-clamp-1">
                              {kpi.name}
                            </p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mt-1">{FREQUENCY_MAP[kpi.frequency as keyof typeof FREQUENCY_MAP] || kpi.frequency}</p>
                          </button>
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
                        <td className="px-4 py-5">
                          <div className="space-y-1.5 max-w-[200px]">
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1 rounded-lg w-fit border border-slate-100 dark:border-slate-800 shadow-sm">
                              <Building2 size={12} className="text-slate-400 shrink-0" />
                              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate">{kpi.orgUnitName || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-2 px-2.5 text-[10px] font-medium text-slate-500" title={formatAssigneeNames(kpi.assigneeNames)}>
                              <Users size={12} className="text-slate-400 shrink-0" /> <span className="truncate">{formatAssigneeNames(kpi.assigneeNames)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-5 text-right whitespace-nowrap">
                          <div className="flex items-baseline justify-end gap-1">
                            <span className="text-sm font-black text-slate-900 dark:text-white">
                              {formatNumber(kpi.targetValue || 0)}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400">{kpi.unit}</span>
                          </div>
                        </td>
                        <td className="px-4 py-5 whitespace-nowrap">
                          <div className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100/50 dark:border-indigo-800/50 flex items-center justify-center gap-2 w-fit">
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{kpi.weight}%</span>
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
            </div>
          </div>
        )}

        {/* Pagination Section */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4">
          <div className="flex items-center gap-4 text-sm">
            <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">
              Trang <span className="text-slate-900 dark:text-white">{page + 1}</span> / {totalPages}
            </p>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
            <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">
              Tổng <span className="text-slate-900 dark:text-white">{totalElements}</span> mục
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm"
            >
              <ChevronLeft size={18} />
            </button>
            
            <div className="flex items-center gap-1.5">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                const pageNum = i
                return (
                  <button
                    key={i}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      "w-11 h-11 rounded-2xl text-xs font-black transition-all duration-300 shadow-sm border",
                      page === pageNum 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20 scale-110' 
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-400'
                    )}
                  >
                    {pageNum + 1}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <KpiReviewModal open={!!reviewKpi} onClose={() => setReviewKpi(null)} kpi={reviewKpi} />
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
      "flex flex-col items-center justify-center min-w-[100px] px-4 py-2.5 rounded-2xl border backdrop-blur-sm transition-all hover:scale-105 duration-300",
      colorMap[color]
    )}>
      <span className="text-xl font-black tracking-tighter">{value}</span>
      <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">{label}</span>
    </div>
  )
}
