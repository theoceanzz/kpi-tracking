import { TrendingUp, Percent } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TrendMode } from './useTrendMode'
import { ChoiceChip } from '@/components/ui/choice-chip'

/**
 * Cặp nút chuyển xu hướng ↔ cơ cấu 100%, đặt trong header của biểu đồ xu hướng.
 * State do {@link useTrendMode} giữ để lựa chọn được nhớ lại giữa các lần mở trang.
 *
 * <p>Có nhãn chữ chứ không chỉ biểu tượng như {@link ViewToggleButtons}: "biểu đồ hay bảng" nhìn
 * icon là đoán ra, còn "mức độ hay cơ cấu" thì không.
 */
export function TrendModeToggle({ mode, onChange, className }: {
  mode: TrendMode
  onChange: (m: TrendMode) => void
  className?: string
}) {
  const options = [
    { value: 'trend' as const, icon: <TrendingUp size={12} />, label: 'Xu hướng', title: 'Xem mức độ theo thời gian' },
    { value: 'share' as const, icon: <Percent size={12} />, label: 'Cơ cấu %', title: 'Xem tỉ trọng thành phần, mỗi mốc cao đúng 100%' },
  ]
  return (
    <div className={cn('flex items-center gap-0.5 bg-[var(--color-muted)] rounded-control p-0.5 shrink-0', className)}>
      {options.map(o => (
        <ChoiceChip selected={mode === o.value} variant="segment" size="sm" className="py-1" key={o.value} onClick={() => onChange(o.value)} title={o.title} aria-pressed={mode === o.value}>
          {o.icon}
          <span>{o.label}</span>
        </ChoiceChip>
      ))}
    </div>
  )
}

export default TrendModeToggle
