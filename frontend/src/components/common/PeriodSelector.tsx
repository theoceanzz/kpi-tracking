import { LocaleDateInput } from '@/components/ui/date-input'
interface PeriodSelectorProps {
  value: string
  onChange: (value: string) => void
}

export default function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <LocaleDateInput
      type="month"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 rounded-control border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"
    />
  )
}
