import { useInfiniteQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, History, Loader2 } from 'lucide-react'
import UserAvatar from '@/components/common/UserAvatar'
import { intlLocale } from '@/i18n/format'
import { getApiErrorMessage } from '@/lib/apiError'
import { taskApi } from '../api/taskApi'
import { taskKeys } from '../hooks/useTasks'
import { historyText, todayIso } from '../taskUtils'
import type { TaskActivityItem } from '../types'

/**
 * Trang "Hoạt động" kiểu Lark (ảnh "View task activity history"): cột ngày bên trái ("Hôm nay" + số ngày to), mỗi dòng: giờ
 * · avatar · "✔ Tên việc" (bấm mở việc) · câu thay đổi. `listId` = tab "Hoạt động" của một danh sách. Tải dần từng trang.
 */
export default function TaskActivityFeed({ listId, onOpen }: { listId?: string; onOpen: (taskId: string) => void }) {
  const { t } = useTranslation('tasks')
  const q = useInfiniteQuery({
    queryKey: [...taskKeys.all, 'activities', listId ?? 'mine'] as const,
    queryFn: ({ pageParam }) => taskApi.activities({ listId, page: pageParam, size: 50 }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasMore ? all.length : undefined),
  })
  const items = (q.data?.pages ?? []).flatMap((p) => p.items)
  const days: { day: string; items: TaskActivityItem[] }[] = []
  for (const it of items) {
    const day = new Date(it.createdAt).toLocaleDateString('en-CA')
    const last = days[days.length - 1]
    if (last && last.day === day) last.items.push(it)
    else days.push({ day, items: [it] })
  }
  const time = new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' })
  const dayLabel = (d: string) => {
    const today = todayIso()
    if (d === today) return t('due.today')
    return new Intl.DateTimeFormat(intlLocale(), { weekday: 'long' }).format(new Date(`${d}T00:00:00`))
  }

  if (q.isLoading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-[var(--color-subtle-foreground)]" /></div>
  if (q.isError) return <p className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center text-sm text-[var(--color-error)]">{getApiErrorMessage(q.error)}</p>
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-sm text-[var(--color-subtle-foreground)]">
        <History size={28} /> {t('activity.empty')}
      </div>
    )
  }
  return (
    <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 sm:px-6">
      {days.map((g) => (
        <div key={g.day} className="flex gap-4 border-b border-[var(--color-border)] py-3 last:border-b-0 sm:gap-8">
          <div className="w-16 shrink-0 sm:w-20">
            <p className="text-sm text-[var(--color-subtle-foreground)] first-letter:uppercase">{dayLabel(g.day)}</p>
            <p className="text-3xl font-semibold leading-tight text-[var(--color-foreground)]">{Number(g.day.slice(8))}</p>
            {g.day.slice(0, 7) !== todayIso().slice(0, 7) && <p className="text-xs text-[var(--color-subtle-foreground)]">{g.day.slice(5, 7)}/{g.day.slice(0, 4)}</p>}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            {g.items.map((it) => (
              <button key={it.id} type="button" onClick={() => onOpen(it.taskId)}
                className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-[var(--color-muted)] sm:gap-5">
                <span className="w-12 shrink-0 pt-1 text-sm tabular-nums text-[var(--color-subtle-foreground)]">{time.format(new Date(it.createdAt))}</span>
                <UserAvatar fullName={it.actorName ?? ''} avatarUrl={it.actorAvatarUrl} className="mt-0.5 h-8 w-8 shrink-0 rounded-full text-[11px]"
                  fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm text-[var(--color-subtle-foreground)]"><Check size={13} className="shrink-0" /> <span className="truncate">{it.taskTitle}</span></span>
                  <span className="block text-[15px] text-[var(--color-foreground)]">
                    {it.actorName} {historyText(t, it.action, it.oldValue, it.newValue)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
      {q.hasNextPage && (
        <button type="button" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}
          className="mt-2 w-full rounded-md py-2 text-sm text-[var(--color-primary)] hover:bg-[var(--color-muted)]">
          {q.isFetchingNextPage ? <Loader2 size={14} className="mx-auto animate-spin" /> : t('list.loadMore')}
        </button>
      )}
    </div>
  )
}
