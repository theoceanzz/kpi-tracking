import { Loader2 } from 'lucide-react'

interface ObjectiveMetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  isLoading?: boolean
}

export default function ObjectiveMetricCard({ title, value, subtitle, icon, isLoading }: ObjectiveMetricCardProps) {
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-card p-5 shadow-sm transition-shadow relative overflow-hidden group">
      {/* Background decoration */}
      
      <div className="flex justify-between items-start mb-4 relative">
        <div className="flex items-center gap-1.5">
          <h3 className="text-section-title text-[var(--color-muted-foreground)]">{title}</h3>
          <span className="text-xs text-[var(--color-primary)] font-medium" title="API độc lập">*</span>
        </div>
        {icon && (
          <div className="p-2 bg-[var(--color-primary-soft)] rounded-control text-[var(--color-primary)]">
            {icon}
          </div>
        )}
      </div>

      <div className="relative">
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
            <div className="h-8 w-24 bg-[var(--color-muted)] rounded animate-pulse" />
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-[var(--color-foreground)] tracking-tight">
              {value}
            </span>
          </div>
        )}
        
        {subtitle && !isLoading && (
          <p className="text-sm font-medium text-[var(--color-muted-foreground)] mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
