import { AlertTriangle, TrendingDown, TrendingUp, ArrowUpRight, ArrowDownRight, Sparkles, ChevronRight, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InsightCard, InsightType } from '../api/aiApi'

const TYPE_STYLES: Record<InsightType, { icon: typeof AlertTriangle; ring: string; chip: string; iconColor: string }> = {
  DEADLINE_RISK: {
    icon: AlertTriangle,
    ring: 'border-[var(--color-error-border)] hover:border-[var(--color-error-border)]',
    chip: 'bg-[var(--color-error-bg)] text-[var(--color-error)] dark:bg-[var(--color-error-bg)]',
    iconColor: 'text-[var(--color-error)]',
  },
  BELOW: {
    icon: TrendingDown,
    ring: 'border-[var(--color-warning-border)] hover:border-[var(--color-warning-border)]',
    chip: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)]',
    iconColor: 'text-[var(--color-warning)]',
  },
  DROP: {
    icon: ArrowDownRight,
    ring: 'border-[var(--color-warning-border)] hover:border-[var(--color-warning-border)]',
    chip: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)]',
    iconColor: 'text-[var(--color-warning)]',
  },
  SPIKE: {
    icon: ArrowUpRight,
    ring: 'border-[var(--color-info-border)] hover:border-[var(--color-info-border)]',
    chip: 'bg-[var(--color-info-bg)] text-[var(--color-info)] dark:bg-[var(--color-info-bg)]',
    iconColor: 'text-[var(--color-info)]',
  },
  EXCEED: {
    icon: TrendingUp,
    ring: 'border-[var(--color-success-border)] hover:border-[var(--color-success-border)]',
    chip: 'bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)]',
    iconColor: 'text-[var(--color-success)]',
  },
  SUMMARY: {
    icon: BarChart3,
    ring: 'border-[var(--color-ai-line)]',
    chip: 'bg-[var(--color-ai-soft)] text-[var(--color-ai)]',
    iconColor: 'text-[var(--color-ai)]',
  },
}

interface Props {
  insights: InsightCard[]
  onSelectQuestion: (insight: InsightCard, question: string) => void
  selectedQuestion?: string
  loading?: boolean
}

export default function InsightCards({ insights, onSelectQuestion, selectedQuestion, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse h-[88px] rounded-card bg-[var(--color-muted)]" />
        ))}
      </div>
    )
  }

  if (!insights || insights.length === 0) return null

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-caption px-1">
        <Sparkles size={13} className="text-[var(--color-ai)]" aria-hidden="true" />
        Phân tích nổi bật từ dữ liệu của bạn
      </div>

      {insights.map(insight => {
        const style = TYPE_STYLES[insight.type] ?? TYPE_STYLES.SPIKE
        const Icon = style.icon
        return (
          <div
            key={insight.id}
            className={cn(
              'bg-[var(--color-card)] rounded-card border p-3.5 shadow-sm transition-all cursor-pointer',
              selectedQuestion === insight.questionText
                ? 'ring-2 ring-[var(--color-ai)]'
                : style.ring,
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn('mt-0.5 shrink-0', style.iconColor)}>
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <span className={cn('inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-1.5', style.chip)}>
                  {insight.title}
                </span>
                <p className="text-[13px] leading-snug text-[var(--color-foreground)]">
                  {insight.insightText}
                </p>
                <button
                  onClick={() => onSelectQuestion(insight, insight.questionText)}
                  className={cn(
                    'group mt-2 inline-flex items-center gap-1 text-[13px] font-semibold transition-all text-left',
                    selectedQuestion === insight.questionText
                      ? 'text-[var(--color-ai)]'
                      : 'text-[var(--color-ai)] hover:underline underline-offset-4',
                  )}
                >
                  {insight.questionText}
                  <ChevronRight size={14} className={cn('shrink-0 transition-transform', selectedQuestion === insight.questionText && 'translate-x-0.5')} />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
