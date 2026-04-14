import { useState, useRef, useEffect } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import KpiFormModal from '../components/KpiFormModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useKpiCriteria } from '../hooks/useKpiCriteria'
import { useSubmitKpi } from '../hooks/useSubmitKpi'
import { useDeleteKpi } from '../hooks/useDeleteKpi'
import { formatDateTime, formatNumber } from '@/lib/utils'
import type { KpiCriteria } from '@/types/kpi'
import {
  Target, Plus, Send, Pencil, Trash2, MoreVertical,
  Calendar, CheckCircle2, AlertCircle, XCircle, Search, 
  Filter, UserCircle2
} from 'lucide-react'

const frequencyMap: Record<string, string> = {
  DAILY: 'Hàng ngày', WEEKLY: 'Hàng tuần', MONTHLY: 'Hàng tháng', QUARTERLY: 'Hàng quý', YEARLY: 'Hàng năm',
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  DRAFT: { label: 'Bản nháp', color: 'text-slate-600 dark:text-slate-400', bgColor: 'bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700', icon: AlertCircle },
  PENDING: { label: 'Chờ duyệt', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:border-amber-900/40', icon: Calendar },
  APPROVED: { label: 'Đã duyệt', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-900/40', icon: CheckCircle2 },
  REJECTED: { label: 'Từ chối', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 border-red-200 dark:bg-red-900/30 dark:border-red-900/40', icon: XCircle },
}

// Hook to handle click outside for dropdowns
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
  
  const [activeTab, setActiveTab] = useState<'ALL' | 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useKpiCriteria({ size: 100 })
  const deleteMutation = useDeleteKpi()
  const submitMutation = useSubmitKpi()

  const allKpis = data?.content || []
  const filteredKpis = allKpis.filter(k => 
    (activeTab === 'ALL' || k.status === activeTab) &&
    (k.name.toLowerCase().includes(search.toLowerCase()) || (k.assignedToName && k.assignedToName.toLowerCase().includes(search.toLowerCase())))
  )

  const stats = {
    total: allKpis.length,
    draft: allKpis.filter(k => k.status === 'DRAFT').length,
    pending: allKpis.filter(k => k.status === 'PENDING').length,
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
            Danh sách KPI Phòng ban
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
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.pending}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chờ duyệt</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search & Filter */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm theo tên KPI hoặc nhân viên..." 
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all"
            />
          </div>
          <button className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-indigo-600 shrink-0">
            <Filter size={18} />
          </button>
        </div>

        {/* Create Button */}
        <button 
          onClick={() => { setEditKpi(null); setShowForm(true) }} 
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 w-full sm:w-auto justify-center"
        >
          <Plus size={18} /> Tạo Chỉ tiêu mới
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {['ALL', 'DRAFT', 'PENDING', 'APPROVED', 'REJECTED'].map((tab) => {
          const tabLabels: Record<string, string> = { ALL: 'Tất cả trạng thái', DRAFT: 'Bản nháp', PENDING: 'Đang đợi duyệt', APPROVED: 'Đã phê duyệt', REJECTED: 'Bị từ chối' }
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

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton type="table" rows={6} />
      ) : filteredKpis.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-dashed border-slate-300 dark:border-slate-800 p-16">
          <EmptyState 
            title="Không tìm thấy chỉ tiêu" 
            description={search || activeTab !== 'ALL' ? 'Hãy thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.' : 'Phòng ban chưa có chỉ tiêu KPI nào được thiết lập.'} 
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredKpis.map((kpi, idx) => (
            <KpiCard 
              key={kpi.id} 
              kpi={kpi} 
              delay={idx * 50}
              onEdit={() => { setEditKpi(kpi); setShowForm(true) }}
              onDelete={() => setDeleteKpi(kpi)}
              onSubmit={() => setSubmitKpiId(kpi.id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <KpiFormModal open={showForm} onClose={() => { setShowForm(false); setEditKpi(null) }} editKpi={editKpi} />
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
    </div>
  )
}

function KpiCard({ kpi, delay, onEdit, onDelete, onSubmit }: { 
  kpi: KpiCriteria; delay: number; onEdit: () => void; onDelete: () => void; onSubmit: () => void 
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
      {/* Card Header & Status */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${status.bgColor} ${status.color}`}>
          <StatusIcon size={12} /> {status.label}
        </div>
        
        {/* 3-Dots Dropdown Menu */}
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
                {kpi.status === 'DRAFT' && (
                  <>
                    <button 
                      onClick={() => { setMenuOpen(false); onSubmit() }} 
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold text-blue-600 bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      <Send size={16} /> Gửi duyệt
                    </button>
                    <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2" />
                    <button 
                      onClick={() => { setMenuOpen(false); onEdit() }} 
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <Pencil size={16} /> Chỉnh sửa
                    </button>
                  </>
                )}
                <button 
                  onClick={() => { setMenuOpen(false); onDelete() }} 
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 bg-transparent hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                >
                  <Trash2 size={16} /> Xóa chỉ tiêu
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI Info */}
      <div className="p-6 flex-1 space-y-5">
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors line-clamp-2">
            {kpi.name}
          </h3>
          <p className="text-sm font-medium text-slate-500 mt-1.5 line-clamp-2">
            {kpi.description || 'Không có mô tả chi tiết'}
          </p>
        </div>

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

      {/* Footer Info */}
      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/20 rounded-b-[28px] border-t border-slate-100 dark:border-slate-800 flex items-center justify-between mt-auto">
        <div className="flex items-center gap-2 max-w-[60%]">
          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
            <UserCircle2 size={12} className="text-slate-500" />
          </div>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
            {kpi.assignedToName ?? 'Chưa giao'}
          </span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {formatDateTime(kpi.createdAt).split(' ')[0]}
        </span>
      </div>
    </div>
  )
}
