import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRightLeft, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getApiErrorMessage } from '@/lib/apiError'
import type { KpiCriteria } from '@/types/kpi'
import { useKpiTasks, useTaskMutations, useTaskRealtime, useTaskReplacements } from '../hooks/useTasks'
import { isClosed } from '../taskUtils'
import AssignDialog from './AssignDialog'
import TaskDetailPanel from './TaskDetailPanel'
import TaskListView from './TaskListView'
import type { KpiTask } from '../types'

/** Trạng thái KPI còn nhận việc mới — khớp KpiTaskService.TASKABLE. */
const TASKABLE = ['DRAFT', 'PENDING_APPROVAL', 'EDIT', 'EDITED', 'APPROVED', 'REJECTED']

/**
 * Tab "Công việc" trong chi tiết KPI: cùng danh sách và bảng chi tiết với trang Công việc, lọc sẵn theo KPI này (nhóm
 * theo hạn, thêm nhanh gắn KPI này). KPI vừa thay cho KPI cũ mà tôi còn việc dở ⇒ hỏi có chuyển sang không.
 */
export default function KpiTasksTab({ kpi }: { kpi: KpiCriteria }) {
  const { t } = useTranslation('tasks')
  const { data: tasks = [], isLoading } = useKpiTasks(kpi.id)
  const { data: replacements = [] } = useTaskReplacements(kpi.id)
  const { move } = useTaskMutations()
  const [openId, setOpenId] = useState<string | null>(null)
  const [assignFor, setAssignFor] = useState<{ task: KpiTask; ownerId: string } | null>(null)
  const close = useCallback(() => setOpenId(null), [])
  useTaskRealtime(openId, close)

  const counted = useMemo(() => tasks.filter((x) => x.status !== 'CANCELLED'), [tasks])
  const done = counted.filter((x) => x.status === 'DONE').length
  const overdue = tasks.filter((x) => x.overdue && !isClosed(x)).length
  const canAdd = TASKABLE.includes(kpi.status)

  return (
    <div className="space-y-4 p-6">
      {replacements.map((r) => (
        <div key={r.oldKpiId} className="flex flex-wrap items-center gap-3 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm">
          <ArrowRightLeft size={16} className="text-[var(--color-warning)]" />
          <span className="flex-1 text-[var(--color-foreground)]">{t('replacement.message', { count: r.openTaskCount, name: r.oldKpiName })}</span>
          <Button size="sm" disabled={move.isPending}
            onClick={() => move.mutate({ fromKpiId: r.oldKpiId, toKpiId: kpi.id }, {
              onSuccess: (res) => toast.success(t('replacement.moved', { count: res.moved })),
              onError: (e) => toast.error(getApiErrorMessage(e)),
            })}>
            {move.isPending && <Loader2 className="animate-spin" />} {t('replacement.move')}
          </Button>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        {counted.length > 0 && (
          <div className="flex min-w-[200px] flex-1 items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-muted)]">
              <div className="h-full rounded-full bg-[var(--color-success)]" style={{ width: `${Math.round((done / counted.length) * 100)}%` }} />
            </div>
            <span className="text-xs text-[var(--color-subtle-foreground)]">{t('progress.label', { done, total: counted.length })}</span>
            {overdue > 0 && <span className="text-xs font-medium text-[var(--color-error)]">{t('progress.overdue', { count: overdue })}</span>}
          </div>
        )}
        <Link to={`/tasks?kpi=${kpi.id}`} className="ml-auto inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline">
          <ExternalLink size={12} /> {t('kpiTab.openInTasks')}
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[var(--color-subtle-foreground)]" /></div>
      ) : (
        <TaskListView tasks={tasks} groupBy="due" sort="due" activeTaskId={openId} onOpen={(x) => setOpenId(x.id)}
          defaultKpiId={kpi.id} showKpi={false} allowQuickAdd={canAdd}
          onRequestAssign={(task, ownerId) => setAssignFor({ task, ownerId })} />
      )}

      {/* Nổi trên modal chi tiết KPI (z-[200]). */}
      <TaskDetailPanel taskId={openId} onClose={close} onNavigate={setOpenId} zClass="z-[260]" />
      <AssignDialog task={assignFor?.task ?? null} open={!!assignFor} initialOwnerId={assignFor?.ownerId} onClose={() => setAssignFor(null)} />
    </div>
  )
}
