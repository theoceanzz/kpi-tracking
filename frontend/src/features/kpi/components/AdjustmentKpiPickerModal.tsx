import { useMemo, useState } from 'react'
import { isAfter, parseISO } from 'date-fns'
import {
  X, Search, Settings2, Target, Award,
  Loader2, ChevronRight, Clock
} from 'lucide-react'
import { useMyKpi } from '../hooks/useMyKpi'
import { useMyAdjustments } from '../hooks/useMyAdjustments'
import EmptyState from '@/components/common/EmptyState'
import { cn, formatNumber } from '@/lib/utils'
import type { KpiCriteria } from '@/types/kpi'

interface AdjustmentKpiPickerModalProps {
  onClose: () => void
  onSelect: (kpi: KpiCriteria) => void
}

export default function AdjustmentKpiPickerModal({ onClose, onSelect }: AdjustmentKpiPickerModalProps) {
  const [keyword, setKeyword] = useState('')

  const { data, isLoading } = useMyKpi({ page: 0, size: 200, sortBy: 'createdAt', sortDir: 'desc' })
  const { data: adjustmentData } = useMyAdjustments({ page: 0, size: 200 })

  const pendingKpiIds = useMemo(
    () => new Set((adjustmentData?.content ?? []).filter(a => a.status === 'PENDING').map(a => a.kpiCriteriaId)),
    [adjustmentData]
  )

  const adjustableKpis = useMemo(() => {
    const now = new Date()
    return (data?.content ?? []).filter(kpi => {
      const isPeriodEnded = !!kpi.kpiPeriod?.endDate && isAfter(now, parseISO(kpi.kpiPeriod.endDate))
      return kpi.submissionCount < (kpi.expectedSubmissions || 1) && !isPeriodEnded
    })
  }, [data])

  const filteredKpis = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return adjustableKpis
    return adjustableKpis.filter(kpi => kpi.name.toLowerCase().includes(q))
  }, [adjustableKpis, keyword])

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-900/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
              <Settings2 size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Chọn chỉ tiêu cần điều chỉnh</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chỉ hiện KPI còn có thể điều chỉnh</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Search */}
        <div className="p-6 pb-4">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="Tìm theo tên chỉ tiêu..."
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : filteredKpis.length === 0 ? (
            <EmptyState
              title="Không có chỉ tiêu phù hợp"
              description={
                keyword
                  ? 'Không tìm thấy chỉ tiêu nào khớp với từ khoá.'
                  : 'Bạn không còn chỉ tiêu nào có thể xin điều chỉnh (đã nộp đủ báo cáo hoặc đợt đã kết thúc).'
              }
            />
          ) : (
            <div className="space-y-2">
              {filteredKpis.map(kpi => {
                const isPending = pendingKpiIds.has(kpi.id)
                return (
                  <button
                    key={kpi.id}
                    type="button"
                    disabled={isPending}
                    onClick={() => onSelect(kpi)}
                    className={cn(
                      'w-full text-left p-4 rounded-2xl border transition-all group',
                      isPending
                        ? 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 cursor-not-allowed opacity-70'
                        : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{kpi.name}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          {kpi.targetValue !== null && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 border border-indigo-100 dark:border-indigo-900/30">
                              <Target size={12} />
                              <span className="text-[10px] font-black uppercase tracking-widest">
                                {formatNumber(kpi.targetValue)} {kpi.unit}
                              </span>
                            </div>
                          )}
                          {kpi.weight !== null && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-600 border border-violet-100 dark:border-violet-900/30">
                              <Award size={12} />
                              <span className="text-[10px] font-black uppercase tracking-widest">{kpi.weight}%</span>
                            </div>
                          )}
                          {kpi.kpiPeriod?.name && (
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <Clock size={12} />
                              <span className="text-[10px] font-bold uppercase tracking-widest">{kpi.kpiPeriod.name}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {isPending ? (
                        <span className="shrink-0 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 border border-amber-100 dark:border-amber-900/30 text-[10px] font-black uppercase tracking-widest">
                          Đang chờ duyệt
                        </span>
                      ) : (
                        <ChevronRight size={18} className="shrink-0 mt-1 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
