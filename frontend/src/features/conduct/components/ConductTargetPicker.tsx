import { useEffect, useMemo } from 'react'
import { CalendarRange, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useKpiCycles } from '@/features/kpi/hooks/useKpiCycles'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import ScopeSelectItems from '@/components/common/ScopeSelectItems'
import { pickCurrentOrNearest } from '@/components/common/dateScope'
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

  // Đợt/kỳ chọn sẵn là cái đang chạy, ở kẽ giữa hai đợt thì là cái vừa kết thúc — cái mới
  // nhất theo ngày bắt đầu có thể là một đợt tương lai còn xa, chấm hạnh kiểm ở đó là vô nghĩa.
  const defaultPeriod = useMemo(() => pickCurrentOrNearest(periods), [periods])
  const defaultCycle = useMemo(() => pickCurrentOrNearest(cycles), [cycles])

  // Vào trang là có sẵn đợt/kỳ, khỏi bắt người dùng chọn thêm một bước mới thấy bảng.
  useEffect(() => {
    if (value.scope === 'PERIOD' && !value.periodId && defaultPeriod) {
      onChange({ scope: 'PERIOD', periodId: defaultPeriod.id, cycleId: null })
    }
    if (value.scope === 'CYCLE' && !value.cycleId && defaultCycle) {
      onChange({ scope: 'CYCLE', cycleId: defaultCycle.id, periodId: null })
    }
  }, [value, defaultPeriod, defaultCycle, onChange])

  const setScope = (scope: ConductScope) => {
    // Đổi phạm vi thì chọn sẵn mục hiện tại — người dùng gần như luôn chấm đợt/kỳ đang chạy.
    if (scope === value.scope) return
    onChange(scope === 'PERIOD'
      ? { scope, periodId: defaultPeriod?.id ?? null, cycleId: null }
      : { scope, cycleId: defaultCycle?.id ?? null, periodId: null })
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
            <ScopeSelectItems
              items={periods}
              selectedId={value.periodId ?? undefined}
              renderLabel={p => `${p.name}${p.cycleName ? ` — ${p.cycleName}` : ''}`}
            />
          </SelectContent>
        </Select>
      ) : (
        <Select value={value.cycleId ?? ''} onValueChange={v => onChange({ scope: 'CYCLE', cycleId: v, periodId: null })}>
          <SelectTrigger className="w-[280px] h-10">
            <SelectValue placeholder="Chọn kỳ đánh giá" />
          </SelectTrigger>
          <SelectContent className="z-[1100]">
            <ScopeSelectItems items={cycles} selectedId={value.cycleId ?? undefined} noun="kỳ" />
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
