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
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
      {/* Background decoration */}
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-50 dark:bg-indigo-900/20 rounded-full blur-2xl group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors" />
      
      <div className="flex justify-between items-start mb-4 relative">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">{title}</h3>
          <span className="text-[10px] text-indigo-500 font-bold" title="API độc lập">*</span>
        </div>
        {icon && (
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
            {icon}
          </div>
        )}
      </div>

      <div className="relative">
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <div className="h-8 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {value}
            </span>
          </div>
        )}
        
        {subtitle && !isLoading && (
          <p className="text-sm font-medium text-slate-500 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
