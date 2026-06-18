import { useState, useEffect, useCallback } from 'react'
import { Wrench, Users, LayoutGrid, MessageCircleQuestion } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FollowupPools } from '../api/aiApi'

type Pool = 'all' | 'technical' | 'management'

function sample3(arr: string[]): string[] {
  const copy = [...arr]
  const out: string[] = []
  while (out.length < 3 && copy.length) {
    const idx = Math.floor(Math.random() * copy.length)
    const [picked] = copy.splice(idx, 1)
    if (picked) out.push(picked)
  }
  return out
}

interface Props {
  pools: FollowupPools
  onSelectQuestion: (question: string) => void
  selectedQuestion?: string
  onShowInsights: () => void
}

export default function FollowupSuggestions({ pools, onSelectQuestion, selectedQuestion, onShowInsights }: Props) {
  const [pool, setPool] = useState<Pool>('all')
  const [shown, setShown] = useState<string[]>([])

  const resample = useCallback((p: Pool) => {
    const source =
      p === 'technical' ? pools.technical
      : p === 'management' ? pools.management
      : [...pools.technical, ...pools.management]
    setShown(sample3(source ?? []))
  }, [pools])

  // New pools → reset to "all" and sample 3 of 10
  useEffect(() => {
    setPool('all')
    resample('all')
  }, [resample])

  const selectPool = (p: Pool) => {
    setPool(p)
    resample(p)
  }

  if (!shown.length) return null

  return (
    <div className="mt-1 space-y-2">
      {/* Suggested question buttons */}
      <div className="flex flex-col gap-1.5">
        {shown.map((q, i) => {
          const isSelected = selectedQuestion === q
          return (
            <button
              key={`${q}-${i}`}
              onClick={() => onSelectQuestion(q)}
              className={cn(
                'group flex items-center gap-2 text-left text-[13px] font-medium rounded-xl px-3 py-2 transition-all duration-200 cursor-pointer',
                isSelected
                  ? 'bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-200 shadow-md'
                  : 'text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:shadow-md dark:hover:shadow-indigo-900/30',
              )}
            >
              <MessageCircleQuestion size={14} className={cn('shrink-0 transition-colors', isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-indigo-400 group-hover:text-indigo-500')} />
              <span className={isSelected ? 'text-indigo-700 dark:text-indigo-200' : 'group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors'}>{q}</span>
            </button>
          )
        })}
      </div>

      {/* Pool toggles + show insights */}
      <div className="flex flex-wrap items-center gap-1.5">
        <PoolButton active={pool === 'technical'} onClick={() => selectPool('technical')} icon={Wrench} label="Kỹ thuật" />
        <PoolButton active={pool === 'management'} onClick={() => selectPool('management')} icon={Users} label="Quản trị" />
        <button
          onClick={onShowInsights}
          className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
        >
          <LayoutGrid size={12} />
          Xem insights khác
        </button>
      </div>
    </div>
  )
}

function PoolButton({
  active, onClick, icon: Icon, label,
}: { active: boolean; onClick: () => void; icon: typeof Wrench; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors',
        active
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300',
      )}
    >
      <Icon size={12} />
      {label}
    </button>
  )
}
