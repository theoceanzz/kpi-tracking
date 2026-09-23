
interface ObjectiveMetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  isLoading?: boolean
}

export default function ObjectiveMetricCard({ title, value, subtitle, icon, isLoading }: ObjectiveMetricCardProps) {
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-5 relative overflow-hidden">
      <div className="flex justify-between items-start mb-4 relative">
        <h3 className="text-xs font-medium text-[var(--color-muted-foreground)]">{title}</h3>
        {icon && (
          <div className="p-2 bg-[var(--color-muted)] rounded-lg text-slate-500 dark:text-slate-300">
            {icon}
          </div>
        )}
      </div>

      <div className="relative">
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 bg-[var(--color-muted)] rounded animate-pulse" />
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-[var(--color-foreground)]">
              {value}
            </span>
          </div>
        )}
        
        {subtitle && !isLoading && (
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
