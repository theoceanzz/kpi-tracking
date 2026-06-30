import { cn } from '@/lib/utils'

/** Vòng tròn hiệu suất giống hàng KPI cha (w-12, r=20). */
export function KpiPerfDonut({ value }: { value: number }) {
  const v = Math.round(value)
  const color =
    v >= 100 ? 'text-emerald-500' : v >= 80 ? 'text-indigo-500' : v >= 50 ? 'text-amber-500' : 'text-red-500'
  return (
    <div className="inline-flex relative items-center justify-center w-12 h-12">
      <svg className="w-12 h-12 transform -rotate-90">
        <circle className="text-slate-100 dark:text-slate-800" strokeWidth="4" stroke="currentColor" fill="transparent" r="20" cx="24" cy="24" />
        <circle
          className={cn(color)}
          strokeWidth="4"
          strokeDasharray={125.6}
          strokeDashoffset={125.6 - (Math.min(v, 100) / 100) * 125.6}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r="20"
          cx="24"
          cy="24"
        />
      </svg>
      <span className="absolute text-[10px] font-black">{v}%</span>
    </div>
  )
}

export default KpiPerfDonut
