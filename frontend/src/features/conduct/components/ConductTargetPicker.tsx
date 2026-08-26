import { useEffect, useMemo } from 'react'
import { CalendarRange, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useKpiCycles } from '@/features/kpi/hooks/useKpiCycles'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import type { ConductScope, ConductTarget } from '../api/conductApi'

/**
 * Chọn chấm hạnh kiểm theo ĐỢT hay theo KỲ, rồi chọn đúng đợt/kỳ đó.
 *
 * Hai phạm vi dùng chung một chỗ chọn thay vì hai bộ lọc rời: người dùng chỉ chấm một
 * trong hai tại một thời điểm, tách ra chỉ tạo ra tổ hợp vô nghĩa (chọn cả đợt lẫn kỳ).
 */
export default function ConductTargetPicker({
  organizationId,
  value,
  onChange,
}: {
  organizationId?: string
  value: ConductTarget
  onChange: (t: ConductTarget) => void
}) {
  const { data: cyclesData } = useKpiCycles({
    organizationId, size: 100, sortBy: 'startDate', direction: 'desc',
  })
  const { data: periodsData } = useKpiPeriods({
    organizationId, size: 100, sortBy: 'startDate', direction: 'desc',
  })
  // Memo hoá vì effect chọn sẵn mục mới nhất phụ thuộc vào hai mảng này — không memo thì
  // mảng đổi tham chiếu mỗi lần render và effect chạy lại vô ích sau mỗi phím gõ ở trang cha.
  const cycles = useMemo(() => cyclesData?.content ?? [], [cyclesData])
  const periods = useMemo(() => periodsData?.content ?? [], [periodsData])

  // Vào trang là có sẵn đợt/kỳ gần nhất, khỏi bắt người dùng chọn thêm một bước mới thấy bảng.
  useEffect(() => {
    const firstPeriod = periods[0]
    const firstCycle = cycles[0]
    if (value.scope === 'PERIOD' && !value.periodId && firstPeriod) {
      onChange({ scope: 'PERIOD', periodId: firstPeriod.id, cycleId: null })
    }
    if (value.scope === 'CYCLE' && !value.cycleId && firstCycle) {
      onChange({ scope: 'CYCLE', cycleId: firstCycle.id, periodId: null })
    }
  }, [value, periods, cycles, onChange])

  const setScope = (scope: ConductScope) => {
    // Đổi phạm vi thì chọn sẵn mục mới nhất — người dùng gần như luôn chấm đợt/kỳ gần nhất.
    if (scope === value.scope) return
    onChange(scope === 'PERIOD'
      ? { scope, periodId: periods[0]?.id ?? null, cycleId: null }
      : { scope, cycleId: cycles[0]?.id ?? null, periodId: null })
  }

  const tab = (scope: ConductScope, label: string, Icon: typeof CalendarDays) => (
    <button
      onClick={() => setScope(scope)}
      className={cn(
        'flex items-center gap-2 px-4 h-10 rounded-xl text-xs font-black uppercase tracking-widest transition-all',
        value.scope === scope
          ? 'bg-[var(--color-primary)] text-white shadow-sm'
          : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)]'
      )}
    >
      <Icon size={14} /> {label}
    </button>
  )

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        {tab('PERIOD', 'Theo đợt', CalendarDays)}
        {tab('CYCLE', 'Theo kỳ', CalendarRange)}
      </div>

      {value.scope === 'PERIOD' ? (
        <Select value={value.periodId ?? ''} onValueChange={v => onChange({ scope: 'PERIOD', periodId: v, cycleId: null })}>
          <SelectTrigger className="w-[280px] h-10">
            <SelectValue placeholder="Chọn đợt đánh giá" />
          </SelectTrigger>
          <SelectContent className="z-[1100]">
            {periods.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}{p.cycleName ? ` — ${p.cycleName}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Select value={value.cycleId ?? ''} onValueChange={v => onChange({ scope: 'CYCLE', cycleId: v, periodId: null })}>
          <SelectTrigger className="w-[280px] h-10">
            <SelectValue placeholder="Chọn kỳ đánh giá" />
          </SelectTrigger>
          <SelectContent className="z-[1100]">
            {cycles.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
