import { useState, useRef, useEffect, useMemo } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import KpiFormModal from '../components/KpiFormModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useKpiCriteria } from '../hooks/useKpiCriteria'
import { useAuthStore } from '@/store/authStore'
import { useSubmitKpi } from '../hooks/useSubmitKpi'
import { useDeleteKpi } from '../hooks/useDeleteKpi'
import { formatNumber, formatAssigneeNames } from '@/lib/utils'
import type { KpiCriteria } from '@/types/kpi'
import {
  Target, Plus, Send, Pencil, Trash2, MoreVertical,
  Calendar, CheckCircle2, AlertCircle, XCircle, Search, 
  Filter, UserCircle2, Upload, Gauge, Eye,
  LayoutGrid, List, ArrowUpDown, ChevronLeft, ChevronRight
} from 'lucide-react'
import KpiDetailModal from '../components/KpiDetailModal'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import KpiImportGuideModal from '../components/KpiImportGuideModal'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import { useKpiTotalWeight } from '../hooks/useKpiTotalWeight'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { usePermission } from '@/hooks/usePermission'
import KpiExcelPreviewModal from '../components/KpiExcelPreviewModal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const frequencyMap: Record<string, string> = {
  DAILY: 'Hàng ngày', WEEKLY: 'Hàng tuần', MONTHLY: 'Hàng tháng', QUARTERLY: 'Hàng quý', YEARLY: 'Hàng năm',
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  DRAFT: { label: 'Bản nháp', color: 'text-slate-600 dark:text-slate-400', bgColor: 'bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700', icon: AlertCircle },
  PENDING_APPROVAL: { label: 'Chờ duyệt', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:border-amber-900/40', icon: Calendar },
  APPROVED: { label: 'Đã duyệt', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-900/40', icon: CheckCircle2 },
  REJECTED: { label: 'Từ chối', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 border-red-200 dark:bg-red-900/30 dark:border-red-900/40', icon: XCircle },
  EDIT: { label: 'Đang sửa', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 border-purple-200 dark:bg-purple-900/30 dark:border-purple-900/40', icon: AlertCircle },
  EDITED: { label: 'Đã sửa', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 border-blue-200 dark:bg-blue-900/30 dark:border-blue-900/40', icon: CheckCircle2 },
}

function useOnClickOutside(ref: any, handler: any) {
  useEffect(() => {
    const listener = (event: any) => {
      if (!ref.current || ref.current.contains(event.target)) return
      handler(event)
    }
    document.addEventListener('mousedown', listener)
    document.addEventListener('touchstart', listener)
    return () => {
      document.removeEventListener('mousedown', listener)
      document.removeEventListener('touchstart', listener)
    }
  }, [ref, handler])
}

export default function KpiCriteriaPage() {
  const [showForm, setShowForm] = useState(false)
  const [editKpi, setEditKpi] = useState<KpiCriteria | null>(null)
  const [deleteKpi, setDeleteKpi] = useState<KpiCriteria | null>(null)
  const [submitKpiId, setSubmitKpiId] = useState<string | null>(null)
  const [selectedKpi, setSelectedKpi] = useState<KpiCriteria | null>(null)
  
  const [activeTab, setActiveTab] = useState<'ALL' | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'>('ALL')
  const [search, setSearch] = useState('')
  const [showImportGuide, setShowImportGuide] = useState(false)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('ALL')
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState<string>('')
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARD'>('TABLE')
  const [page, setPage] = useState(0)
  const [pageSize] = useState(10)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  
  const [importFile, setImportFile] = useState<File | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  
  const fileRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()
  const { hasPermission } = usePermission()
  const canManageOrg = hasPermission('ORG:VIEW')

  const user = useAuthStore(s => s.user)
  const { data: periodsData } = useKpiPeriods({ organizationId: user?.memberships?.[0]?.organizationId })
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

  const { data, isLoading } = useKpiCriteria(
    { 
      page,
      size: pageSize, 
      createdById: user?.id,
      kpiPeriodId: selectedPeriodId === 'ALL' ? undefined : selectedPeriodId,
      orgUnitId: selectedOrgUnitId === 'ALL' ? undefined : selectedOrgUnitId,
      organizationId: user?.memberships?.[0]?.organizationId,
      status: activeTab === 'ALL' ? undefined : activeTab as any,
      keyword: search,
      sortBy,
      sortDir
    },
    { enabled: !!user?.id }
  )

  const { data: totalWeightData } = useKpiTotalWeight(
    selectedOrgUnitId === 'ALL' ? undefined : selectedOrgUnitId,
    selectedPeriodId === 'ALL' ? '' : selectedPeriodId
  )
  const deleteMutation = useDeleteKpi()
  const submitMutation = useSubmitKpi()

  const importMutation = useMutation({
    mutationFn: (file: File) => kpiApi.importFile(file, selectedPeriodId === 'ALL' ? undefined : selectedPeriodId, selectedOrgUnitId === 'ALL' ? undefined : selectedOrgUnitId),
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
  const filteredKpis = data?.content || []

  const displayTotalWeight = totalWeightData ?? 0

  const stats = {
    total: data?.totalElements || 0,
    draft: (data?.content || []).filter((k: KpiCriteria) => k.status === 'DRAFT').length,
    pending: (data?.content || []).filter((k: KpiCriteria) => k.status === 'PENDING_APPROVAL').length,
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50">
      <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
        
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
                    Quản lý <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">KPI</span>
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-lg max-w-xl leading-relaxed">
                    Thiết lập chiến lược, phân bổ trọng số và kiến tạo thành công cho đội ngũ của bạn.
                  </p>
                </div>
              </div>

              <div className="flex items-stretch gap-4">
                <div className="flex bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-md rounded-[28px] border border-slate-200/60 dark:border-slate-700/60 p-2 shadow-inner group/stats">
                  <div className="px-8 py-3 text-center border-r border-slate-200 dark:border-slate-700 group-hover/stats:scale-105 transition-transform duration-500">
                    <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{stats.total}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Tổng chỉ tiêu</p>
                  </div>
                  <div className="px-8 py-3 text-center group-hover/stats:scale-105 transition-transform duration-500">
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
        {selectedPeriodId !== 'ALL' && allKpis.length > 0 && displayTotalWeight !== 100 && (
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
          <div className="flex flex-col xl:flex-row items-stretch justify-between gap-4 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex flex-col md:flex-row items-center gap-3 flex-1">
              <div className="relative group flex-1 w-full md:max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input 
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(0) }}
                  placeholder="Tìm KPI, nhân viên..." 
                  className="w-full pl-12 pr-4 py-3.5 rounded-[20px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <Select value={selectedPeriodId} onValueChange={val => { setSelectedPeriodId(val); setPage(0) }}>
                  <SelectTrigger className="flex-1 md:w-48 h-[52px] rounded-[20px] border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 font-bold text-sm">
                    <Calendar size={16} className="text-slate-400 mr-2" />
                    <SelectValue placeholder="Đợt KPI..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2">
                    <SelectItem value="ALL" className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-xs font-black uppercase">Tất cả các đợt</SelectItem>
                    {periodsData?.content.map(p => (
                      <SelectItem key={p.id} value={p.id} className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-sm font-bold">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {canManageOrg && flatOrgUnits.length > 0 && (
                  <Select value={selectedOrgUnitId} onValueChange={val => { setSelectedOrgUnitId(val); setPage(0) }}>
                    <SelectTrigger className="flex-1 md:w-56 h-[52px] rounded-[20px] border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 font-bold text-sm">
                      <Filter size={16} className="text-slate-400 mr-2" />
                      <SelectValue placeholder="Phòng ban..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2 max-h-[400px]">
                      {flatOrgUnits.map((o: any) => (
                        <SelectItem key={o.id} value={o.id} className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-sm font-medium">{o.levelLabel}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
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

              <button 
                onClick={() => setShowImportGuide(true)}
                className="flex items-center gap-2 px-5 h-[52px] rounded-[20px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-black text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 shadow-sm"
              >
                <Upload size={18} /> Import
              </button>
              
              <button 
                onClick={() => { setEditKpi(null); setShowForm(true) }} 
                className="flex items-center gap-2 px-8 h-[52px] rounded-[20px] bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 group"
              >
                <Plus size={20} className="group-hover:rotate-90 transition-transform duration-500" /> Tạo mới
              </button>
            </div>
          </div>

          {/* Status Tabs Row */}
          <div className="flex flex-wrap items-center gap-3 py-2">
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
                    "px-7 py-3 rounded-full text-[11px] font-black uppercase tracking-[0.15em] transition-all duration-300 border-2 shadow-sm whitespace-nowrap",
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
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[32px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Trạng thái</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">
                        <button onClick={() => { setSortBy('name'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc') }} className="flex items-center gap-2 hover:text-indigo-600 transition-colors group">
                          Chỉ tiêu <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Giao cho</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right whitespace-nowrap">Mục tiêu</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Trọng số / Tần suất</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right whitespace-nowrap">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {filteredKpis.map((kpi: KpiCriteria, i: number) => (
                      <KpiTableRow 
                        key={kpi.id} 
                        kpi={kpi} 
                        index={i}
                        onView={() => setSelectedKpi(kpi)}
                        onEdit={() => { setEditKpi(kpi); setShowForm(true) }}
                        onDelete={() => setDeleteKpi(kpi)}
                        onSubmit={() => setSubmitKpiId(kpi.id)}
                        totalWeight={displayTotalWeight}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredKpis.map((kpi: KpiCriteria, idx: number) => (
                <KpiCard 
                  key={kpi.id} 
                  kpi={kpi} 
                  delay={idx * 50}
                  onView={() => setSelectedKpi(kpi)}
                  onEdit={() => { setEditKpi(kpi); setShowForm(true) }}
                  onDelete={() => setDeleteKpi(kpi)}
                  onSubmit={() => setSubmitKpiId(kpi.id)}
                  totalWeight={displayTotalWeight}
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
        <KpiFormModal open={showForm} onClose={() => { setShowForm(false); setEditKpi(null) }} editKpi={editKpi} />
        <KpiImportGuideModal 
          open={showImportGuide} 
          onClose={() => setShowImportGuide(false)} 
          onSelectFile={() => fileRef.current?.click()} 
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
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
        <KpiExcelPreviewModal 
          open={showPreview}
          file={importFile}
          onClose={() => { setShowPreview(false); setImportFile(null) }}
          isImporting={importMutation.isPending}
          onImport={(file) => importMutation.mutate(file, { onSuccess: () => { setShowPreview(false); setImportFile(null) } })}
        />
      </div>
    </div>
  )
}

function KpiTableRow({ kpi, index, onView, onEdit, onDelete, onSubmit, totalWeight }: { 
  kpi: KpiCriteria; index: number; onView: () => void; onEdit: () => void; onDelete: () => void; onSubmit: () => void; totalWeight: number 
}) {
  const status = statusConfig[kpi.status] ?? statusConfig['DRAFT']!
  const StatusIcon = status.icon
  
  return (
    <tr className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all duration-300 animate-in fade-in slide-in-from-left-4" style={{ animationDelay: `${index * 30}ms` }}>
      <td className="px-8 py-5">
        <div className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest shadow-sm whitespace-nowrap",
          status.bgColor, status.color
        )}>
          <StatusIcon size={12} className={kpi.status === 'PENDING_APPROVAL' ? 'animate-spin-slow' : ''} /> {status.label}
        </div>
      </td>
      <td className="px-8 py-5">
        <button onClick={onView} className="max-w-md text-left group/name focus:outline-none">
          <p className="text-sm font-black text-slate-900 dark:text-white group-hover/name:text-indigo-600 transition-colors line-clamp-1">
            {kpi.name}
          </p>
          <p className="text-xs text-slate-400 font-medium line-clamp-1 mt-1 group-hover/name:text-slate-500 transition-colors">
            {kpi.description || 'Không có mô tả chi tiết'}
          </p>
        </button>
      </td>
      <td className="px-8 py-5">
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-xl w-fit border border-slate-100 dark:border-slate-800 shadow-sm whitespace-nowrap">
          <UserCircle2 size={14} className="text-slate-400" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
            {formatAssigneeNames(kpi.assigneeNames)}
          </span>
        </div>
      </td>
      <td className="px-8 py-5 text-right whitespace-nowrap">
        <div className="flex items-baseline justify-end gap-1">
          <span className="text-sm font-black text-slate-900 dark:text-white">
            {formatNumber(kpi.targetValue || 0)}
          </span>
          <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400">{kpi.unit}</span>
        </div>
      </td>
      <td className="px-8 py-5 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100/50 dark:border-indigo-800/50 flex items-center gap-2 whitespace-nowrap">
            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{kpi.weight}%</span>
          </div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-1.5 rounded-lg whitespace-nowrap">
            {frequencyMap[kpi.frequency] || kpi.frequency}
          </div>
        </div>
      </td>

      <td className="px-8 py-5 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <button onClick={onView} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700" title="Chi tiết">
            <Eye size={18} />
          </button>
          {(kpi.status === 'DRAFT' || kpi.status === 'REJECTED') && (
            <>
              <button 
                onClick={onSubmit} 
                className={cn(
                  "p-2.5 rounded-xl transition-all shadow-sm border border-transparent",
                  totalWeight === 100 ? 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-200' : 'text-slate-200 cursor-not-allowed opacity-30'
                )}
                title={totalWeight === 100 ? "Gửi duyệt" : "Trọng số chưa đạt 100%"}
              >
                <Send size={18} />
              </button>
              <button onClick={onEdit} className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm border border-transparent hover:border-indigo-200" title="Sửa">
                <Pencil size={18} />
              </button>
              <button onClick={onDelete} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all shadow-sm border border-transparent hover:border-rose-200" title="Xóa">
                <Trash2 size={18} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

function KpiCard({ kpi, delay, onView, onEdit, onDelete, onSubmit, totalWeight }: { 
  kpi: KpiCriteria; delay: number; onView: () => void; onEdit: () => void; onDelete: () => void; onSubmit: () => void; totalWeight: number
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useOnClickOutside(menuRef, () => setMenuOpen(false))

  const status = statusConfig[kpi.status] ?? statusConfig['DRAFT']!
  const StatusIcon = status.icon

  return (
    <div 
      className="group relative bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 animate-in fade-in slide-in-from-bottom-8 flex flex-col overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
      
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 relative">
        <div className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest shadow-sm",
          status.bgColor, status.color
        )}>
          <StatusIcon size={12} /> {status.label}
        </div>
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 transition-all border border-transparent hover:border-slate-200"
          >
            <MoreVertical size={20} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden z-20 animate-in zoom-in-95 duration-200">
              <div className="p-1.5 space-y-0.5">
                <button 
                  onClick={() => { setMenuOpen(false); onView() }} 
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <Eye size={18} className="text-slate-400" /> Chi tiết
                </button>
                {(kpi.status === 'DRAFT' || kpi.status === 'REJECTED') && (
                  <>
                    <button 
                      onClick={() => { 
                        if (totalWeight === 100) {
                          setMenuOpen(false); 
                          onSubmit() 
                        } else {
                          toast.error(`Trọng số hiện là ${totalWeight}%, cần đạt 100% để nộp.`)
                        }
                      }} 
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors",
                        totalWeight === 100 ? 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30' : 'text-slate-400 cursor-not-allowed opacity-50'
                      )}
                    >
                      <Send size={18} /> Gửi phê duyệt
                    </button>
                    <button 
                      onClick={() => { setMenuOpen(false); onEdit() }} 
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Pencil size={18} className="text-slate-400" /> Chỉnh sửa
                    </button>
                    <button 
                      onClick={() => { setMenuOpen(false); onDelete() }} 
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                    >
                      <Trash2 size={18} /> Xóa vĩnh viễn
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-7 flex-1 space-y-6 relative">
        <button onClick={onView} className="text-left w-full group/title">
          <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight group-hover/title:text-indigo-600 transition-colors line-clamp-2">
            {kpi.name}
          </h3>
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
            {frequencyMap[kpi.frequency] || kpi.frequency}
          </span>
        </div>
      </div>
    </div>
  )
}
