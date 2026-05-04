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
  Users, ChevronRight, Calendar,
  Search, MessageSquare
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '../../../components/ui/checkbox'

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  PENDING: { label: 'Đợi xử lý', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50/50 border-amber-200/50 dark:bg-amber-900/20 dark:border-amber-900/30', icon: Clock },
  APPROVED: { label: 'Đã chấp thuận', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50/50 border-emerald-200/50 dark:bg-emerald-900/20 dark:border-emerald-900/30', icon: CheckCircle2 },
  REJECTED: { label: 'Đã từ chối', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50/50 border-red-200/50 dark:bg-red-900/20 dark:border-red-900/30', icon: XCircle },
}

export default function KpiAdjustmentApprovalPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as AdjustmentStatus | 'ALL') || 'PENDING'
  
  const [activeTab, setActiveTab] = useState<AdjustmentStatus | 'ALL'>(initialTab)
  
  const [selectedPeriodId, setSelectedPeriodId] = useState('ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize] = useState(10)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkNote, setBulkNote] = useState('')
  
  const user = useAuthStore(s => s.user)
  const { data: periodsData } = useKpiPeriods({ organizationId: user?.memberships?.[0]?.organizationId })
  
  const bulkReviewMutation = useBulkReviewAdjustments()

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && tab !== activeTab) {
      setActiveTab(tab as any)
      setSelectedIds([])
    }
  }, [searchParams])

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab)
    setSearchParams({ tab })
    setPage(0)
    setSelectedIds([])
  }

  // Data for Adjustment Requests
  const { data: adjustmentData, isLoading } = useKpiAdjustments(
    {
      page,
      size: pageSize,
      status: activeTab === 'ALL' ? undefined : activeTab,
      kpiPeriodId: selectedPeriodId === 'ALL' ? undefined : selectedPeriodId,
    }
  )

  const items = adjustmentData?.content ?? []
  const totalPages = adjustmentData?.totalPages || 1
  const totalElements = adjustmentData?.totalElements || 0

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }
  
  const toggleSelectAll = () => {
    const pendingItems = items.filter(i => i.status === 'PENDING')
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

  // Quick stats
  const { data: allAdjustmentsData } = useKpiAdjustments({ size: 1000 })
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
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
        
        {/* Header Section with Glass Card */}
        <div className="relative group">
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
                    Xét duyệt <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600">Điều chỉnh KPI</span>
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm max-w-xl leading-relaxed">
                    Xử lý các đề xuất thay đổi hoặc hủy bỏ chỉ tiêu từ nhân viên.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <StatChip label="Đợi xử lý" value={stats.pending} color="amber" />
                <StatChip label="Từ chối" value={stats.rejected} color="red" />
                <StatChip label="Chấp thuận" value={stats.approved} color="emerald" />
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0) }}
                placeholder="Tìm tên chỉ tiêu, người yêu cầu..." 
                className="w-full pl-12 pr-4 h-12 rounded-[18px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
              />
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
          </div>

          <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/50 dark:bg-slate-800/50 rounded-[20px] border border-slate-200 dark:border-slate-700 shadow-inner overflow-x-auto scrollbar-none">
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
                    "px-5 py-2.5 rounded-[14px] text-[10px] font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap",
                    active 
                      ? 'bg-white dark:bg-slate-700 shadow-md text-amber-600 dark:text-white scale-105' 
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  )}
                >
                  {labels[tab]}
                </button>
              )
            })}
          </div>
        </div>

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
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <th className="pl-6 py-5 w-10">
                      {items.some(i => i.status === 'PENDING') && (
                        <Checkbox 
                          checked={items.length > 0 && items.filter(i => i.status === 'PENDING').every(i => selectedIds.includes(i.id))}
                          onCheckedChange={toggleSelectAll}
                          className="border-slate-300"
                        />
                      )}
                    </th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Trạng thái</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Chỉ tiêu đề xuất</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Người yêu cầu</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Lý do điều chỉnh</th>
                    {(activeTab === 'APPROVED' || activeTab === 'REJECTED' || activeTab === 'ALL') && (
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Phản hồi của bạn</th>
                    )}
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {items.map((request, i) => {
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
                          {request.status === 'PENDING' && (
                            <Checkbox 
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(request.id)}
                              className="border-slate-300"
                            />
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <div className={cn(
                            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest shadow-sm whitespace-nowrap",
                            status.bgColor, status.color
                          )}>
                            <StatusIcon size={12} className={request.status === 'PENDING' ? 'animate-pulse' : ''} /> {status.label}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <button onClick={() => setReviewAdjustment(request)} className="text-left group/name focus:outline-none">
                            <p className="text-sm font-black text-slate-900 dark:text-white group-hover/name:text-amber-600 transition-colors line-clamp-1">
                              {request.kpiCriteriaName}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {request.deactivationRequest ? (
                                <span className="text-[9px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase">Huỷ bỏ KPI</span>
                              ) : (
                                <span className="text-[9px] font-black bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded uppercase">Điều chỉnh số liệu</span>
                              )}
                            </div>
                          </button>
                        </td>
                        <td className="px-6 py-5">
                           <div className="flex items-center gap-2">
                             <Users size={12} className="text-slate-400" />
                             <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{request.requesterName}</span>
                           </div>
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
            </div>
          </div>
        )}

        {/* Bulk Actions Bar */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-[24px] shadow-2xl flex items-center gap-5 animate-in slide-in-from-bottom-10 duration-500 border border-slate-700/50 dark:border-slate-200/50 backdrop-blur-xl">
             <div className="flex items-center gap-4 pr-5 border-r border-slate-700/50 dark:border-slate-200/50 whitespace-nowrap">
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
                 className="bg-slate-800 dark:bg-slate-50 text-[11px] font-bold px-4 py-2.5 rounded-xl border border-slate-700 dark:border-slate-200 outline-none focus:ring-2 focus:ring-amber-500/50 w-64 transition-all"
               />
             </div>

             <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleBulkReview('REJECTED')}
                  disabled={bulkReviewMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-all disabled:opacity-50 whitespace-nowrap"
                >
                   Từ chối
                </button>
                <button 
                  onClick={() => handleBulkReview('APPROVED')}
                  disabled={bulkReviewMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 whitespace-nowrap"
                >
                   Duyệt hàng loạt
                </button>
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
        </div>

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
      "flex flex-col items-center justify-center min-w-[100px] px-4 py-2.5 rounded-2xl border backdrop-blur-sm transition-all hover:scale-105 duration-300",
      colorMap[color]
    )}>
      <span className="text-xl font-black tracking-tighter">{value}</span>
      <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">{label}</span>
    </div>
  )
}
