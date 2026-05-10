import { useState, useMemo } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import StatusBadge from '@/components/common/StatusBadge'
import { useMySubmissions } from '../hooks/useMySubmissions'
import { Link, useNavigate } from 'react-router-dom'
import { formatDateTime, formatNumber, cn } from '@/lib/utils'
import type { SubmissionStatus } from '@/types/submission'
import {
  FileText, Plus, Search, ChevronRight, ArrowUpDown, ChevronLeft, Filter, 
  Clock, CheckCircle2, XCircle, Pencil, Send, Loader2, ShieldAlert, Sparkles
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import { toast } from 'sonner'
import { useMyKpi } from '@/features/kpi/hooks/useMyKpi'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type TabKey = SubmissionStatus | ''

const TABS: { key: TabKey; label: string; icon: any; color: string }[] = [
  { key: 'PENDING', label: 'Chờ duyệt', icon: Clock, color: 'amber' },
  { key: 'APPROVED', label: 'Đã duyệt', icon: CheckCircle2, color: 'emerald' },
  { key: 'REJECTED', label: 'Từ chối', icon: XCircle, color: 'red' },
  { key: '', label: 'Tất cả', icon: Filter, color: 'slate' },
]

export default function MySubmissionsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize] = useState(10)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [finishedPeriodId, setFinishedPeriodId] = useState<string | null>(null)
  
  const navigate = useNavigate()
  const qc = useQueryClient()
  
  const { data: myKpiData } = useMyKpi({ page: 0, size: 500 })

  const { data, isLoading } = useMySubmissions({
    status: activeTab || undefined,
    page,
    size: pageSize,
    sortBy,
    sortDir
  })

  const handleSortSelect = (value: string) => {
    const parts = value.split(':')
    if (parts.length === 2) {
      setSortBy(parts[0]!)
      setSortDir(parts[1]! as 'asc' | 'desc')
      setPage(0)
    }
  }

  const submitMutation = useMutation({
    mutationFn: (id: string) => submissionApi.update(id, { isDraft: false }),
    onSuccess: (_, submissionId) => {
      qc.invalidateQueries({ queryKey: ['submissions'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      
      // Check if this was the last submission for the period
      const sub = allItems.find(s => s.id === submissionId)
      if (sub && myKpiData?.content) {
        const periodId = sub.kpiPeriod?.id
        const periodKpis = myKpiData.content.filter(k => k.kpiPeriodId === periodId) || []
        
        const isAllFinished = periodKpis.every(k => {
          const isCurrentKpi = k.id === sub.kpiCriteriaId
          const currentCount = isCurrentKpi ? k.submissionCount + 1 : k.submissionCount
          return currentCount >= k.expectedSubmissions
        })

        if (isAllFinished) {
          setFinishedPeriodId(periodId || null)
          setShowSuccess(true)
        } else {
          toast.success('Gửi duyệt thành công!')
        }
      } else {
        toast.success('Gửi duyệt thành công!')
      }
    },
    onError: () => toast.error('Gửi duyệt thất bại')
  })

  const allItems = data?.content ?? []
  const filteredItems = allItems.filter(s => 
    s.kpiCriteriaName.toLowerCase().includes(search.toLowerCase())
  )

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
    setPage(0)
  }

  // Quick stats
  const { data: allData } = useMySubmissions({ size: 1000 })
  const stats = useMemo(() => {
    const all = allData?.content ?? []
    return {
      total: all.length,
      approved: all.filter(s => s.status === 'APPROVED').length,
      pending: all.filter(s => s.status === 'PENDING').length,
    }
  }, [allData])

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6 space-y-6 animate-in fade-in duration-500 transition-all duration-500 ease-in-out">
      
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <FileText size={20} />
            <span className="text-xs font-black uppercase tracking-[2px]">Quản lý báo cáo</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Bài nộp của tôi
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <StatMini label="Tổng nộp" value={stats.total} color="indigo" />
          <StatMini label="Đã duyệt" value={stats.approved} color="emerald" />
          <StatMini label="Chờ duyệt" value={stats.pending} color="amber" />
          
          <Link 
            to="/submissions/new" 
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-sm font-black hover:bg-indigo-600 dark:hover:bg-indigo-50 transition-all shadow-md active:scale-95 ml-2"
          >
            <Plus size={18} /> NỘP MỚI
          </Link>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-col gap-5 bg-white dark:bg-slate-900 p-5 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm transition-all">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
          <div className="relative w-full md:max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
            <input 
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              placeholder="Tìm theo tên KPI..." 
              className="w-full pl-11 pr-4 h-12 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-4 shrink-0 w-full md:w-auto">
            <Select value={`${sortBy}:${sortDir}`} onValueChange={handleSortSelect}>
              <SelectTrigger className="w-full md:w-[200px] h-12 rounded-2xl bg-slate-50/50 dark:bg-slate-800 border-none text-[10px] font-black uppercase tracking-[0.15em] shadow-sm">
                <div className="flex items-center gap-2">
                  <ArrowUpDown size={14} className="text-slate-400" />
                  <SelectValue placeholder="Sắp xếp" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2">
                <SelectItem value="createdAt:desc" className="text-[10px] font-black uppercase tracking-widest rounded-xl focus:bg-indigo-50">Mới nhất</SelectItem>
                <SelectItem value="createdAt:asc" className="text-[10px] font-black uppercase tracking-widest rounded-xl focus:bg-indigo-50">Cũ nhất</SelectItem>
                <SelectItem value="kpiCriteriaName:asc" className="text-[10px] font-black uppercase tracking-widest rounded-xl focus:bg-indigo-50">Tên KPI (A-Z)</SelectItem>
                <SelectItem value="kpiCriteriaName:desc" className="text-[10px] font-black uppercase tracking-widest rounded-xl focus:bg-indigo-50">Tên KPI (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div id="tour-my-sub-tabs" className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(0) }}
              className={cn(
                "px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all duration-300 whitespace-nowrap flex items-center gap-2",
                activeTab === tab.key
                  ? "bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900 shadow-xl scale-105"
                  : "bg-white/50 border-transparent text-slate-500 hover:bg-white hover:border-slate-200 dark:bg-slate-900/50 dark:hover:bg-slate-800 dark:text-slate-400"
              )}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div id="tour-my-sub-list" className="min-h-[400px]">
        {isLoading ? (
          <LoadingSkeleton type="table" rows={10} />
        ) : filteredItems.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-20 shadow-sm transition-all">
            <EmptyState
              title="Không có bài nộp nào"
              description="Hãy thử thay đổi bộ lọc hoặc nộp báo cáo mới để bắt đầu theo dõi hiệu suất."
            />
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-all">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Trạng thái</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <button onClick={() => handleSort('kpiCriteriaName')} className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                      KPI / Chỉ tiêu <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Kết quả</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <button onClick={() => handleSort('createdAt')} className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                      Thời gian <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.map((sub) => (
                  <tr 
                    key={sub.id} 
                    className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all"
                  >
                    <td className="px-6 py-4">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-md">
                        <Link 
                          to={`/submissions/${sub.id}`}
                          className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors truncate block"
                        >
                          {sub.kpiCriteriaName}
                        </Link>
                        {sub.note && <p className="text-[10px] text-slate-400 mt-1 line-clamp-1 italic">"{sub.note}"</p>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-3">
                           <span className="text-xs font-black text-slate-900 dark:text-white">
                            {formatNumber(sub.actualValue)}
                          </span>
                          <ProgressCircle 
                            percentage={sub.targetValue ? Math.min(Math.round((sub.actualValue / sub.targetValue) * 100), 100) : (sub.actualValue <= 100 ? sub.actualValue : 0)} 
                            size={28} 
                            strokeWidth={3} 
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-500">
                        {formatDateTime(sub.createdAt).split(' ')[0]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {sub.status === 'DRAFT' && (
                          <button 
                            onClick={() => {
                              setPendingId(sub.id)
                              setShowConfirm(true)
                            }}
                            disabled={submitMutation.isPending}
                            className="p-2 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg hover:bg-emerald-100 transition-all disabled:opacity-50"
                            title="Gửi duyệt"
                          >
                            {submitMutation.isPending && submitMutation.variables === sub.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                          </button>
                        )}
                        {sub.status === 'DRAFT' && (
                          <Link 
                            to={`/submissions/edit/${sub.id}`}
                            className="p-2 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 transition-all"
                            title="Chỉnh sửa"
                          >
                            <Pencil size={14} />
                          </Link>
                        )}
                        <Link 
                          to={`/submissions/${sub.id}`}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                          title="Xem chi tiết"
                        >
                          <ChevronRight size={18} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Trang {page + 1} / {data?.totalPages || 1} 
              <span className="mx-2 text-slate-300">•</span>
              {data?.totalElements || 0} bài nộp
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:bg-slate-50 transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= (data?.totalPages || 1) - 1}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:bg-slate-50 transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Confirmation Modal - Premium Dangerous Style */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-500">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-[48px] border border-rose-200 dark:border-rose-900/30 shadow-[0_32px_64px_-16px_rgba(244,63,94,0.3)] max-w-md w-full overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
            {/* Top Danger Bar */}
            <div className="h-2 bg-gradient-to-r from-rose-500 via-orange-500 to-rose-500" />
            
            <div className="p-10 text-center space-y-8">
              <div className="relative">
                <div className="absolute inset-0 bg-rose-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
                <div className="relative w-24 h-24 bg-gradient-to-br from-rose-500 to-rose-600 rounded-[32px] flex items-center justify-center mx-auto shadow-2xl shadow-rose-500/40 rotate-3">
                  <ShieldAlert className="w-12 h-12 text-white" />
                </div>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Gửi báo cáo này?</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed">
                  Bản nháp này sẽ được gửi trực tiếp đến quản lý. <br/>
                  <span className="text-rose-500 font-bold">Lưu ý:</span> Bạn sẽ không thể chỉnh sửa sau khi đã gửi đi.
                </p>
              </div>

              <div className="flex flex-col gap-4 pt-4">
                <button
                  onClick={() => {
                    if (pendingId) {
                      submitMutation.mutate(pendingId)
                      setShowConfirm(false)
                    }
                  }}
                  className="w-full py-5 bg-gradient-to-r from-rose-600 to-rose-500 text-white rounded-2xl font-black text-sm shadow-2xl shadow-rose-500/40 hover:shadow-rose-500/60 hover:-translate-y-1 transition-all active:scale-95 uppercase tracking-widest"
                >
                  XÁC NHẬN GỬI DUYỆT
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="w-full py-5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all uppercase tracking-widest"
                >
                  HỦY BỎ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal - Smart Flow */}
      {showSuccess && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-500">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl" />
          <div className="relative bg-white dark:bg-slate-900 rounded-[48px] border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-12 text-center space-y-10 animate-in zoom-in-95 duration-500">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
              <div className="relative w-28 h-28 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-[40px] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/40">
                <CheckCircle2 className="w-14 h-14 text-white" />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Hoàn tất chu kỳ KPI</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Chúc mừng! Bạn đã hoàn thành đầy đủ các báo cáo chỉ tiêu trong đợt này. Đây là thời điểm lý tưởng để nhìn lại và thực hiện bản **Tự đánh giá** năng lực.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <button
                onClick={() => navigate(`/evaluations?action=self-eval&periodId=${finishedPeriodId}`)}
                className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-sm shadow-2xl hover:bg-indigo-600 dark:hover:bg-indigo-50 transition-all flex items-center justify-center gap-3 uppercase tracking-widest active:scale-95"
              >
                <Sparkles size={20} className="text-amber-400" /> TIẾN HÀNH TỰ ĐÁNH GIÁ
              </button>
              <button
                onClick={() => setShowSuccess(false)}
                className="w-full py-5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all uppercase tracking-widest"
              >
                ĐỂ SAU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatMini({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    indigo: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30',
  }
  return (
    <div className={cn("px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3", colorMap[color])}>
      <span className="text-xl font-black">{value}</span>
      <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{label}</span>
    </div>
  )
}

function ProgressCircle({ percentage, size = 32, strokeWidth = 3 }: { 
  percentage: number; 
  size?: number; 
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference
  
  const getColor = () => {
    if (percentage >= 100) return 'text-emerald-500'
    if (percentage >= 70) return 'text-indigo-500'
    if (percentage >= 40) return 'text-blue-500'
    if (percentage > 0) return 'text-amber-500'
    return 'text-slate-200 dark:text-slate-700'
  }

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="text-slate-100 dark:text-slate-800"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={cn(getColor(), "transition-all duration-700 ease-out")}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <span className="absolute text-[7px] font-black text-slate-700 dark:text-slate-300">
        {Math.round(percentage)}%
      </span>
    </div>
  )
}
