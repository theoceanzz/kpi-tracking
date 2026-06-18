import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

interface PeriodFilterSelectProps {
  /** id của đợt đang chọn; undefined = "Tất cả các đợt". */
  value?: string
  onChange: (periodId: string | undefined) => void
  className?: string
}

/**
 * Bộ chọn "Đợt" (KpiPeriod) dùng chung cho các trang thống kê.
 * Mặc định hiển thị "Tất cả các đợt"; khi chọn một đợt sẽ trả về id của đợt đó.
 */
export default function PeriodFilterSelect({ value, onChange, className }: PeriodFilterSelectProps) {
  const user = useAuthStore(s => s.user)
  const organizationId = user?.memberships?.[0]?.organizationId

  const { data } = useKpiPeriods({
    organizationId,
    size: 1000,
    sortBy: 'startDate',
    direction: 'desc',
  })
  const periods = data?.content ?? []

  return (
    <select
      className={cn(
        'h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-violet-500/50',
        className
      )}
      value={value ?? ''}
      onChange={e => onChange(e.target.value || undefined)}
    >
      <option value="">Tất cả các đợt</option>
      {periods.map(p => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  )
}
