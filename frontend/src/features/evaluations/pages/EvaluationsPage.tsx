import { useState, useMemo } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import EvaluationFormModal from '../components/EvaluationFormModal'
import EvaluationDetailModal from '../components/EvaluationDetailModal'
import { useEvaluations } from '../hooks/useEvaluations'
import { useAuthStore } from '@/store/authStore'
import { usePermission } from '@/hooks/usePermission'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useMyKpi } from '@/features/kpi/hooks/useMyKpi'
import { formatDateTime, getInitials } from '@/lib/utils'
import type { Evaluation } from '@/types/evaluation'
import {
  Star, Plus, ChevronRight, User, Calendar,
  Building2, ArrowUpDown, ChevronLeft
} from 'lucide-react'

// Score coloring utilities
function getScoreColor(score: number | null) {
  if (score == null) return 'text-slate-400'
  if (score >= 90) return 'text-emerald-600'
  if (score >= 70) return 'text-blue-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-600'
}

function getScoreBg(score: number | null) {
  if (score == null) return 'bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700'
  if (score >= 90) return 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-900/40'
  if (score >= 70) return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-900/40'
  if (score >= 50) return 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-900/40'
  return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900/40'
}

function getScoreLabel(score: number | null) {
  if (score == null) return 'Chưa chấm'
  if (score >= 90) return 'Xuất sắc'
  if (score >= 70) return 'Tốt'
  if (score >= 50) return 'Đạt'
  return 'Cần cải thiện'
}

export default function EvaluationsPage() {
  const { user } = useAuthStore()
  const { isStaff, isDirector } = usePermission()

  // Control states
  const [page, setPage] = useState(0)
  const [pageSize] = useState(10)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  
  // Filter states
  const [selectedKpiPeriodId, setSelectedKpiPeriodId] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState('')

  const { data, isLoading } = useEvaluations({
    page,
    size: pageSize,
    sortBy,
    sortDir,
    userId: selectedUserId || undefined,
    kpiPeriodId: selectedKpiPeriodId || undefined,
    orgUnitId: selectedOrgUnitId || undefined
  })

  // Modal states
  const [showForm, setShowForm] = useState(false)
  const [detailEval, setDetailEval] = useState<Evaluation | null>(null)

  // Fetch reference data for filters
  const { data: periodsData } = useKpiPeriods()
  const { data: orgUnitTreeData } = useOrgUnitTree()
  const { data: usersData } = useUsers({ 
    page: 0, 
    size: 500, 
    orgUnitId: selectedOrgUnitId || user?.memberships?.[0]?.orgUnitId
  })

  const periods = periodsData?.content ?? []
  const employees = usersData?.content ?? []

  // Logic for reminders and single evaluation
  const now = new Date()
  const activePeriod = useMemo(() => {
    return periods.find((p: any) => {
      if (!p.startDate || !p.endDate) return false
      const start = new Date(p.startDate)
      const end = new Date(p.endDate)
      return now >= start && now <= end
    })
  }, [periods])

  // Fetch all my KPIs to know if I have any in the active period
  const { data: myAllKpis } = useMyKpi({ page: 0, size: 500 })
  const hasKpiInActivePeriod = useMemo(() => {
    if (!activePeriod || !myAllKpis?.content) return false
    return myAllKpis.content.some((k: any) => k.kpiPeriodId === activePeriod.id)
  }, [activePeriod, myAllKpis])

  // Tree flattening for Org Unit filter
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

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
    setPage(0)
  }

  const hasSelfEvalForActivePeriod = useMemo(() => {
    if (!activePeriod || !data?.content) return false
    return data.content.some(ev => ev.kpiPeriodId === activePeriod.id && ev.evaluatorId === user?.id)
  }, [activePeriod, data, user])

  const isNearDeadline = useMemo(() => {
    if (!activePeriod || !activePeriod.endDate) return false
    const end = new Date(activePeriod.endDate)
    const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays <= 7 && diffDays >= 0
  }, [activePeriod, now])

  // Quick stats from all evaluations (if needed for header badges)
  const stats = useMemo(() => {
    const all = data?.content ?? []
    const totalCount = data?.totalElements || 0
    const scoredEvals = all.filter(e => e.score != null)
    const avgScore = scoredEvals.length > 0 
      ? Math.round(scoredEvals.reduce((acc, e) => acc + (e.score ?? 0), 0) / scoredEvals.length) 
      : 0
    return {
      total: totalCount,
      avgScore
    }
  }, [data])

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      
      {/* Reminder Banner */}
      {activePeriod && hasKpiInActivePeriod && !hasSelfEvalForActivePeriod && isNearDeadline && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-4 shadow-sm animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-800 flex items-center justify-center text-amber-600">
              <Calendar size={24} />
            </div>
            <div>
              <h3 className="font-black text-amber-900 dark:text-amber-100">Nhắc nhở: Tự đánh giá đợt {activePeriod.name}</h3>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Hạn chót là ngày <b>{activePeriod.endDate ? new Date(activePeriod.endDate).toLocaleDateString('vi-VN') : '—'}</b>. Hãy hoàn tất bản tự đánh giá của mình trước khi cổng đóng lại!
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-black uppercase tracking-widest">
            <Star size={14} /> Hiệu suất nhân sự
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            {isStaff ? 'Tự đánh giá Định kỳ' : 'Đánh giá Nhân sự'}
          </h1>
          <p className="text-slate-500 font-medium max-w-lg">
            {isStaff 
              ? 'Tự chấm điểm và đánh giá hiệu suất tổng thể của bản thân theo từng đợt (kỳ) KPI.'
              : 'Xem xét và phản hồi đánh giá hiệu suất định kỳ của nhân viên.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
          <div className="flex gap-3">
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl border bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-900/40">
              <span className="text-2xl font-black">{stats.total}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Tổng số</span>
            </div>
            <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border ${getScoreBg(stats.avgScore)}`}>
              <span className={`text-2xl font-black ${getScoreColor(stats.avgScore)}`}>{stats.avgScore || '—'}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Trung bình</span>
            </div>
        </div>
      </div>
    </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
          {/* Period Filter */}
          <div className="relative flex-1 md:w-64">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              value={selectedKpiPeriodId}
              onChange={e => { setSelectedKpiPeriodId(e.target.value); setPage(0) }}
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-amber-500/20 outline-none appearance-none transition-all"
            >
              <option value="">Tất cả đợt đánh giá...</option>
              {periods.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {!isStaff && (
            <>
              {isDirector && (
                <div className="relative flex-1 md:w-64">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <select
                    value={selectedOrgUnitId}
                    onChange={e => { setSelectedOrgUnitId(e.target.value); setPage(0); setSelectedUserId('') }}
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-amber-500/20 outline-none appearance-none transition-all"
                  >
                    <option value="">Tất cả phòng ban...</option>
                    {flatOrgUnits.map(unit => (
                      <option key={unit.id} value={unit.id}>{unit.levelLabel}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="relative flex-1 md:w-64">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <select
                  value={selectedUserId}
                  onChange={e => { setSelectedUserId(e.target.value); setPage(0) }}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-amber-500/20 outline-none appearance-none transition-all"
                >
                  <option value="">Tất cả nhân viên...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        {isStaff && (
          <button 
            onClick={() => setShowForm(true)} 
            disabled={hasSelfEvalForActivePeriod || !hasKpiInActivePeriod}
            className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 w-full xl:w-auto justify-center ${
              (hasSelfEvalForActivePeriod || !hasKpiInActivePeriod)
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
              : 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-500/20'
            }`}
          >
            <Plus size={18} /> 
            {hasSelfEvalForActivePeriod ? 'Đã tự đánh giá' : !hasKpiInActivePeriod ? 'Không có KPI trong đợt này' : 'Tự đánh giá mới'}
          </button>
        )}
      </div>

      {/* Content Table */}
      {isLoading ? (
        <LoadingSkeleton type="table" rows={pageSize} />
      ) : (data?.content ?? []).length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-dashed border-slate-300 dark:border-slate-800 p-20">
          <EmptyState 
            title="Chưa có đánh giá nào" 
            description={isStaff 
              ? 'Hãy bắt đầu tự đánh giá hiệu suất của bạn theo từng đợt (kỳ) KPI.' 
              : 'Chưa tìm thấy bản đánh giá định kỳ nào khớp với bộ lọc.'
            } 
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm animate-in fade-in zoom-in-95 duration-500">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">Kết quả</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">
                    <button onClick={() => handleSort('userName')} className="flex items-center gap-1 hover:text-amber-600 transition-colors">
                      Nhân viên <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">
                    <button onClick={() => handleSort('kpiPeriodName')} className="flex items-center gap-1 hover:text-amber-600 transition-colors">
                      Đợt đánh giá <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">
                    <button onClick={() => handleSort('createdAt')} className="flex items-center gap-1 hover:text-amber-600 transition-colors">
                      Ngày tạo <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(data?.content ?? []).map((ev) => {
                  const isSelfEval = ev.evaluatorId === ev.userId
                  return (
                    <tr 
                      key={ev.id} 
                      className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-all"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border ${getScoreBg(ev.score)}`}>
                          <span className={`text-sm font-black ${getScoreColor(ev.score)}`}>{ev.score ?? '—'}</span>
                          <span className="text-[10px] font-bold uppercase tracking-tight text-slate-400">{getScoreLabel(ev.score)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500">
                            {getInitials(ev.userName)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {ev.userName}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium">{ev.orgUnitName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {ev.kpiPeriodName}
                        </p>
                        <span className={`inline-block mt-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                          isSelfEval 
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' 
                            : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30'
                        }`}>
                          {isSelfEval ? 'Tự đánh giá' : 'Quản lý chấm'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs font-bold text-slate-500">
                          {formatDateTime(ev.createdAt)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setDetailEval(ev)}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/40 rounded-xl transition-all"
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

          {/* Pagination Footer */}
          <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm font-medium text-slate-500">
              Trang <span className="text-slate-900 dark:text-white font-bold">{page + 1}</span> / {data?.totalPages || 1} 
              <span className="mx-2 text-slate-300">•</span>
              Tổng <span className="text-slate-900 dark:text-white font-bold">{data?.totalElements || 0}</span> đánh giá
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= (data?.totalPages || 1) - 1}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      <EvaluationFormModal open={showForm} onClose={() => setShowForm(false)} />
      <EvaluationDetailModal open={!!detailEval} onClose={() => setDetailEval(null)} evaluation={detailEval} />
    </div>
  )
}
