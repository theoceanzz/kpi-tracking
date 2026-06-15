import { AlertTriangle, TrendingDown, TrendingUp, ArrowUpRight, ArrowDownRight, Sparkles, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InsightCard, InsightType } from '../api/aiApi'

const TYPE_STYLES: Record<InsightType, { icon: typeof AlertTriangle; ring: string; chip: string; iconColor: string }> = {
  DEADLINE_RISK: {
    icon: AlertTriangle,
    ring: 'border-red-200 dark:border-red-900/50 hover:border-red-300',
    chip: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    iconColor: 'text-red-500',
  },
  BELOW: {
    icon: TrendingDown,
    ring: 'border-orange-200 dark:border-orange-900/50 hover:border-orange-300',
    chip: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    iconColor: 'text-orange-500',
  },
  DROP: {
    icon: ArrowDownRight,
    ring: 'border-amber-200 dark:border-amber-900/50 hover:border-amber-300',
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    iconColor: 'text-amber-500',
  },
  SPIKE: {
    icon: ArrowUpRight,
    ring: 'border-blue-200 dark:border-blue-900/50 hover:border-blue-300',
    chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    iconColor: 'text-blue-500',
  },
  EXCEED: {
    icon: TrendingUp,
    ring: 'border-emerald-200 dark:border-emerald-900/50 hover:border-emerald-300',
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    iconColor: 'text-emerald-500',
  },
}

interface Props {
  insights: InsightCard[]
  onAsk: (insight: InsightCard) => void
  loading?: boolean
}

export default function InsightCards({ insights, onAsk, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse h-[88px] rounded-2xl bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    )
  }

  if (!insights || insights.length === 0) return null

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 px-1">
        <Sparkles size={13} className="text-indigo-500" />
        Phân tích nổi bật từ dữ liệu của bạn
      </div>

      {insights.map(insight => {
        const style = TYPE_STYLES[insight.type] ?? TYPE_STYLES.SPIKE
        const Icon = style.icon
        return (
          <div
            key={insight.id}
            className={cn(
              'bg-white dark:bg-slate-800/60 rounded-2xl border p-3.5 shadow-sm transition-colors',
              style.ring,
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn('mt-0.5 shrink-0', style.iconColor)}>
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <span className={cn('inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1.5', style.chip)}>
                  {insight.title}
                </span>
                <p className="text-[13px] leading-snug text-slate-700 dark:text-slate-200">
                  {insight.insightText}
                </p>
                <button
                  onClick={() => onAsk(insight)}
                  className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:gap-1.5 transition-all text-left"
                >
                  {insight.questionText}
                  <ChevronRight size={14} className="shrink-0" />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
