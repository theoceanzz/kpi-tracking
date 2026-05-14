import { useState } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import { useMyKpi } from '../hooks/useMyKpi'
import { Link } from 'react-router-dom'
import { formatNumber, FREQUENCY_MAP, STATUS_CONFIG } from '@/lib/utils'
import { parseISO, isAfter } from 'date-fns'

import {
  Target, Search, Star,
  CheckCircle2, ChevronRight,
  LayoutGrid, List, ChevronLeft, Settings2, Filter, Calendar, GitBranch
} from 'lucide-react'

import { useAuthStore } from '@/store/authStore'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useObjectives } from '../../okr/hooks/useOkr'
import { useEvaluations } from '@/features/evaluations/hooks/useEvaluations'
import { useNavigate } from 'react-router-dom'
import KpiDetailModal from '../components/KpiDetailModal'

import KpiAdjustmentModal from '../components/KpiAdjustmentModal'
import type { KpiCriteria } from '@/types/kpi'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import PageTour from '@/components/common/PageTour'
import { myKpiSteps } from '@/components/common/tourSteps'
import { ObjectiveResponse } from '@/features/okr/types'





export default function MyKpiPage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)

  const [search, setSearch] = useState('')
  const [selectedPeriodId, setSelectedPeriodId] = useState('ALL')
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARD'>('TABLE')
  const [page, setPage] = useState(0)
  const [pageSize] = useState(10)
  const [sortBy] = useState('createdAt')
  const [sortDir] = useState<'asc' | 'desc'>('desc')
  const [viewKpi, setViewKpi] = useState<KpiCriteria | null>(null)
  const [adjustKpi, setAdjustKpi] = useState<KpiCriteria | null>(null)
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>('ALL')
  const [selectedKeyResultId, setSelectedKeyResultId] = useState<string>('ALL')

  const { data: periodsData } = useKpiPeriods({ organizationId: user?.memberships?.[0]?.organizationId })
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(organizationId)
  const enableOkr = org?.enableOkr
  
  const { data, isLoading } = useMyKpi({
    page,
    size: pageSize,
    kpiPeriodId: selectedPeriodId === 'ALL' ? undefined : selectedPeriodId,
    sortBy,
    sortDir,
    objectiveId: selectedObjectiveId === 'ALL' ? undefined : selectedObjectiveId,
    keyResultId: selectedKeyResultId === 'ALL' ? undefined : selectedKeyResultId
  })

  const { data: objectivesData } = useObjectives(user?.memberships?.[0]?.organizationId)
  
  const selectedObjective = objectivesData?.find((o: ObjectiveResponse) => o.id === selectedObjectiveId)
  const keyResults = selectedObjective?.keyResults || []
  
  const { data: myEvals } = useEvaluations({
    userId: user?.id,
    size: 100
  })


  const allKpis = (data?.content ?? []).filter(k => k.status === 'APPROVED' || k.status === 'EDITED')
  const filteredKpis = allKpis.filter(k => 
    k.name.toLowerCase().includes(search.toLowerCase())
  )

  // Group KPIs by period
  const kpisByPeriod = filteredKpis.reduce((acc: Record<string, any[]>, kpi) => {
    const periodId = kpi.kpiPeriodId || 'UNKNOWN'
    if (!acc[periodId]) acc[periodId] = []
    acc[periodId].push(kpi)
    return acc
  }, {})

  const periodIds = Object.keys(kpisByPeriod).sort((a, b) => {
    const periodA = periodsData?.content.find(p => p.id === a)
    const periodB = periodsData?.content.find(p => p.id === b)
    if (!periodA || !periodB) return 0
    return new Date(periodB.startDate || 0).getTime() - new Date(periodA.startDate || 0).getTime()
  })


  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6 space-y-6 animate-in fade-in duration-500 transition-all duration-500 ease-in-out">
      <PageTour pageKey="my-kpi" steps={myKpiSteps} />
      
      {/* Refined Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all">
        <div className="space-y-1 shrink-0">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Target size={18} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">Mục tiêu cá nhân</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            Danh sách KPI của tôi
          </h1>
        </div>

        <div id="tour-my-kpi-toolbar" className="flex flex-col gap-3 w-full lg:flex-1 lg:max-w-4xl">
          <div className="flex flex-col md:flex-row items-center gap-3 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0) }}
                placeholder="Tìm tên KPI..." 
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              />
            </div>

            <div className="relative w-full md:w-64">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <Select value={selectedPeriodId} onValueChange={val => { setSelectedPeriodId(val); setPage(0) }}>
                <SelectTrigger className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm shadow-sm h-10 [&>span]:line-clamp-1 [&>span]:truncate">
                  <SelectValue placeholder="Tất cả kỳ..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-[var(--color-border)] shadow-lg max-h-[300px]">
                  <SelectItem value="ALL" className="font-medium cursor-pointer rounded-lg text-sm truncate">Tất cả kỳ...</SelectItem>
                  {periodsData?.content.map(p => (
                    <SelectItem key={p.id} value={p.id} className="font-medium cursor-pointer rounded-lg text-sm truncate">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
              <button 
                onClick={() => setViewMode('TABLE')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'TABLE' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400'}`}
              >
                <List size={18} />
              </button>
              <button 
                onClick={() => setViewMode('CARD')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'CARD' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400'}`}
              >
                <LayoutGrid size={18} />
              </button>
            </div>
          </div>

          {enableOkr && (
            <div className="flex flex-col md:flex-row items-center gap-3 w-full">
              <div className="relative flex-1">
                <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={14} />
                <Select value={selectedObjectiveId} onValueChange={(v) => { setSelectedObjectiveId(v); setSelectedKeyResultId('ALL'); setPage(0) }}>
                  <SelectTrigger className="w-full pl-10 pr-4 py-2.5 h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm [&>span]:line-clamp-1 [&>span]:truncate">
                    <SelectValue placeholder="Chọn Mục tiêu" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 shadow-lg">
                    <SelectItem value="ALL" className="font-bold truncate">Tất cả Mục tiêu</SelectItem>
                    {objectivesData?.map(obj => (
                      <SelectItem key={obj.id} value={obj.id} className="font-medium truncate">[{obj.code}] {obj.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative flex-1">
                <GitBranch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={14} />
                <Select value={selectedKeyResultId} onValueChange={(v) => { setSelectedKeyResultId(v); setPage(0) }} disabled={selectedObjectiveId === 'ALL'}>
                  <SelectTrigger className="w-full pl-10 pr-4 py-2.5 h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm [&>span]:line-clamp-1 [&>span]:truncate">
                    <SelectValue placeholder="Chọn Kết quả" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 shadow-lg">
                    <SelectItem value="ALL" className="font-bold truncate">Tất cả Kết quả</SelectItem>
                    {keyResults.map(kr => (
                      <SelectItem key={kr.id} value={kr.id} className="font-medium truncate">[{kr.code}] {kr.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </div>

      <div id="tour-my-kpi-table" className="min-h-[400px]">
        {isLoading ? (
          <LoadingSkeleton type="table" rows={6} />
        ) : filteredKpis.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-20 shadow-sm transition-all">
            <EmptyState 
              title={search || selectedPeriodId ? "Không tìm thấy" : "Trống"} 
              description="Bạn chưa có chỉ tiêu KPI nào trong danh sách hiện tại." 
            />
          </div>
        ) : viewMode === 'TABLE' ? (
          <div className="space-y-8">
            {periodIds.map(periodId => {
              const periodKpis = kpisByPeriod[periodId]
              if (!periodKpis) return null
              
              const period = periodsData?.content.find(p => p.id === periodId)

              const isPeriodDone = periodKpis.every(k => k.submissionCount >= (k.expectedSubmissions || 1))
              const hasEvaluation = myEvals?.content.some(ev => ev.kpiPeriodId === periodId && ev.evaluatorId === user?.id)
              
              return (
                <div key={periodId} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-all">
                  <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
                        <Calendar size={16} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{period?.name || 'Không xác định'}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {period?.startDate ? new Date(period.startDate).toLocaleDateString('vi-VN') : '—'} - {period?.endDate ? new Date(period.endDate).toLocaleDateString('vi-VN') : '—'}
                        </p>
                      </div>
                    </div>
                    
                    {isPeriodDone && !hasEvaluation && (
                      <button 
                        onClick={() => navigate(`/evaluations?action=self-eval&periodId=${periodId}`)}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-amber-500/20"
                      >
                        <Star size={14} className="fill-current" /> Tiến hành Tự đánh giá
                      </button>
                    )}

                    {isPeriodDone && hasEvaluation && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-[10px] font-black uppercase tracking-widest">
                        <CheckCircle2 size={14} /> Đã hoàn thành đánh giá
                      </div>
                    )}
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/20 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
                          <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Trạng thái</th>
                          <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Chỉ tiêu</th>
                          {enableOkr && (
                            <>
                              <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Mục tiêu (OKR)</th>
                              <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Kết quả (KR)</th>
                            </>
                          )}
                          <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right whitespace-nowrap">Mục tiêu</th>
                          <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center whitespace-nowrap">Trọng số</th>
                          <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Tiến độ</th>
                          <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Hạn nộp</th>
                          <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right whitespace-nowrap">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {periodKpis.map((kpi) => (
                          <MyKpiTableRow 
                            key={kpi.id} 
                            kpi={kpi}
                            enableOkr={enableOkr}
                            onView={() => setViewKpi(kpi)} 
                            onAdjust={() => setAdjustKpi(kpi)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>

      ) : (
        <div className="space-y-12">
          {periodIds.map(periodId => {
            const periodKpis = kpisByPeriod[periodId]
            if (!periodKpis) return null

            const period = periodsData?.content.find(p => p.id === periodId)

            const isPeriodDone = periodKpis.every(k => k.submissionCount >= (k.expectedSubmissions || 1))
            const hasEvaluation = myEvals?.content.some(ev => ev.kpiPeriodId === periodId && ev.evaluatorId === user?.id)

            return (
              <div key={periodId} className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-indigo-600 border border-slate-100 dark:border-slate-800">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">{period?.name || 'Không xác định'}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {period?.startDate ? new Date(period.startDate).toLocaleDateString('vi-VN') : '—'} - {period?.endDate ? new Date(period.endDate).toLocaleDateString('vi-VN') : '—'}
                      </p>
                    </div>
                  </div>

                  {isPeriodDone && !hasEvaluation && (
                    <button 
                      onClick={() => navigate(`/evaluations?action=self-eval&periodId=${periodId}`)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[1px] transition-all shadow-xl shadow-amber-500/20"
                    >
                      <Star size={16} className="fill-current" /> Tự đánh giá ngay
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 transition-all duration-500">
                  {periodKpis.map((kpi, idx) => (
                    <MyKpiCard 
                      key={kpi.id} 
                      kpi={kpi} 
                      delay={idx * 40} 
                      onView={() => setViewKpi(kpi)} 
                      onAdjust={() => setAdjustKpi(kpi)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

      )}
      </div>

      {/* Pagination & Modals (remains similar but refined) */}
      <KpiDetailModal open={!!viewKpi} onClose={() => setViewKpi(null)} kpi={viewKpi} />
      <KpiAdjustmentModal open={!!adjustKpi} onClose={() => setAdjustKpi(null)} kpi={adjustKpi} />

      {data && data.totalElements > 0 && (
        <div className="flex items-center justify-between pt-4 transition-all">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            {page * pageSize + 1}-{Math.min((page + 1) * pageSize, data.totalElements)} / {data.totalElements} KPI
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-50 transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(data.totalPages - 1, p + 1))}
              disabled={page === data.totalPages - 1}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-50 transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MyKpiTableRow({ kpi, enableOkr, onView, onAdjust }: { kpi: KpiCriteria; enableOkr?: boolean; onView: () => void; onAdjust: () => void }) {
  const status = STATUS_CONFIG[kpi.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG['DRAFT']!
  const nextDeadline = getNextDeadline(kpi)
  const now = new Date()
  const isOverdue = nextDeadline && isAfter(now, nextDeadline)
  
  const isStarted = !kpi.kpiPeriod?.startDate || !isAfter(parseISO(kpi.kpiPeriod.startDate), now)

  
  return (
    <tr className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
      <td className="px-3 py-4 whitespace-nowrap">
        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${status.bgColor} ${status.color}`}>
          {status.label}
        </div>
      </td>
      <td className="px-3 py-4">
        <button onClick={onView} className="text-left focus:outline-none flex flex-col gap-1 min-w-[100px]">
          <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">{kpi.name}</span>
          <span className="text-[9px] text-slate-400 font-black uppercase bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded w-fit whitespace-nowrap">{FREQUENCY_MAP[kpi.frequency as keyof typeof FREQUENCY_MAP]}</span>
        </button>
      </td>
      {enableOkr && (
        <>
          <td className="px-3 py-4">
            <div className="flex flex-col gap-0.5 min-w-[100px]">
              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tight whitespace-nowrap">{kpi.objectiveCode || 'N/A'}</span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 line-clamp-2 leading-tight">{kpi.objectiveName || 'N/A'}</span>
            </div>
          </td>
          <td className="px-3 py-4">
            <div className="flex flex-col gap-0.5 min-w-[100px]">
              <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-tight whitespace-nowrap">{kpi.keyResultCode || 'N/A'}</span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 line-clamp-2 leading-tight">{kpi.keyResultName || 'N/A'}</span>
            </div>
          </td>
        </>
      )}
      <td className="px-3 py-4 text-right whitespace-nowrap">
        <span className="text-sm font-black text-slate-900 dark:text-white">
          {formatNumber(kpi.targetValue || 0)} <span className="text-[10px] text-slate-400 font-medium">{kpi.unit}</span>
        </span>
      </td>
      <td className="px-3 py-4 text-center whitespace-nowrap">
        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-lg">
          {kpi.weight}%
        </span>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <span className={`text-xs font-black ${kpi.submissionCount < (kpi.expectedSubmissions || 1) ? 'text-amber-600' : 'text-emerald-600'}`}>
          {kpi.submissionCount || 0}/{kpi.expectedSubmissions || 1} lần
        </span>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <span className={`text-[11px] font-bold ${isOverdue ? 'text-red-500' : 'text-slate-500'}`}>
          {nextDeadline?.toLocaleDateString('vi-VN') || '—'}
        </span>
      </td>
      <td className="px-3 py-4 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-2">
          {kpi.submissionCount < (kpi.expectedSubmissions || 1) && (
            <button onClick={onAdjust} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-lg transition-all">
              <Settings2 size={16} />
            </button>
          )}
          {kpi.submissionCount < (kpi.expectedSubmissions || 1) ? (
            isStarted ? (
              <Link to={`/submissions/new?kpiId=${kpi.id}`} className="px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white hover:bg-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                Nộp bài
              </Link>
            ) : (
              <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 cursor-not-allowed">
                Chưa mở
              </div>
            )
          ) : (

             <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
               <CheckCircle2 size={12} /> Đã Xong
             </div>
          )}
        </div>
      </td>
    </tr>
  )
}

function MyKpiCard({ kpi, delay, onView, onAdjust }: { kpi: KpiCriteria; delay: number; onView: () => void; onAdjust: () => void }) {
  const status = STATUS_CONFIG[kpi.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG['DRAFT']!
  const now = new Date()


  return (
    <div 
      className="group bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 flex flex-col h-full overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="p-5 flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
            <Target size={20} />
          </div>
          <div className={`px-3 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${status.bgColor} ${status.color}`}>
            {status.label}
          </div>
        </div>

        <button onClick={onView} className="text-left w-full group-hover:text-indigo-600 transition-colors">
          <h3 className="text-lg font-black text-slate-900 dark:text-white line-clamp-2 leading-tight">{kpi.name}</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{FREQUENCY_MAP[kpi.frequency as keyof typeof FREQUENCY_MAP]}</p>
        </button>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Mục tiêu</p>
            <p className="text-sm font-black text-slate-900 dark:text-white">{formatNumber(kpi.targetValue ?? 0)} <span className="text-[10px]">{kpi.unit}</span></p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Trọng số</p>
            <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{kpi.weight}%</p>
          </div>
        </div>
      </div>

      <div className="p-5 pt-0 mt-auto flex items-center gap-3">
        {kpi.submissionCount < (kpi.expectedSubmissions || 1) && (
          <button onClick={onAdjust} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all">
            <Settings2 size={18} />
          </button>
        )}
        {kpi.submissionCount < (kpi.expectedSubmissions || 1) ? (
          (!kpi.kpiPeriod?.startDate || !isAfter(parseISO(kpi.kpiPeriod.startDate), now)) ? (
            <Link to={`/submissions/new?kpiId=${kpi.id}`} className="flex-1 px-6 py-3 bg-slate-900 dark:bg-slate-800 text-white hover:bg-indigo-600 rounded-2xl font-black text-xs text-center transition-all uppercase tracking-widest">
              Nộp báo cáo
            </Link>
          ) : (
            <div className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl font-black text-xs text-center uppercase tracking-widest border border-slate-200 dark:border-slate-700 cursor-not-allowed">
              Chưa mở nộp
            </div>
          )
        ) : (

          <div className="flex-1 px-6 py-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl font-black text-xs text-center flex items-center justify-center gap-2 uppercase tracking-widest">
            <CheckCircle2 size={16} /> Hoàn thành
          </div>
        )}
      </div>
    </div>
  )
}

function getNextDeadline(kpi: KpiCriteria) {
  if (!kpi.kpiPeriod?.startDate || !kpi.kpiPeriod?.endDate) return null
  const start = parseISO(kpi.kpiPeriod.startDate).getTime()
  const end = parseISO(kpi.kpiPeriod.endDate).getTime()

  const totalSubmissions = kpi.expectedSubmissions || 1
  const currentSub = kpi.submissionCount || 0
  if (currentSub >= totalSubmissions) return new Date(end)
  const duration = end - start
  const subDuration = duration / totalSubmissions
  return new Date(start + (currentSub + 1) * subDuration)
}
