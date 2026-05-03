import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import ReviewModal from '../components/ReviewModal'
import { useOrgUnitSubmissions } from '../hooks/useOrgUnitSubmissions'
import { formatDateTime, getInitials, formatNumber, cn } from '@/lib/utils'
import type { Submission, SubmissionStatus } from '@/types/submission'
import { submissionApi } from '../api/submissionApi'
import { toast } from 'sonner'
import {
  FileCheck, Clock, CheckCircle2, XCircle, 
  ChevronRight, Search, ArrowUpDown, ChevronLeft, User, Building2,
  Loader2, CheckCircle, X
} from 'lucide-react'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/store/authStore'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { usePermission } from '@/hooks/usePermission'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type TabKey = SubmissionStatus | 'ALL'

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  PENDING: { label: 'Chờ duyệt', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50/50 border-amber-200/50 dark:bg-amber-900/20 dark:border-amber-900/30', icon: Clock },
  APPROVED: { label: 'Đã duyệt', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50/50 border-emerald-200/50 dark:bg-emerald-900/20 dark:border-emerald-900/30', icon: CheckCircle2 },
  REJECTED: { label: 'Từ chối', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50/50 border-red-200/50 dark:bg-red-900/20 dark:border-red-900/30', icon: XCircle },
}

export default function OrgUnitSubmissionsPage() {
  const [searchParams] = useSearchParams()
  const initialUserId = searchParams.get('userId') || ''
  const qc = useQueryClient()
  
  const [activeTab, setActiveTab] = useState<TabKey>('PENDING')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize] = useState(10)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedSubmittedById, setSelectedSubmittedById] = useState(initialUserId || 'ALL')
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState('ALL')
  
  // Selection state
  const [selectedSubs, setSelectedSubs] = useState<string[]>([])
  
  const { user } = useAuthStore()
  const { hasPermission } = usePermission()
  const canManageOrg = hasPermission('ROLE:ASSIGN')

  // Org Unit Tree for filter
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

  // Default selection logic
  useEffect(() => {
    if (selectedOrgUnitId === 'ALL') {
      if (canManageOrg && flatOrgUnits.length > 0) {
        setSelectedOrgUnitId(flatOrgUnits[0].id)
      } else if (!canManageOrg && user?.memberships?.[0]?.orgUnitId) {
        setSelectedOrgUnitId(user.memberships[0].orgUnitId)
      }
    }
  }, [flatOrgUnits, selectedOrgUnitId, canManageOrg, user])

  // Fetch employees based on selected Org Unit
  const { data: usersData } = useUsers({ 
    page: 0, 
    size: 500, 
    orgUnitId: (selectedOrgUnitId === 'ALL' ? undefined : selectedOrgUnitId) || user?.memberships?.[0]?.orgUnitId
  })
  const employees = usersData?.content ?? []

  const { data, isLoading } = useOrgUnitSubmissions({
    status: activeTab === 'ALL' ? undefined : activeTab,
    submittedById: selectedSubmittedById === 'ALL' ? undefined : selectedSubmittedById,
    orgUnitId: selectedOrgUnitId === 'ALL' ? undefined : selectedOrgUnitId,
    organizationId: user?.memberships?.[0]?.organizationId,
    page,
    size: pageSize,
    sortBy,
    sortDir
  })

  const items = data?.content ?? []
  const [reviewSub, setReviewSub] = useState<Submission | null>(null)

  // Quick stats from all data
  const { data: allData } = useOrgUnitSubmissions({ size: 1000 })
  const stats = useMemo(() => {
    const all = allData?.content ?? []
    return {
      total: all.length,
      pending: all.filter(s => s.status === 'PENDING').length,
      approved: all.filter(s => s.status === 'APPROVED').length,
      rejected: all.filter(s => s.status === 'REJECTED').length,
    }
  }, [allData])

  // Bulk Approve Mutation
  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const promises = ids.map(id => submissionApi.review(id, { status: 'APPROVED', reviewNote: 'Phê duyệt hàng loạt' }))
      return Promise.all(promises)
    },
    onSuccess: (results) => {
      qc.invalidateQueries({ queryKey: ['submissions'] })
      toast.success(`Đã phê duyệt thành công ${results.length} bài nộp`)
      setSelectedSubs([])
    },
    onError: () => toast.error('Đã xảy ra lỗi khi duyệt hàng loạt')
  })

  const toggleSelectAll = () => {
    const selectableItems = items.filter(s => {
      const isOwn = s.submittedById === user?.id
      const canReview = (!s.isSubmittedByManager || canManageOrg) && !isOwn
      return s.status === 'PENDING' && canReview
    })
    if (selectedSubs.length === selectableItems.length && selectableItems.length > 0) {
      setSelectedSubs([])
    } else {
      setSelectedSubs(selectableItems.map(s => s.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedSubs(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
    setPage(0)
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
        
        {/* Header Section with Glass Card */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-[40px] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
          <div className="relative bg-white dark:bg-slate-900 rounded-[28px] p-6 border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-500/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
                  <FileCheck size={12} className="animate-pulse" /> Trung tâm Phê duyệt Bài nộp
                </div>
                <div className="space-y-0.5">
                  <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                    Phê duyệt <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">Bài nộp KPI</span>
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm max-w-xl leading-relaxed">
                    Quản trị và đánh giá kết quả thực hiện KPI của đội ngũ nhân sự.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <StatChip label="Chờ duyệt" value={stats.pending} color="amber" />
                <StatChip label="Từ chối" value={stats.rejected} color="red" />
                <StatChip label="Đã duyệt" value={stats.approved} color="emerald" />
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-5 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex flex-col lg:flex-row items-center gap-4 w-full">
            <div className="relative flex-1 w-full lg:max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
              <input 
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0) }}
                placeholder="Tìm người nộp, tên KPI..." 
                className="w-full pl-12 pr-4 h-13 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-sm font-medium focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto">
              {canManageOrg && (
                <div className="w-full md:w-56">
                  <Select value={selectedOrgUnitId} onValueChange={val => { setSelectedOrgUnitId(val); setPage(0); setSelectedSubmittedById('ALL') }}>
                    <SelectTrigger className="h-13 rounded-2xl border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 font-bold text-sm">
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-slate-400" />
                        <SelectValue placeholder="Đơn vị" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2">
                      <SelectItem value="ALL" className="font-black text-[10px] uppercase tracking-widest rounded-xl focus:bg-emerald-50">Tất cả đơn vị</SelectItem>
                      {flatOrgUnits.map(unit => (
                        <SelectItem key={unit.id} value={unit.id} className="font-medium rounded-xl focus:bg-emerald-50">{unit.levelLabel}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="w-full md:w-56">
                <Select value={selectedSubmittedById} onValueChange={val => { setSelectedSubmittedById(val); setPage(0) }}>
                  <SelectTrigger className="h-13 rounded-2xl border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 font-bold text-sm">
                    <div className="flex items-center gap-2">
                      <User size={16} className="text-slate-400" />
                      <SelectValue placeholder="Nhân viên" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2">
                    <SelectItem value="ALL" className="font-black text-[10px] uppercase tracking-widest rounded-xl focus:bg-emerald-50">Tất cả nhân viên</SelectItem>
                    {employees.map(u => (
                      <SelectItem key={u.id} value={u.id} className="font-medium rounded-xl focus:bg-emerald-50">{u.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((tab) => {
              const labels: Record<string, string> = { 
                ALL: 'Tất cả bài nộp',
                PENDING: 'Đang chờ duyệt', 
                APPROVED: 'Đã phê duyệt', 
                REJECTED: 'Bị từ chối', 
              }
              const active = activeTab === tab
              return (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setPage(0); setSelectedSubs([]) }}
                  className={cn(
                    "px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border-2 whitespace-nowrap",
                    active 
                      ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900 shadow-xl scale-105' 
                      : 'bg-white/50 border-transparent text-slate-500 hover:bg-white hover:border-slate-200 dark:bg-slate-900/50 dark:hover:bg-slate-800 dark:text-slate-400'
                  )}
                >
                  {labels[tab]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedSubs.length > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 duration-500">
            <div className="bg-slate-900 dark:bg-emerald-950 text-white px-8 py-4 rounded-[28px] shadow-2xl flex items-center gap-8 border border-white/10 backdrop-blur-xl">
              <div className="flex items-center gap-3 border-r border-white/10 pr-8">
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center font-black text-sm">
                  {selectedSubs.length}
                </div>
                <p className="text-sm font-bold uppercase tracking-widest text-emerald-200">Đã chọn</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => bulkApproveMutation.mutate(selectedSubs)}
                  disabled={bulkApproveMutation.isPending}
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {bulkApproveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />} Duyệt hàng loạt
                </button>
                <button 
                  onClick={() => setSelectedSubs([])}
                  className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"
                >
                  <X size={16} /> Huỷ bỏ
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
              title={activeTab === 'PENDING' ? 'Không có bài nộp nào đang chờ' : 'Không có dữ liệu'} 
              description="Hệ thống hiện tại không có bài nộp nào khớp với bộ lọc." 
            />
          </div>
        ) : (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[32px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <th className="px-8 py-5 w-12 text-center">
                      {items.some(s => {
                        const isOwn = s.submittedById === user?.id
                        const canReview = (!s.isSubmittedByManager || canManageOrg) && !isOwn
                        return s.status === 'PENDING' && canReview
                      }) && (
                        <input 
                          type="checkbox" 
                          checked={(() => {
                            const selectableItems = items.filter(s => {
                              const isOwn = s.submittedById === user?.id
                              const canReview = (!s.isSubmittedByManager || canManageOrg) && !isOwn
                              return s.status === 'PENDING' && canReview
                            })
                            return selectableItems.length > 0 && selectedSubs.length === selectableItems.length
                          })()}
                          onChange={toggleSelectAll}
                          className="w-5 h-5 rounded-lg border-2 border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500/20 cursor-pointer accent-emerald-600"
                        />
                      )}
                    </th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Trạng thái</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">
                      <button onClick={() => handleSort('kpiCriteriaName')} className="flex items-center gap-2 hover:text-emerald-600 transition-colors group">
                        KPI / Chỉ tiêu <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">
                       <button onClick={() => handleSort('submittedByName')} className="flex items-center gap-2 hover:text-emerald-600 transition-colors group">
                        Người nộp <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center whitespace-nowrap">Giá trị nộp</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">
                      <button onClick={() => handleSort('createdAt')} className="flex items-center gap-2 hover:text-emerald-600 transition-colors group">
                        Ngày nộp <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {items.map((sub, i) => {
                    const status = statusConfig[sub.status] ?? statusConfig['PENDING']!
                    const StatusIcon = status.icon
                    const isSelected = selectedSubs.includes(sub.id)
                    return (
                      <tr 
                        key={sub.id} 
                        className={cn(
                          "group transition-all duration-300 animate-in fade-in slide-in-from-left-4",
                          isSelected ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                        )}
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <td className="px-8 py-5 text-center">
                          {(() => {
                            const isOwn = sub.submittedById === user?.id
                            const canReview = (!sub.isSubmittedByManager || canManageOrg) && !isOwn
                            return sub.status === 'PENDING' && canReview
                          })() && (
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={(e) => { e.stopPropagation(); toggleSelect(sub.id) }}
                              className="w-5 h-5 rounded-lg border-2 border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500/20 cursor-pointer accent-emerald-600"
                            />
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <div className={cn(
                            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest shadow-sm whitespace-nowrap",
                            status.bgColor, status.color
                          )}>
                            <StatusIcon size={12} className={sub.status === 'PENDING' ? 'animate-pulse' : ''} /> {status.label}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="max-w-xs md:max-w-md text-left cursor-pointer" onClick={() => setReviewSub(sub)}>
                            <p className="text-sm font-black text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors line-clamp-1">
                              {sub.kpiCriteriaName}
                            </p>
                            {sub.note && <p className="text-[10px] font-medium text-slate-400 mt-1 line-clamp-1 italic">"{sub.note}"</p>}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xs border border-emerald-200/50 dark:border-emerald-800/30">
                              {getInitials(sub.submittedByName)}
                            </div>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                              {sub.submittedByName}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <div className="inline-flex items-baseline gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shadow-inner">
                            <span className="text-sm font-black">{formatNumber(sub.actualValue)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              {formatDateTime(sub.createdAt).split(' ')[0]}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">
                              {formatDateTime(sub.createdAt).split(' ')[1]}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <button onClick={() => setReviewSub(sub)} className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm border border-transparent hover:border-emerald-200 dark:hover:border-slate-700">
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
              Trang <span className="text-slate-900 dark:text-white">{page + 1}</span> / {data?.totalPages || 1}
            </p>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
            <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">
              Tổng <span className="text-slate-900 dark:text-white">{data?.totalElements || 0}</span> bài nộp
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setPage(p => Math.max(0, p - 1)) }}
              disabled={page === 0}
              className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm"
            >
              <ChevronLeft size={18} />
            </button>
            
            <button
              onClick={(e) => { e.stopPropagation(); setPage(p => p + 1) }}
              disabled={page >= (data?.totalPages || 1) - 1}
              className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <ReviewModal open={!!reviewSub} onClose={() => setReviewSub(null)} submission={reviewSub} />
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
