import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { getScoringFunctions } from '@/lib/scoring'
import { formatDateTime, getInitials, cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Evaluation } from '@/types/evaluation'
import {
  Star, Plus, ChevronRight, User, Calendar,
  Building2, ArrowUpDown, ChevronLeft, Award, TrendingUp, Activity
} from 'lucide-react'



export default function EvaluationsPage() {
  const { user } = useAuthStore()
  const { hasPermission } = usePermission()
  
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(orgId)
  const { getScoreColor, getScoreBg, getScoreLabel } = getScoringFunctions(org)

  const isGlobalAdmin = hasPermission('SYSTEM:ADMIN')
  const canCreate = hasPermission('EVALUATION:CREATE') && !isGlobalAdmin
  const canViewAll = hasPermission('EVALUATION:VIEW')
  const canManageOrg = hasPermission('ROLE:ASSIGN')

  // Control states
  const [page, setPage] = useState(0)
  const [pageSize] = useState(10)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  
  // Filter states
  const [selectedKpiPeriodId, setSelectedKpiPeriodId] = useState('ALL')
  const [selectedUserId, setSelectedUserId] = useState('ALL')
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState('')

  const { data, isLoading } = useEvaluations({
    page,
    size: pageSize,
    sortBy,
    sortDir,
    userId: selectedUserId === 'ALL' ? undefined : selectedUserId,
    kpiPeriodId: selectedKpiPeriodId === 'ALL' ? undefined : selectedKpiPeriodId,
    orgUnitId: selectedOrgUnitId === 'ALL' ? undefined : selectedOrgUnitId,
    organizationId: user?.memberships?.[0]?.organizationId
  })

  // Modal states
  const [showForm, setShowForm] = useState(false)
  const [detailEval, setDetailEval] = useState<Evaluation | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [preSelectedPeriodId, setPreSelectedPeriodId] = useState<string | undefined>()

  // Handle auto-open self-evaluation from URL
  useEffect(() => {
    const action = searchParams.get('action')
    const periodId = searchParams.get('periodId')
    
    if (action === 'self-eval' && periodId) {
      setPreSelectedPeriodId(periodId)
      setShowForm(true)
      // Clean up params after opening
      searchParams.delete('action')
      searchParams.delete('periodId')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Fetch reference data for filters
  const { data: periodsData } = useKpiPeriods({ organizationId: user?.memberships?.[0]?.organizationId })
  const { data: orgUnitTreeData } = useOrgUnitTree()
  const { data: usersData } = useUsers({ 
    page: 0, 
    size: 500, 
    orgUnitId: selectedOrgUnitId === 'ALL' ? undefined : selectedOrgUnitId,
    organizationId: user?.memberships?.[0]?.organizationId
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

  const { data: myAllKpis } = useMyKpi({ page: 0, size: 500 })
  const hasKpiInActivePeriod = useMemo(() => {
    if (!activePeriod || !myAllKpis?.content) return false
    return myAllKpis.content.some((k: any) => k.kpiPeriodId === activePeriod.id)
  }, [activePeriod, myAllKpis])

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
  
  // Set default org unit to root
  useEffect(() => {
    if (flatOrgUnits.length > 0 && !selectedOrgUnitId) {
      setSelectedOrgUnitId(flatOrgUnits[0].id)
    }
  }, [flatOrgUnits, selectedOrgUnitId])

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

  const isPeriodCompleted = useMemo(() => {
    if (!activePeriod || !myAllKpis?.content) return false
    
    const periodKpis = myAllKpis.content.filter(k => k.kpiPeriodId === activePeriod.id)
    if (periodKpis.length === 0) return false

    return periodKpis.every(kpi => kpi.submissionCount >= kpi.expectedSubmissions)
  }, [activePeriod, myAllKpis])

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
    <div className="max-w-[1440px] mx-auto p-4 md:p-6 space-y-6 animate-in fade-in duration-700 transition-all">
      
      {/* Dynamic Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
           <Award size={120} className="text-indigo-600" />
        </div>
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Star size={20} className="fill-current" />
            <span className="text-[10px] font-black uppercase tracking-[2px]">Performance Reviews</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            {canViewAll ? 'Quản lý Đánh giá' : 'Tự đánh giá Hiệu suất'}
          </h1>
          <p className="text-slate-500 font-medium text-sm max-w-lg">
            {canViewAll 
              ? 'Hệ thống quản trị và phản hồi kết quả đánh giá năng lực nhân sự định kỳ.'
              : 'Nơi phản ánh kết quả nỗ lực và tự đánh giá năng lực bản thân theo từng kỳ.'}
          </p>
        </div>

        <div className="flex items-center gap-4 relative z-10 shrink-0">
          <EvaluationStat label="Tổng đánh giá" value={stats.total} color="indigo" icon={Activity} />
          <EvaluationStat label="Điểm trung bình" value={stats.avgScore} color="amber" icon={TrendingUp} isScore />
        </div>
      </div>

      {/* Reminder Banner */}
      {activePeriod && hasKpiInActivePeriod && !hasSelfEvalForActivePeriod && isNearDeadline && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-3xl p-6 flex items-center justify-between shadow-sm animate-in slide-in-from-top-4 duration-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Calendar size={24} />
            </div>
            <div>
              <h3 className="font-black text-amber-900 dark:text-amber-100">Cần thực hiện: Tự đánh giá đợt {activePeriod.name}</h3>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400 opacity-80">
                Hãy hoàn tất bản đánh giá trước ngày <b className="font-black underline">{activePeriod.endDate ? new Date(activePeriod.endDate).toLocaleDateString('vi-VN') : '—'}</b>.
              </p>
            </div>
          </div>
          <button 
            onClick={() => setShowForm(true)}
            disabled={!isPeriodCompleted}
            className={cn(
              "px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95",
              !isPeriodCompleted 
                ? "bg-slate-200 text-slate-400 cursor-not-allowed" 
                : "bg-amber-600 text-white hover:bg-amber-700"
            )}
          >
            {isPeriodCompleted ? 'ĐÁNH GIÁ NGAY' : 'CHƯA ĐỦ ĐIỀU KIỆN'}
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        <div className="lg:col-span-8 flex flex-col md:flex-row items-center gap-3">
          <div className="relative w-full md:w-64">
            <Select value={selectedKpiPeriodId} onValueChange={val => { setSelectedKpiPeriodId(val); setPage(0) }}>
              <SelectTrigger className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold shadow-sm h-10">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Calendar size={16} className="text-slate-400" />
                </div>
                <SelectValue placeholder="Tất cả đợt đánh giá..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-[var(--color-border)] shadow-lg max-h-[300px]">
                <SelectItem value="ALL" className="font-medium cursor-pointer rounded-lg text-xs">Tất cả đợt đánh giá...</SelectItem>
                {periods.map(p => (
                  <SelectItem key={p.id} value={p.id} className="font-medium cursor-pointer rounded-lg text-xs">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {canViewAll && (
            <>
              {canManageOrg && (
                <div className="relative w-full md:w-64">
                  <Select value={selectedOrgUnitId} onValueChange={val => { setSelectedOrgUnitId(val); setPage(0); setSelectedUserId('ALL') }}>
                    <SelectTrigger className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold shadow-sm h-10">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Building2 size={16} className="text-slate-400" />
                      </div>
                      <SelectValue placeholder="Chọn phòng ban..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-[var(--color-border)] shadow-lg max-h-[300px]">
                      {flatOrgUnits.map(unit => (
                        <SelectItem key={unit.id} value={unit.id} className="font-medium cursor-pointer rounded-lg text-xs">{unit.levelLabel}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="relative w-full md:w-64">
                <Select value={selectedUserId} onValueChange={val => { setSelectedUserId(val); setPage(0) }}>
                  <SelectTrigger className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold shadow-sm h-10">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User size={16} className="text-slate-400" />
                    </div>
                    <SelectValue placeholder="Tất cả nhân viên..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-[var(--color-border)] shadow-lg max-h-[300px]">
                    <SelectItem value="ALL" className="font-medium cursor-pointer rounded-lg text-xs">Tất cả nhân viên...</SelectItem>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id} className="font-medium cursor-pointer rounded-lg text-xs">{emp.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <div className="lg:col-span-4 flex justify-end">
          {canCreate && (
            <button 
              onClick={() => setShowForm(true)} 
              disabled={hasSelfEvalForActivePeriod || !hasKpiInActivePeriod || !isPeriodCompleted}
              className={cn(
                "flex items-center gap-2 px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-[2px] transition-all shadow-xl active:scale-95 w-full md:w-auto justify-center",
                (hasSelfEvalForActivePeriod || !hasKpiInActivePeriod || !isPeriodCompleted)
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none border border-slate-200 dark:border-slate-700'
                : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-indigo-600 dark:hover:bg-indigo-50 shadow-indigo-500/10'
              )}
            >
              <Plus size={18} /> 
              {hasSelfEvalForActivePeriod ? 'Đã tự đánh giá' : !hasKpiInActivePeriod ? 'Không có KPI' : !isPeriodCompleted ? 'Chưa hoàn thành KPI' : 'Tự đánh giá mới'}
            </button>
          )}
        </div>
      </div>

      {/* Table Content */}
      {isLoading ? (
        <LoadingSkeleton type="table" rows={10} />
      ) : (data?.content ?? []).length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 p-24 shadow-sm text-center">
          <EmptyState 
            title="Chưa có dữ liệu đánh giá" 
            description={canViewAll 
              ? 'Hệ thống hiện chưa có bản đánh giá nào phù hợp với bộ lọc tìm kiếm.'
              : 'Bắt đầu tự phản ánh kết quả công việc bằng cách thực hiện bản tự đánh giá đầu tiên.'
            } 
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-all">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Kết quả</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <button onClick={() => handleSort('userName')} className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                      Nhân viên <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <button onClick={() => handleSort('kpiPeriodName')} className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                      Kỳ đánh giá <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Vai trò</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <button onClick={() => handleSort('createdAt')} className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                      Ngày tạo <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(data?.content ?? []).map((ev, idx) => {
                  return (
                    <tr 
                      key={ev.id} 
                      onClick={() => setDetailEval(ev)}
                      className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-300"
                      style={{ animationDelay: `${idx * 40}ms` }}
                    >
                      <td className="px-8 py-6 whitespace-nowrap">
                        <div className={cn("inline-flex items-center gap-3 px-4 py-2 rounded-2xl border shadow-sm", getScoreBg(ev.score))}>
                          <span className={cn("text-lg font-black", getScoreColor(ev.score))}>{ev.score ?? '—'}</span>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-l border-slate-200 dark:border-slate-700 pl-3 leading-none">
                            {getScoreLabel(ev.score)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center font-black text-xs text-slate-600 dark:text-slate-300 shadow-inner">
                            {getInitials(ev.userName)}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                              {ev.userName}
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{ev.orgUnitName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-slate-400" />
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            {ev.kpiPeriodName}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-6 text-center">
                        <span className={cn(
                          "inline-block text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border",
                          ev.evaluatorRole === 'SELF'
                            ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20' 
                            : ev.evaluatorRole === 'DIRECTOR'
                            ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20'
                            : (ev.evaluatorRole === 'DEPT_HEAD' || ev.evaluatorRole === 'TEAM_LEADER')
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20'
                            : 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20'
                        )}>
                          {ev.evaluatorRole === 'SELF' ? 'Tự đánh giá' : 
                           ev.evaluatorRole === 'DIRECTOR' ? 'Giám đốc chốt' : 
                           ev.evaluatorRole === 'DEPT_HEAD' ? 'Trưởng phòng chấm' : 
                           ev.evaluatorRole === 'DEPT_DEPUTY' ? 'Phó phòng chấm' :
                           ev.evaluatorRole === 'TEAM_LEADER' ? 'Trưởng nhóm chấm' :
                           ev.evaluatorRole === 'TEAM_DEPUTY' ? 'Phó nhóm chấm' :
                           'Quản lý chấm'}
                        </span>
                      </td>
                      <td className="px-6 py-6 whitespace-nowrap">
                        <span className="text-xs font-bold text-slate-500">
                          {formatDateTime(ev.createdAt).split(' ')[0]}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-200 shadow-sm transition-all active:scale-90">
                          <ChevronRight size={20} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="px-8 py-5 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Trang {page + 1} / {data?.totalPages || 1}
              </p>
              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {data?.totalElements || 0} Kết quả
              </p>
            </div>
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

      <EvaluationFormModal 
        open={showForm} 
        onClose={() => {
          setShowForm(false)
          setPreSelectedPeriodId(undefined)
        }} 
        initialPeriodId={preSelectedPeriodId}
      />
      <EvaluationDetailModal open={!!detailEval} onClose={() => setDetailEval(null)} evaluation={detailEval} />
    </div>
  )
}

function EvaluationStat({ label, value, color, icon: Icon, isScore }: { label: string; value: number; color: string; icon: any; isScore?: boolean }) {
  const colors: Record<string, string> = {
    indigo: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/40",
    amber: "text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/40",
  }
  return (
    <div className={cn("px-6 py-4 rounded-[28px] border flex items-center gap-4 shadow-sm", colors[color])}>
      <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm text-current")}>
        <Icon size={18} />
      </div>
      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black">{value}</span>
          {isScore && <span className="text-xs font-bold opacity-60">pts</span>}
        </div>
        <p className="text-[9px] font-black uppercase tracking-widest opacity-60 leading-none mt-0.5">{label}</p>
      </div>
    </div>
  )
}
