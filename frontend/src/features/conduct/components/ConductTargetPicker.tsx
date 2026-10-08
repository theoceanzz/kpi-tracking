import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { History, ChevronUp } from 'lucide-react'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useKpiCycles } from '@/features/kpi/hooks/useKpiCycles'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { isPastScope, pickCurrentOrNearest } from '@/components/common/dateScope'
import type { ConductTarget } from '../api/conductApi'
import { useTranslation } from 'react-i18next'

/**
 * Chọn đợt hoặc kỳ để chấm hạnh kiểm — MỘT ô duy nhất, cùng kiểu với bộ lọc kỳ / đợt ở BSC và OKR:
 * mỗi kỳ là một nhóm gồm "Cả kỳ …" (chấm theo kỳ) và các đợt con (chấm theo đợt).
 *
 * Trước đây là hai nút "Theo đợt / Theo kỳ" rồi mới tới ô chọn — hai bước cho một lựa chọn, và
 * người dùng phải biết trước mình chấm theo đợt hay theo kỳ mới tìm được đúng mục.
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
  const { t: tr } = useTranslation('conduct')
  const { data: cyclesData } = useKpiCycles({
    organizationId, size: 100, sortBy: 'startDate', direction: 'desc',
  })
  const { data: periodsData } = useKpiPeriods({
    organizationId, size: 200, sortBy: 'startDate', direction: 'desc',
  })
  // Memo hoá vì effect chọn sẵn mục mới nhất phụ thuộc vào hai mảng này — không memo thì
  // mảng đổi tham chiếu mỗi lần render và effect chạy lại vô ích sau mỗi phím gõ ở trang cha.
  const cycles = useMemo(() => cyclesData?.content ?? [], [cyclesData])
  const periods = useMemo(() => periodsData?.content ?? [], [periodsData])

  // Mặc định chấm theo ĐỢT đang chạy (ở kẽ giữa hai đợt thì đợt vừa kết thúc) — việc thường gặp nhất.
  const defaultPeriod = useMemo(() => pickCurrentOrNearest(periods), [periods])
  useEffect(() => {
    if (!value.periodId && !value.cycleId && defaultPeriod) {
      onChange({ scope: 'PERIOD', periodId: defaultPeriod.id, cycleId: null })
    }
  }, [value, defaultPeriod, onChange])

  // Kỳ đã qua thu gọn sau một nút — tồn thêm mỗi năm mà gần như không ai chấm lại.
  const [showPast, setShowPast] = useState(false)
  const selectedCycleId = value.scope === 'CYCLE'
    ? value.cycleId
    : periods.find(p => p.id === value.periodId)?.cycleId ?? null
  const groups = useMemo(() => cycles.map(c => ({
    cycle: c,
    periods: periods.filter(p => p.cycleId === c.id),
    past: isPastScope(c),
  })), [cycles, periods])
  const visibleGroups = groups.filter(g => showPast || !g.past || g.cycle.id === selectedCycleId)
  const hiddenPast = groups.length - visibleGroups.length
  const orphanPeriods = periods.filter(p => !p.cycleId)

  const selectValue = value.scope === 'CYCLE'
    ? (value.cycleId ? `cycle:${value.cycleId}` : undefined)
    : (value.periodId ? `period:${value.periodId}` : undefined)

  const select = (v: string) => {
    const [kind, id] = v.split(':') as ['cycle' | 'period', string]
    onChange(kind === 'cycle'
      ? { scope: 'CYCLE', cycleId: id, periodId: null }
      : { scope: 'PERIOD', periodId: id, cycleId: null })
  }

  const toggle = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); setShowPast(v => !v) }
  const toggleClass =
    'text-eyebrow mt-1 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-control px-2 py-1.5 hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]'

  return (
    <Select value={selectValue} onValueChange={select}>
      <SelectTrigger className="w-full sm:w-auto sm:min-w-72" aria-label={tr('ConductTargetPicker.chooseCyclePeriod')}>
        <SelectValue placeholder={tr('ConductTargetPicker.chooseCyclePeriod')} />
      </SelectTrigger>
      <SelectContent>
        {visibleGroups.map(({ cycle, periods: ps }) => (
          <SelectGroup key={cycle.id}>
            <SelectLabel>{cycle.name}</SelectLabel>
            <SelectItem value={`cycle:${cycle.id}`}>{tr('ConductTargetPicker.wholeCycle', { name: cycle.name })}</SelectItem>
            {ps.map(p => (
              <SelectItem key={p.id} value={`period:${p.id}`}><span className="pl-3">{p.name}</span></SelectItem>
            ))}
          </SelectGroup>
        ))}
        {orphanPeriods.length > 0 && (
          <SelectGroup>
            <SelectLabel>{tr('ConductTargetPicker.periodsWithoutCycle')}</SelectLabel>
            {orphanPeriods.map(p => <SelectItem key={p.id} value={`period:${p.id}`}>{p.name}</SelectItem>)}
          </SelectGroup>
        )}
        {hiddenPast > 0 && (
          <button type="button" onClick={toggle} className={toggleClass}>
            <History size={13} /> {tr('ConductTargetPicker.showPastCycles', { count: hiddenPast })}
          </button>
        )}
        {showPast && groups.some(g => g.past) && (
          <button type="button" onClick={toggle} className={toggleClass}>
            <ChevronUp size={13} /> {tr('ConductTargetPicker.hidePastCycles')}
          </button>
        )}
      </SelectContent>
    </Select>
  )
}
