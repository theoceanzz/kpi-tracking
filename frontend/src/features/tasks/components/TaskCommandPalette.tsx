import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CornerDownLeft, ListTodo, Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { taskApi } from '../api/taskApi'
import { useTaskSidebar } from '../hooks/useTasks'
import { dueTone, shortDue, STATUS_STYLE } from '../taskUtils'

type Hit = { kind: 'list'; id: string; name: string; color: string | null } | { kind: 'task'; id: string; title: string; sub: string | null; dueLabel: string; dueTone: string; status: keyof typeof STATUS_STYLE }

/**
 * Tìm nhanh kiểu Lark (Ctrl / ⌘ + K): gõ tên việc hoặc tên danh sách, ↑ ↓ chọn, Enter mở. Việc tìm qua máy chủ (đúng luật
 * ai xem được), danh sách lọc ngay trong máy.
 */
export default function TaskCommandPalette({ onOpenTask, onOpenList }: { onOpenTask: (id: string) => void; onOpenList: (id: string) => void }) {
  const { t } = useTranslation('tasks')
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [cursor, setCursor] = useState(0)
  const { data: sidebar } = useTaskSidebar(open)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    const h = window.setTimeout(() => setDebounced(q.trim()), 200)
    return () => window.clearTimeout(h)
  }, [q])

  const { data, isFetching } = useQuery({
    queryKey: ['kpi-tasks', 'palette', debounced],
    queryFn: () => taskApi.list({ view: 'SEARCH', keyword: debounced, size: 12 }),
    enabled: open && debounced.length > 0,
    staleTime: 10_000,
  })

  const hits = useMemo<Hit[]>(() => {
    const k = q.trim().toLowerCase()
    const lists: Hit[] = (sidebar?.lists ?? []).filter((l) => !l.archived && (!k || l.name.toLowerCase().includes(k))).slice(0, 5)
      .map((l) => ({ kind: 'list', id: l.listId, name: l.name, color: l.color }))
    const tasks: Hit[] = debounced ? (data?.content ?? []).map((x) => ({
      kind: 'task', id: x.id, title: x.title, sub: x.lists[0]?.listName ?? x.kpiName ?? x.parentTitle,
      dueLabel: x.dueDate ? shortDue(x) : '', dueTone: dueTone(x), status: x.status,
    })) : []
    return [...tasks, ...lists]
  }, [q, debounced, data, sidebar])

  const [prevLen, setPrevLen] = useState(hits.length)
  if (prevLen !== hits.length) { setPrevLen(hits.length); setCursor(0) }

  const close = () => { setOpen(false); setQ(''); setDebounced('') }
  const choose = (h: Hit | undefined) => {
    if (!h) return
    close()
    if (h.kind === 'task') onOpenTask(h.id)
    else onOpenList(h.id)
  }

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-start justify-center bg-slate-950/40 p-4 pt-[12vh]" onMouseDown={close}>
      <div role="dialog" aria-label={t('palette.title')} onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4">
          <Search size={16} className="shrink-0 text-[var(--color-subtle-foreground)]" />
          {/* Ô tìm của bảng lệnh — ngoại lệ có chủ đích của quy ước Input (giống ô soạn chat). */}
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('palette.placeholder')}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close()
              if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(hits.length - 1, c + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)) }
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); choose(hits[cursor]) }
            }}
            className="no-edit-hint h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-muted-foreground)]" />
          {isFetching && <Loader2 size={14} className="animate-spin text-[var(--color-subtle-foreground)]" />}
          <kbd className="rounded border border-[var(--color-border)] px-1.5 text-[11px] text-[var(--color-subtle-foreground)]">Esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {hits.map((h, i) => {
            const on = i === cursor
            if (h.kind === 'list') {
              return (
                <button key={`l:${h.id}`} type="button" onMouseEnter={() => setCursor(i)} onClick={() => choose(h)}
                  className={cn('flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm', on && 'bg-[var(--color-muted)]')}>
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: h.color ?? '#94a3b8' }} />
                  <span className="min-w-0 flex-1 truncate">{h.name}</span>
                  <span className="text-xs text-[var(--color-subtle-foreground)]">{t('palette.list')}</span>
                  {on && <CornerDownLeft size={13} className="text-[var(--color-subtle-foreground)]" />}
                </button>
              )
            }
            const S = STATUS_STYLE[h.status]
            return (
              <button key={`t:${h.id}`} type="button" onMouseEnter={() => setCursor(i)} onClick={() => choose(h)}
                className={cn('flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm', on && 'bg-[var(--color-muted)]')}>
                <S.icon size={15} className={cn('shrink-0', S.className)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{h.title}</span>
                  {h.sub && <span className="block truncate text-[11px] text-[var(--color-subtle-foreground)]">{h.sub}</span>}
                </span>
                {h.dueLabel && <span className={cn('shrink-0 text-xs', h.dueTone)}>{h.dueLabel}</span>}
                {on && <CornerDownLeft size={13} className="text-[var(--color-subtle-foreground)]" />}
              </button>
            )
          })}
          {hits.length === 0 && (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--color-subtle-foreground)]">
              <ListTodo size={16} /> {debounced ? t('palette.empty') : t('palette.hint')}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
