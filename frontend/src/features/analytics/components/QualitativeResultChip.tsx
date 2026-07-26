import { cn } from '@/lib/utils'

/** Chip hiển thị MỨC kết quả của KPI định tính (thay cho thanh tiến độ số). Rỗng → "Chưa chấm". */
export function QualitativeResultChip({ level, className }: { level?: string | null; className?: string }) {
  const scored = !!level && level.trim().length > 0
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black uppercase',
        scored
          ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-400',
        className,
      )}
    >
      {scored ? level : 'Chưa chấm'}
    </span>
  )
}

export default QualitativeResultChip
