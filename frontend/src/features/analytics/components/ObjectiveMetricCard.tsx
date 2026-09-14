
interface ObjectiveMetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  isLoading?: boolean
}

export default function ObjectiveMetricCard({ title, value, subtitle, icon, isLoading }: ObjectiveMetricCardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden">
      <div className="flex justify-between items-start mb-4 relative">
        <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400">{title}</h3>
        {icon && (
          <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-300">
            {icon}
          </div>
        )}
      </div>

      <div className="relative">
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900 dark:text-white">
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
