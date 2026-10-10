import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getApiErrorMessage } from '@/lib/apiError'
import { taskApi } from '../api/taskApi'
import GroupedPicker from './GroupedPicker'
import { useTaskMutations } from '../hooks/useTasks'
import type { KpiTask } from '../types'

interface Props {
  task: KpiTask | null
  open: boolean
  onClose: () => void
  /** Chọn sẵn người mới (kéo vào nhóm người phụ trách). */
  initialOwnerId?: string
  /** Chỉ đổi KPI, giữ người phụ trách ("Chuyển sang KPI khác"). */
  kpiOnly?: boolean
}

/**
 * Giao / giao lại một việc, hoặc chuyển việc sang KPI khác. Task luôn gắn KPI CỦA người phụ trách, nên đổi người thì
 * phải chọn lại KPI trong số KPI của người đó (chỉ những KPI mình được giao việc trên). Việc con giữ KPI của việc cha.
 */
export default function AssignDialog({ task, open, onClose, initialOwnerId, kpiOnly }: Props) {
  const { t } = useTranslation('tasks')
    const [ownerId, setOwnerId] = useState<string | undefined>()
  const [kpiId, setKpiId] = useState<string | undefined>()
  const m = useTaskMutations()

  // Mở lại (hoặc mở cho việc khác) ⇒ về giá trị đầu — chỉnh state ngay trong render thay vì effect.
  const resetKey = open && task ? `${task.id}:${initialOwnerId ?? ''}` : ''
  const [lastReset, setLastReset] = useState('')
  if (resetKey !== lastReset) {
    setLastReset(resetKey)
    if (resetKey && task) {
      setOwnerId(initialOwnerId ?? task.ownerId)
      setKpiId(undefined)
    }
  }

  const { data: people = [] } = useQuery({
    queryKey: ['kpi-tasks', 'assignable-users', ''],
    queryFn: () => taskApi.assignableUsers(''),
    enabled: open && !kpiOnly,
    staleTime: 30_000,
  })
  const { data: kpis = [], isFetching: kpisLoading } = useQuery({
    queryKey: ['kpi-tasks', 'assignable-kpis', ownerId],
    queryFn: () => taskApi.assignableKpis(ownerId),
    enabled: open && !!ownerId && !task?.parentTaskId,
    staleTime: 30_000,
  })

  if (!task) return null
  const subtask = !!task.parentTaskId
  // KPI hiện tại vẫn thuộc người mới ⇒ chọn sẵn; không thì để người dùng chọn.
  const chosenKpi = kpiId ?? (kpis.some((k) => k.id === task.kpiId) ? task.kpiId : undefined)
  const finalKpi = subtask ? task.kpiId : chosenKpi
  const changed = ownerId !== task.ownerId || finalKpi !== task.kpiId
  const pending = m.assign.isPending || m.move.isPending

  const submit = () => {
    if (!ownerId || !finalKpi) return
    const onError = (e: unknown) => toast.error(getApiErrorMessage(e))
    const onSuccess = () => { toast.success(t('assign.done')); onClose() }
    if (kpiOnly && !task.canReassign) {
      m.move.mutate({ fromKpiId: task.kpiId, toKpiId: finalKpi, taskIds: [task.id] }, { onSuccess, onError })
    } else {
      m.assign.mutate({ id: task.id, ownerId, kpiId: subtask ? undefined : finalKpi, version: task.version }, { onSuccess, onError })
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title={kpiOnly ? t('assign.moveKpiTitle') : t('assign.title')}
      description={task.title}
      footer={<DialogFooter
        secondary={<Button variant="outline" onClick={onClose}>{t('detail.close')}</Button>}
        primary={<Button disabled={!changed || !ownerId || !finalKpi || pending} onClick={submit}>
          {pending && <Loader2 className="animate-spin" />} {t('assign.confirm')}
        </Button>}
      />}
    >
      <div className="space-y-4">
        {!kpiOnly && (
          <label className="block space-y-1">
            <span className="text-xs font-medium text-[var(--color-subtle-foreground)]">{t('detail.owner')}</span>
            <GroupedPicker people options={people} value={ownerId} onChange={(v) => { if (v) { setOwnerId(v); setKpiId(undefined) } }}
              placeholder={t('picker.pickPerson')} searchPlaceholder={t('picker.searchPerson')} emptyLabel={t('assign.noPeople')} />
          </label>
        )}
        {subtask ? (
          <p className="text-xs text-[var(--color-subtle-foreground)]">{t('assign.subtaskKpi', { name: task.kpiName ?? '' })}</p>
        ) : (
          <label className="block space-y-1">
            <span className="text-xs font-medium text-[var(--color-subtle-foreground)]">{t('assign.kpiOfOwner')}</span>
            <GroupedPicker options={kpis} value={chosenKpi ?? null} onChange={(v) => setKpiId(v ?? undefined)}
              disabled={!ownerId} loading={kpisLoading}
              placeholder={kpisLoading ? t('assign.loadingKpis') : t('assign.pickKpi')} searchPlaceholder={t('picker.searchKpi')}
              collapseNonCurrent groupOrder="desc" moreLabel={(n) => t('picker.morePeriods', { count: n })} emptyLabel={t('assign.noKpis')} />
            {!kpisLoading && ownerId && kpis.length === 0 && (
              <span className="text-xs text-[var(--color-warning)]">{t('assign.noKpis')}</span>
            )}
          </label>
        )}
      </div>
    </Dialog>
  )
}
