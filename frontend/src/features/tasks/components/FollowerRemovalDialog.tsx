import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import UserAvatar from '@/components/common/UserAvatar'
import type { FollowerRemoval } from '../types'

/** Hộp xác nhận gỡ người theo dõi khi đổi KPI: liệt kê ai bị gỡ khỏi việc nào (việc cha, việc con). */
export default function FollowerRemovalDialog({ removals, busy, onConfirm, onClose }: {
  removals: FollowerRemoval[]
  busy: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useTranslation('tasks')
  // Gom theo việc, giữ thứ tự backend trả (việc cha trước, việc con sau).
  const groups = useMemo(() => {
    const byTask = new Map<string, { taskTitle: string; subtask: boolean; people: FollowerRemoval[] }>()
    for (const r of removals) {
      const g = byTask.get(r.taskId) ?? { taskTitle: r.taskTitle, subtask: r.subtask, people: [] }
      g.people.push(r)
      byTask.set(r.taskId, g)
    }
    return [...byTask.entries()]
  }, [removals])

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      dismissible={!busy}
      title={t('followerRemoval.title')}
      description={t('followerRemoval.description')}
      footer={<DialogFooter
        secondary={<Button variant="outline" onClick={onClose} disabled={busy}>{t('followerRemoval.cancel')}</Button>}
        primary={<Button variant="destructive" onClick={onConfirm} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} {t('followerRemoval.confirm')}
        </Button>}
      />}
    >
      <ul className="space-y-2">
        {groups.map(([taskId, g]) => (
          <li key={taskId} className="rounded-card border border-[var(--color-border)] p-3">
            <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-[var(--color-foreground)]">
              {g.subtask && (
                <span className="shrink-0 rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] font-normal text-[var(--color-subtle-foreground)]">
                  {t('followerRemoval.subtask')}
                </span>
              )}
              <span className="truncate">{g.taskTitle}</span>
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t('followerRemoval.peopleOf', { title: g.taskTitle })}>
              {g.people.map((p) => (
                <li key={p.userId} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-muted)] py-0.5 pl-0.5 pr-2 text-xs text-[var(--color-foreground)]">
                  <UserAvatar fullName={p.userName ?? ''} avatarUrl={p.avatarUrl} className="h-5 w-5 rounded-full text-[9px]" fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]" />
                  {p.userName}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-[var(--color-subtle-foreground)]">{t('followerRemoval.note')}</p>
    </Dialog>
  )
}
