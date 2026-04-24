import { useState, useRef, useEffect, useMemo } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import KpiFormModal from '../components/KpiFormModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useKpiCriteria } from '../hooks/useKpiCriteria'
import { useAuthStore } from '@/store/authStore'
import { useSubmitKpi } from '../hooks/useSubmitKpi'
import { useDeleteKpi } from '../hooks/useDeleteKpi'
import { formatDateTime, formatNumber, formatAssigneeNames } from '@/lib/utils'
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

const frequencyMap: Record<string, string> = {
  DAILY: 'Hàng ngày', WEEKLY: 'Hàng tuần', MONTHLY: 'Hàng tháng', QUARTERLY: 'Hàng quý', YEARLY: 'Hàng năm',
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  DRAFT: { label: 'Bản nháp', color: 'text-slate-600 dark:text-slate-400', bgColor: 'bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700', icon: AlertCircle },
  PENDING_APPROVAL: { label: 'Chờ duyệt', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:border-amber-900/40', icon: Calendar },
  APPROVED: { label: 'Đã duyệt', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-900/40', icon: CheckCircle2 },
  REJECTED: { label: 'Từ chối', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 border-red-200 dark:bg-red-900/30 dark:border-red-900/40', icon: XCircle },
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
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('')
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState<string>('')
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARD'>('TABLE')
  const [page, setPage] = useState(0)
  const [pageSize] = useState(5)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  
  const fileRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const user = useAuthStore(s => s.user)
  const { data: periodsData } = useKpiPeriods({ organizationId: user?.memberships?.[0]?.organizationId })
  const { data: orgUnitTreeData } = useOrgUnitTree()
  
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
  
  // Default to root Org Unit on load if not set
  useEffect(() => {
    if (flatOrgUnits.length > 0 && !selectedOrgUnitId) {
      // Find user's primary org unit if possible, otherwise first one (Root)
      const primaryOrgUnitId = user?.memberships?.[0]?.orgUnitId
      const existsInList = flatOrgUnits.some(o => o.id === primaryOrgUnitId)
      setSelectedOrgUnitId(existsInList ? primaryOrgUnitId! : flatOrgUnits[0].id)
    }
  }, [flatOrgUnits, user])

  const { data, isLoading } = useKpiCriteria(
    { 
      page,
      size: pageSize, 
      createdById: user?.id,
      kpiPeriodId: selectedPeriodId || undefined,
      orgUnitId: selectedOrgUnitId || undefined,
      sortBy,
      sortDir
    },
    { enabled: !!user?.id }
  )

  const { data: totalWeightData } = useKpiTotalWeight(
    selectedOrgUnitId || undefined,
    selectedPeriodId
  )
  const deleteMutation = useDeleteKpi()
  const submitMutation = useSubmitKpi()

  const importMutation = useMutation({
    mutationFn: (file: File) => kpiApi.importFile(file, selectedPeriodId, selectedOrgUnitId),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      toast.success(`Import thành công ${result.successfulImports}/${result.totalRows} dòng`)
      if (result.errors.length > 0) {
        result.errors.forEach((e) => toast.error(e))
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Import thất bại')
    },
  })

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      importMutation.mutate(file)
      e.target.value = ''
    }
  }

  const allKpis = data?.content || []
  const filteredKpis = allKpis.filter(k => 
    (activeTab === 'ALL' || k.status === activeTab) &&
    (k.name.toLowerCase().includes(search.toLowerCase()) || 
     (k.assigneeNames && k.assigneeNames.some(name => name.toLowerCase().includes(search.toLowerCase()))))
  )

  const displayTotalWeight = totalWeightData ?? 0

  const stats = {
    total: data?.totalElements || 0,
    draft: allKpis.filter(k => k.status === 'DRAFT').length, // This is still local, but user prioritized weight/total
    pending: allKpis.filter(k => k.status === 'PENDING_APPROVAL').length,
  }

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-black uppercase tracking-widest">
            <Target size={14} /> Quản lý Chỉ tiêu
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            Chỉ tiêu tôi đã tạo
          </h1>
          <p className="text-slate-500 font-medium max-w-lg">
            Thiết lập, phân bổ và theo dõi chi tiết các chỉ tiêu đánh giá hiệu suất.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex bg-slate-50 border border-slate-200 dark:bg-slate-900/50 dark:border-slate-800 rounded-2xl p-1.5 shadow-sm">
            <div className="px-5 py-2 text-center border-r border-slate-200 dark:border-slate-800">
              <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chỉ tiêu</p>
            </div>
            <div className="px-5 py-2 text-center">
              <p className={`text-2xl font-black flex items-center gap-2 justify-center ${
                displayTotalWeight === 100 ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                <Gauge size={20} className="shrink-0" />
                {displayTotalWeight}%
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trọng số</p>
            </div>
          </div>
        </div>
      </div>

      {/* Global Warning for Weight */}
      {selectedPeriodId && displayTotalWeight !== 100 && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 shadow-sm animate-in fade-in slide-in-from-top-2">
          <AlertCircle size={20} className="shrink-0" />
          <p className="text-sm font-bold">
            Tổng trọng số ({displayTotalWeight}%) chưa đạt hoặc vượt quá 100%. Bạn cần điều chỉnh để có thể gửi duyệt.
          </p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-6 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              placeholder="Tìm theo tên KPI hoặc nhân viên..." 
              className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-48">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={selectedPeriodId}
                onChange={e => { setSelectedPeriodId(e.target.value); setPage(0) }}
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none transition-all"
              >
                <option value="">Đợt KPI...</option>
                {periodsData?.content.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 md:w-48">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={selectedOrgUnitId}
                onChange={e => { setSelectedOrgUnitId(e.target.value); setPage(0) }}
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none transition-all"
              >
                {flatOrgUnits.map((o: any) => (
                  <option key={o.id} value={o.id}>{o.levelLabel}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 w-full xl:w-auto">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mr-2">
            <button 
              onClick={() => setViewMode('TABLE')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'TABLE' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400'}`}
              title="Xem dạng bảng"
            >
              <List size={20} />
            </button>
            <button 
              onClick={() => setViewMode('CARD')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'CARD' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400'}`}
              title="Xem dạng thẻ"
            >
              <LayoutGrid size={20} />
            </button>
          </div>

          <button 
            onClick={() => setShowImportGuide(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
          >
            <Upload size={16} />
            Import
          </button>
          
          <button 
            onClick={() => { setEditKpi(null); setShowForm(true) }} 
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            <Plus size={18} /> Tạo mới
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {['ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'].map((tab) => {
          const tabLabels: Record<string, string> = { ALL: 'Tất cả trạng thái', DRAFT: 'Bản nháp', PENDING_APPROVAL: 'Đang đợi duyệt', APPROVED: 'Đã phê duyệt', REJECTED: 'Bị từ chối' }
          const active = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all border ${
                active 
                  ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900 shadow-md' 
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800'
              }`}
            >
              {tabLabels[tab]}
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <LoadingSkeleton type="table" rows={8} />
      ) : filteredKpis.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 p-20 shadow-sm">
          <EmptyState 
            title="Không tìm thấy chỉ tiêu" 
            description={search || activeTab !== 'ALL' ? 'Hãy thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.' : 'Hệ thống chưa có chỉ tiêu KPI nào.'} 
          />
        </div>
      ) : viewMode === 'TABLE' ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">Trạng thái</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">
                    <button onClick={() => { setSortBy('name'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc') }} className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                      Chỉ tiêu <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">Giao cho</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">
                    <button onClick={() => { setSortBy('targetValue'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc') }} className="flex items-center gap-1 hover:text-indigo-600 transition-colors text-right w-full justify-end">
                      Mục tiêu <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">
                    <button onClick={() => { setSortBy('weight'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc') }} className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                      Trọng số <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredKpis.map((kpi) => (
                  <KpiTableRow 
                    key={kpi.id} 
                    kpi={kpi} 
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredKpis.map((kpi, idx) => (
            <KpiCard 
              key={kpi.id} 
              kpi={kpi} 
              delay={idx * 40}
              onView={() => setSelectedKpi(kpi)}
              onEdit={() => { setEditKpi(kpi); setShowForm(true) }}
              onDelete={() => setDeleteKpi(kpi)}
              onSubmit={() => setSubmitKpiId(kpi.id)}
              totalWeight={displayTotalWeight}
            />
          ))}
        </div>
      )}

      {data && data.totalElements > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-500">
            Hiển thị <span className="text-slate-900 dark:text-white">{page * pageSize + 1}</span> - <span className="text-slate-900 dark:text-white">{Math.min((page + 1) * pageSize, data.totalElements)}</span> của <span className="text-slate-900 dark:text-white">{data.totalElements}</span> chỉ tiêu
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p: number) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-1">
              {[...Array(data.totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`w-10 h-10 rounded-xl text-sm font-black transition-all ${
                    page === i 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPage((p: number) => Math.min(data.totalPages - 1, p + 1))}
              disabled={page === data.totalPages - 1}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}

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
        description="Gửi chỉ tiêu này lên hệ thống để Giám đốc phê duyệt?" 
        confirmLabel="Gửi duyệt" 
        loading={submitMutation.isPending} 
      />
      <ConfirmDialog 
        open={!!deleteKpi} 
        onClose={() => setDeleteKpi(null)} 
        onConfirm={() => deleteKpi && deleteMutation.mutate(deleteKpi.id, { onSuccess: () => setDeleteKpi(null) })} 
        title="Xoá chỉ tiêu" 
        description={`Bạn có chắc chắn muốn xoá chỉ tiêu "${deleteKpi?.name}" vĩnh viễn không?`} 
        confirmLabel="Xoá vĩnh viễn" 
        loading={deleteMutation.isPending} 
      />
      <KpiDetailModal 
        open={!!selectedKpi} 
        onClose={() => setSelectedKpi(null)} 
        kpi={selectedKpi} 
      />
       <input 
          ref={fileRef}
          type="file" 
          accept=".xlsx,.xls,.csv" 
          className="hidden" 
          onChange={handleImport} 
        />
    </div>
  )
}

function KpiTableRow({ kpi, onView, onEdit, onDelete, onSubmit, totalWeight }: { 
  kpi: KpiCriteria; onView: () => void; onEdit: () => void; onDelete: () => void; onSubmit: () => void; totalWeight: number 
}) {
  const status = statusConfig[kpi.status] ?? statusConfig['DRAFT']!
  const StatusIcon = status.icon
  
  return (
    <tr className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
      <td className="px-6 py-4">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${status.bgColor} ${status.color}`}>
          <StatusIcon size={10} /> {status.label}
        </div>
      </td>
      <td className="px-6 py-4">
        <button onClick={onView} className="max-w-md text-left group/name focus:outline-none">
          <p className="text-sm font-bold text-slate-900 dark:text-white group-hover/name:text-indigo-600 transition-colors truncate">
            {kpi.name}
          </p>
          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{kpi.description || '—'}</p>
        </button>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <UserCircle2 size={14} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {formatAssigneeNames(kpi.assigneeNames)}
          </span>
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <span className="text-sm font-black text-slate-900 dark:text-white">
          {formatNumber(kpi.targetValue || 0)} <span className="text-[10px] text-slate-400 font-medium ml-0.5">{kpi.unit}</span>
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md">
            {kpi.weight}%
          </span>
          <span className="text-[10px] text-slate-400 font-bold uppercase">{frequencyMap[kpi.frequency] || kpi.frequency}</span>
        </div>
      </td>

      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <button onClick={onView} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all" title="Xem chi tiết">
            <Eye size={16} />
          </button>
          {(kpi.status === 'DRAFT' || kpi.status === 'REJECTED') && (
            <>
              <button 
                onClick={onSubmit} 
                className={`p-2 rounded-lg transition-all ${totalWeight === 100 ? 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30' : 'text-slate-300 cursor-not-allowed'}`}
                title="Gửi duyệt"
              >
                <Send size={16} />
              </button>
              <button onClick={onEdit} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all" title="Sửa">
                <Pencil size={16} />
              </button>
              <button onClick={onDelete} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all" title="Xóa">
                <Trash2 size={16} />
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
      className="group bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-800 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 flex flex-col"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${status.bgColor} ${status.color}`}>
          <StatusIcon size={12} /> {status.label}
        </div>
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden z-20 animate-in zoom-in-95 fade-in duration-200">
              <div className="p-1.5">
                <button 
                  onClick={() => { setMenuOpen(false); onView() }} 
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <Eye size={16} /> Xem chi tiết
                </button>
                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2" />
                {(kpi.status === 'DRAFT' || kpi.status === 'REJECTED') && (
                  <>
                    <button 
                      onClick={() => { 
                        if (totalWeight === 100) {
                          setMenuOpen(false); 
                          onSubmit() 
                        } else {
                          toast.error(`Không thể gửi duyệt. Tổng trọng số của đợt này hiện là ${totalWeight}%, phải là 100% mới có thể nộp.`)
                        }
                      }} 
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                        totalWeight === 100 ? 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30' : 'text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Send size={16} /> Gửi duyệt {totalWeight !== 100 && <AlertCircle size={12} />}
                    </button>
                    <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2" />
                    <button 
                      onClick={() => { setMenuOpen(false); onEdit() }} 
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <Pencil size={16} /> Chỉnh sửa
                    </button>
                    <button 
                      onClick={() => { setMenuOpen(false); onDelete() }} 
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 bg-transparent hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <Trash2 size={16} /> Xóa chỉ tiêu
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="p-6 flex-1 space-y-5">
        <button onClick={onView} className="text-left w-full group/title focus:outline-none">
          <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover/title:text-indigo-600 transition-colors line-clamp-2">
            {kpi.name}
          </h3>
          <p className="text-sm font-medium text-slate-500 mt-1.5 line-clamp-2">
            {kpi.description || 'Không có mô tả chi tiết'}
          </p>
        </button>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Mục tiêu</p>
            <p className="text-base font-black text-slate-900 dark:text-white">
              {kpi.targetValue != null ? formatNumber(kpi.targetValue) : '—'} 
              <span className="text-sm font-medium text-slate-500 ml-1">{kpi.unit ?? ''}</span>
            </p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Trọng số / Tần suất</p>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              {kpi.weight != null ? (
                <span className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md">{kpi.weight}%</span>
              ) : '—'}
              <span className="text-slate-400">•</span>
              <span className="text-slate-600">{frequencyMap[kpi.frequency] ?? kpi.frequency}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/20 rounded-b-[28px] border-t border-slate-100 dark:border-slate-800 flex items-center justify-between mt-auto">
        <div className="flex items-center gap-2 max-w-[60%]">
          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
            <UserCircle2 size={12} className="text-slate-500" />
          </div>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
            {formatAssigneeNames(kpi.assigneeNames)}
          </span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {formatDateTime(kpi.createdAt).split(' ')[0]}
        </span>
      </div>
    </div>
  )
}
