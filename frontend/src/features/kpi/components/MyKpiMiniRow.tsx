import { Link } from 'react-router-dom'
import { CheckCircle2, Send } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { KpiCriteria } from '@/types/kpi'
import { kpiWorkState } from '../utils/myKpiStatus'

/**
 * Một dòng KPI của tôi khi đứng TRONG một nhóm (dưới kết quả then chốt, dưới hạng mục BSC):
 * tên · tiến độ nộp · hạn · việc phải làm. Cùng ngôn ngữ trạng thái với trang KPI của tôi,
 * nhưng bỏ cột tần suất/trọng số vì ngữ cảnh nhóm đã nói hộ.
 */
export default function MyKpiMiniRow({ kpi, onOpen, now }: {
  kpi: KpiCriteria
  onOpen?: (kpi: KpiCriteria) => void
  now?: Date
}) {
  const s = kpiWorkState(kpi, now)
  const pct = Math.min(100, Math.round((s.submitted / s.expected) * 100))

  let action: React.ReactNode
  if (s.done) action = <Badge variant="success"><CheckCircle2 size={12} aria-hidden="true" /> Đã xong</Badge>
  else if (!s.started) action = <Badge variant="secondary">Chưa mở</Badge>
  else if (s.ended) action = <Badge variant="destructive">Quá hạn</Badge>
  else action = (
    <Button asChild size="sm" variant={s.overdue ? 'destructive' : 'default'}>
      <Link to={`/submissions/new?kpiId=${kpi.id}`}><Send aria-hidden="true" /> Nộp bài</Link>
    </Button>
  )

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
      <div className="min-w-0 flex-1 basis-56">
        {onOpen ? (
          <button type="button" onClick={() => onOpen(kpi)} className="block max-w-full truncate text-left text-sm font-medium text-[var(--color-foreground)] hover:text-[var(--color-primary)]">
            {kpi.name}
          </button>
        ) : (
          <p className="truncate text-sm font-medium text-[var(--color-foreground)]">{kpi.name}</p>
        )}
        <p className="text-caption">
          {kpi.kpiPeriod?.name}
          {kpi.weight != null && ` · trọng số ${kpi.weight}%`}
        </p>
      </div>
      <div className="flex w-36 shrink-0 items-center gap-2" title={`Đã nộp ${s.submitted}/${s.expected} lần`}>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-muted)]">
          <div className={cn('h-full rounded-full', s.done ? 'bg-[var(--color-success-solid)]' : s.overdue ? 'bg-[var(--color-error-solid)]' : 'bg-[var(--color-primary)]')} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-caption tabular-nums">{s.submitted}/{s.expected}</span>
      </div>
      <span className={cn('w-24 shrink-0 text-caption tabular-nums', s.overdue && 'font-medium text-[var(--color-error)]')}>
        {s.nextDeadline && !s.done ? `Hạn ${format(s.nextDeadline, 'dd/MM/yyyy')}` : ''}
      </span>
      <div className="shrink-0">{action}</div>
    </div>
  )
}
