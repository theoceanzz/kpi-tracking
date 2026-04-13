interface PeriodSelectorProps {
  value: string
  onChange: (value: string) => void
}

export default function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <input
      type="month"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"
    />
  )
}
