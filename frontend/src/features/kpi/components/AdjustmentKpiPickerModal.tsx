import { useMemo, useState } from 'react'
import { isAfter, parseISO } from 'date-fns'
import {
  Search, Target, Award,
  Loader2, ChevronRight, Clock
} from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
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
    <Dialog
      open
      onClose={onClose}
      size="lg"
      flush
      title="Chọn chỉ tiêu cần điều chỉnh"
      description="Chỉ hiện chỉ tiêu còn có thể điều chỉnh"
    >
      <div className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-card)] px-5 py-3">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-subtle-foreground)]" aria-hidden="true" />
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="Tìm theo tên chỉ tiêu..."
            aria-label="Tìm chỉ tiêu"
            className="h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-subtle-foreground)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          />
        </div>
      </div>

      <div className="p-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-[var(--color-subtle-foreground)]">
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
                    'w-full text-left p-4 rounded-card border transition-all group',
                    isPending
                      ? 'border-[var(--color-border)] bg-[var(--color-muted)] cursor-not-allowed opacity-70'
                      : 'border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm font-medium text-[var(--color-foreground)] truncate">{kpi.name}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {kpi.targetValue !== null && (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-control bg-[var(--color-primary-soft)] text-[var(--color-primary)] border border-[var(--color-border)]">
                            <Target size={12} />
                            <span className="text-eyebrow">
                              {formatNumber(kpi.targetValue)} {kpi.unit}
                            </span>
                          </div>
                        )}
                        {kpi.weight !== null && (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-control bg-[var(--color-primary-soft)] text-[var(--color-primary)] border border-[var(--color-border)]">
                            <Award size={12} />
                            <span className="text-eyebrow">{kpi.weight}%</span>
                          </div>
                        )}
                        {kpi.kpiPeriod?.name && (
                          <div className="flex items-center gap-1.5 text-[var(--color-subtle-foreground)]">
                            <Clock size={12} />
                            <span className="text-eyebrow">{kpi.kpiPeriod.name}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {isPending ? (
                      <span className="text-eyebrow shrink-0 px-2 py-1 rounded-control bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]">
                        Đang chờ duyệt
                      </span>
                    ) : (
                      <ChevronRight size={18} className="shrink-0 mt-1 text-[var(--color-subtle-foreground)] group-hover:text-[var(--color-primary)] transition-colors" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </Dialog>
  )
}
