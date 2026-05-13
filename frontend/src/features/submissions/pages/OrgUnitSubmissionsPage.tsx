import { useState, useMemo, useEffect } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import StaffEvaluationModal from '../components/StaffEvaluationModal'
import EvaluationDetailModal from '@/features/evaluations/components/EvaluationDetailModal'
import { useOrgUnitSubmissions } from '../hooks/useOrgUnitSubmissions'
import { useEvaluations } from '@/features/evaluations/hooks/useEvaluations'
import { useUsers } from '@/features/users/hooks/useUsers'
import { getInitials, cn } from '@/lib/utils'
import { getScoringFunctions } from '@/lib/scoring'
import { useAuthStore } from '@/store/authStore'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { usePermission } from '@/hooks/usePermission'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  FileCheck, Search, Building2, Calendar, Clock, ChevronRight, ChevronLeft
} from 'lucide-react'
import PageTour from '@/components/common/PageTour'
import { orgUnitSubmissionsSteps } from '@/components/common/tourSteps'

export default function OrgUnitSubmissionsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize] = useState(10)
  const { user } = useAuthStore()
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState(user?.memberships?.[0]?.orgUnitId || 'ALL')
  const [selectedPeriodId, setSelectedPeriodId] = useState('ALL')
  const { hasPermission } = usePermission()
  const canManageOrg = hasPermission('ROLE:ASSIGN')

  
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(orgId)
  const { getScoreColor, getScoreBg, getScoreLabel } = getScoringFunctions(org)
  const isManager = useMemo(() => user?.memberships?.some(m => m.roleRank === 0), [user])

  const { data: orgUnitTreeData } = useOrgUnitTree()
  const { data: periodsData } = useKpiPeriods({ organizationId: orgId })

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

  useEffect(() => {
    if (selectedOrgUnitId === 'ALL') {
      if (canManageOrg && flatOrgUnits.length > 0) {
        setSelectedOrgUnitId(flatOrgUnits[0].id)
      } else if (!canManageOrg && user?.memberships?.[0]?.orgUnitId) {
        setSelectedOrgUnitId(user.memberships[0].orgUnitId)
      }
    }
  }, [flatOrgUnits, selectedOrgUnitId, canManageOrg, user])

  const activePeriod = useMemo(() => {
    const now = new Date()
    return periodsData?.content.find((p: any) => {
      if (!p.startDate || !p.endDate) return false
      const start = new Date(p.startDate)
      const end = new Date(p.endDate)
      return now >= start && now <= end
    })
  }, [periodsData])

  useEffect(() => {
    if (selectedPeriodId === 'ALL' && activePeriod) {
      setSelectedPeriodId(activePeriod.id)
    }
  }, [activePeriod, selectedPeriodId])

  // Fetch employees
  const { data: usersData, isLoading: isLoadingUsers } = useUsers({ 
    page, 
    size: pageSize, 
    orgUnitId: selectedOrgUnitId === 'ALL' ? undefined : selectedOrgUnitId,
    keyword: search || undefined,
    organizationId: orgId
  })
  const employees = usersData?.content ?? []

  // Fetch Evaluations for the selected period
  const { data: evaluationsData, isLoading: isLoadingEvals } = useEvaluations({
    size: 1000,
    kpiPeriodId: selectedPeriodId === 'ALL' ? undefined : selectedPeriodId,
    orgUnitId: selectedOrgUnitId === 'ALL' ? undefined : selectedOrgUnitId,
    organizationId: orgId
  })

  // Fetch Submissions for the selected period to count pending
  const { data: submissionsData, isLoading: isLoadingSubs } = useOrgUnitSubmissions({
    size: 1000,
    kpiPeriodId: selectedPeriodId === 'ALL' ? undefined : selectedPeriodId,
    orgUnitId: selectedOrgUnitId === 'ALL' ? undefined : selectedOrgUnitId,
    organizationId: orgId,

    status: 'PENDING'
  })

  const evaluationsByUserId = useMemo(() => {
    const map: Record<string, any> = {}
    if (!evaluationsData?.content) return map

    const getAuthorityWeight = (role?: string) => {
      switch (role) {
        case 'CEO': return 100
        case 'REGIONAL_DIRECTOR': return 90
        case 'DIRECTOR': return 80
        case 'DEPT_HEAD': return 40
        case 'TEAM_LEADER': return 20
        case 'SELF': return 0
        default: return 10
      }
    }

    // Sort evaluations so higher authority comes LAST (to overwrite in the map)
    const sortedEvals = [...evaluationsData.content].sort((a, b) => {
      return getAuthorityWeight(a.evaluatorRole) - getAuthorityWeight(b.evaluatorRole)
    })

    sortedEvals.forEach(ev => map[ev.userId] = ev)
    return map
  }, [evaluationsData])

  const pendingByUserId = useMemo(() => {
    const map: Record<string, number> = {}
    submissionsData?.content.forEach(s => {
      if (s.status === 'PENDING') {
        const isOwn = s.submittedById === user?.id
        const canReview = (!s.isSubmittedByManager || canManageOrg) && !isOwn
        if (canReview) {
          map[s.submittedById] = (map[s.submittedById] || 0) + 1
        }
      }
    })
    return map
  }, [submissionsData, user, canManageOrg])

  const isLoading = isLoadingUsers || isLoadingEvals || isLoadingSubs

  const [staffEvalUser, setStaffEvalUser] = useState<any>(null)
  const [detailEval, setDetailEval] = useState<any>(null)

  const handleRowClick = (emp: any) => {
    if (!selectedPeriodId || selectedPeriodId === 'ALL') return;
    
    const evaluation = evaluationsByUserId[emp.id]
    if (evaluation) {
      setDetailEval(evaluation)
    } else if (isManager) {
      setStaffEvalUser(emp)
    }
  }

  const stats = useMemo(() => {
    return {
      totalEmployees: usersData?.totalElements || 0,
      totalPending: Object.values(pendingByUserId).reduce((sum, count) => sum + count, 0),
      totalEvaluated: Object.keys(evaluationsByUserId).length
    }
  }, [usersData, pendingByUserId, evaluationsData])

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
        <PageTour pageKey="submissions-org" steps={orgUnitSubmissionsSteps} />
        
        {/* Header Section */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-[40px] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
          <div className="relative bg-white dark:bg-slate-900 rounded-[28px] p-6 border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
                  <FileCheck size={12} className="animate-pulse" /> Phê duyệt & Đánh giá
                </div>
                <div className="space-y-0.5">
                  <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                    Đánh giá <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">Nhân viên</span>
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm max-w-xl leading-relaxed">
                    Theo dõi tiến độ nộp KPI và đánh giá kết quả của đội ngũ nhân sự trong kỳ.
                  </p>
                </div>
              </div>

              <div id="tour-approve-stats" className="flex items-center gap-3">
                <StatChip label="Nhân sự" value={stats.totalEmployees} color="indigo" />
                <StatChip label="Chờ duyệt" value={stats.totalPending} color="amber" />
                <StatChip label="Đã đánh giá" value={stats.totalEvaluated} color="emerald" />
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div id="tour-approve-toolbar" className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-5 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex flex-col lg:flex-row items-center gap-4 w-full">
            <div className="relative flex-1 w-full lg:max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
              <input 
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0) }}
                placeholder="Tìm nhân viên..." 
                className="w-full pl-12 pr-4 h-13 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-sm font-medium focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto">
              {canManageOrg && (
                <div className="w-full md:w-56">
                  <Select value={selectedOrgUnitId} onValueChange={val => { setSelectedOrgUnitId(val); setPage(0) }}>
                    <SelectTrigger className="h-13 rounded-2xl border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 font-bold text-sm">
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-slate-400" />
                        <SelectValue placeholder="Chọn đơn vị..." />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2">
                      {flatOrgUnits.map(unit => (
                        <SelectItem key={unit.id} value={unit.id} className="font-medium rounded-xl focus:bg-emerald-50">{unit.levelLabel}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="w-full md:w-56">
                <Select value={selectedPeriodId} onValueChange={val => { setSelectedPeriodId(val); setPage(0) }}>
                  <SelectTrigger className="h-13 rounded-2xl border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 font-bold text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-slate-400" />
                      <SelectValue placeholder="Đợt KPI" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2">
                    <SelectItem value="ALL" className="font-black text-[10px] uppercase tracking-widest rounded-xl focus:bg-emerald-50">Tất cả các đợt</SelectItem>
                    {periodsData?.content.map((p: any) => (
                      <SelectItem key={p.id} value={p.id} className="font-medium rounded-xl focus:bg-emerald-50">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>


            </div>
          </div>
        </div>

        {/* Content Section */}
        {isLoading ? (
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
            <LoadingSkeleton type="table" rows={8} />
          </div>
        ) : employees.length === 0 ? (
          <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-[40px] border border-dashed border-slate-300 dark:border-slate-700 p-24 shadow-sm text-center">
            <EmptyState 
              title="Không có nhân sự" 
              description="Chưa có nhân sự nào trong danh sách." 
            />
          </div>
        ) : (
          <div id="tour-approve-table" className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[32px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Nhân viên</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center whitespace-nowrap">Bài nộp chờ duyệt</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center whitespace-nowrap">Đánh giá</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center whitespace-nowrap">Người chấm</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {employees.map((emp, i) => {
                    const pendingCount = pendingByUserId[emp.id] || 0
                    const evaluation = evaluationsByUserId[emp.id]

                    return (
                      <tr 
                        key={emp.id} 
                        onClick={() => handleRowClick(emp)}
                        className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all duration-300 animate-in fade-in slide-in-from-left-4 cursor-pointer"
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs border border-indigo-200/50 dark:border-indigo-800/30 shadow-inner">
                              {getInitials(emp.fullName)}
                            </div>
                            <div>
                              <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors block">
                                {emp.fullName}
                              </span>
                              {(() => {
                                // Priority 1: If evaluation exists, use its stored role name (most accurate for the period)
                                if (evaluation?.userRoleName) {
                                  return <span className="text-[10px] text-slate-400 font-medium">{evaluation.userRoleName}</span>
                                }

                                // Priority 2: Pick the best membership based on a robust multi-criteria sort (data-driven)
                                const memberships = [...(emp.memberships || [])]
                                if (memberships.length === 0) return <span className="text-[10px] text-slate-400 font-medium">Nhân viên</span>
                                
                                // Find the "Root" level for this specific employee (the highest unit they belong to)
                                const levels = memberships.map((m: any) => m.levelOrder ?? m.roleLevel ?? 0)
                                const minLevel = Math.min(...levels)
                                const hasDeeperLevel = levels.some(l => l > minLevel)

                                const bestMembership = memberships.sort((a: any, b: any) => {
                                  // 1. Deprioritize the root-most unit if deeper memberships exist
                                  if (hasDeeperLevel) {
                                    const isMinA = (a.levelOrder ?? a.roleLevel ?? 0) === minLevel ? 1 : 0
                                    const isMinB = (b.levelOrder ?? b.roleLevel ?? 0) === minLevel ? 1 : 0
                                    if (isMinA !== isMinB) return isMinA - isMinB
                                  }

                                  // 2. Rank priority (roleRank 0: Trưởng, 1: Phó, 2+: Nhân viên)
                                  const rankA = typeof a.roleRank === 'number' ? a.roleRank : 99
                                  const rankB = typeof b.roleRank === 'number' ? b.roleRank : 99
                                  if (rankA !== rankB) return rankA - rankB

                                  // 3. Current unit match
                                  if (selectedOrgUnitId !== 'ALL') {
                                    const matchA = String(a.orgUnitId) === String(selectedOrgUnitId) ? 0 : 1
                                    const matchB = String(b.orgUnitId) === String(selectedOrgUnitId) ? 0 : 1
                                    if (matchA !== matchB) return matchA - matchB
                                  }

                                  // 4. Depth priority (Deeper units like Dept/Team preferred)
                                  const levelA = a.levelOrder ?? a.roleLevel ?? 0
                                  const levelB = b.levelOrder ?? b.roleLevel ?? 0
                                  if (levelA !== levelB) return levelB - levelA // Higher number = deeper

                                  return 0
                                })[0]
                                
                                return (
                                  <span className="text-[10px] text-slate-400 font-medium">{bestMembership?.roleName || 'Nhân viên'}</span>
                                )
                              })()}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          {pendingCount > 0 ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 shadow-sm animate-pulse">
                              <Clock size={12} />
                              <span className="text-[10px] font-black uppercase tracking-widest">{pendingCount} chờ duyệt</span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-400 italic">Không có</span>
                          )}
                        </td>
                        <td className="px-6 py-5 text-center">
                          {evaluation ? (
                            <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border shadow-sm", getScoreBg(evaluation.score))}>
                              <span className={cn("text-xs font-black", getScoreColor(evaluation.score))}>{evaluation.score ?? '—'}</span>
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-l border-slate-200 dark:border-slate-700 pl-2 leading-none">
                                {getScoreLabel(evaluation.score)}
                              </span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                              <span className="text-[10px] font-black uppercase tracking-widest">Chưa đánh giá</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-5 text-center">
                          {evaluation ? (
                            <div className="flex flex-col items-center gap-1">
                               <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{evaluation.evaluatorName}</span>
                               <span className={cn(
                                "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border",
                                evaluation.evaluatorRole === 'SELF' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                               )}>
                                {evaluation.evaluatorRole === 'SELF' ? 'Tự chấm' : 
                                  evaluation.evaluatorRoleName || 'Quản lý'}
                               </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">—</span>
                          )}
                        </td>
                        <td className="px-8 py-5 text-right">
                          <button className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm border border-transparent hover:border-emerald-200 dark:hover:border-slate-700">
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
              Trang <span className="text-slate-900 dark:text-white">{page + 1}</span> / {usersData?.totalPages || 1}
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
              disabled={page >= (usersData?.totalPages || 1) - 1}
              className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {staffEvalUser && isManager && selectedPeriodId !== 'ALL' && (
          <StaffEvaluationModal
            open={!!staffEvalUser}
            onClose={() => setStaffEvalUser(null)}
            userId={staffEvalUser.id}
            userName={staffEvalUser.fullName}
            periodId={selectedPeriodId}
            periodName={periodsData?.content.find((p: any) => p.id === selectedPeriodId)?.name || ''}
          />
        )}
        
        {detailEval && (
          <EvaluationDetailModal 
            open={!!detailEval} 
            onClose={() => setDetailEval(null)} 
            evaluation={detailEval} 
          />
        )}
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
