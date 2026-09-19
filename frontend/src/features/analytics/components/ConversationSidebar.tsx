import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus, Search, PanelLeftClose, PanelLeftOpen, MoreVertical, Pin, PinOff, Pencil, Trash2, MessageSquare,
} from 'lucide-react'
import { formatDistanceToNow, differenceInCalendarDays } from 'date-fns'
import { vi } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ConversationResponse } from '../api/aiApi'

interface Props {
  conversations: ConversationResponse[]
  loading: boolean
  activeId: string | null
  collapsed: boolean
  mobileOpen: boolean
  onToggleCollapsed: () => void
  onCloseMobile: () => void
  onNew: () => void
  onSelect: (conv: ConversationResponse) => void
  onRename: (conv: ConversationResponse, title: string) => void
  onTogglePin: (conv: ConversationResponse) => void
  onDelete: (conv: ConversationResponse) => void
}

type Group = { key: string; label: string; items: ConversationResponse[] }

/** Chia danh sách thành Đã ghim / Hôm nay / 7 ngày qua / Cũ hơn — thứ tự API đã đúng, chỉ gom nhãn. */
function groupConversations(list: ConversationResponse[]): Group[] {
  const now = new Date()
  const groups: Record<string, Group> = {
    pinned: { key: 'pinned', label: 'Đã ghim', items: [] },
    today: { key: 'today', label: 'Hôm nay', items: [] },
    week: { key: 'week', label: '7 ngày qua', items: [] },
    older: { key: 'older', label: 'Cũ hơn', items: [] },
  }
  for (const c of list) {
    if (c.pinnedAt) { groups.pinned!.items.push(c); continue }
    const days = differenceInCalendarDays(now, new Date(c.updatedAt || c.createdAt))
    if (days <= 0) groups.today!.items.push(c)
    else if (days <= 7) groups.week!.items.push(c)
    else groups.older!.items.push(c)
  }
  return Object.values(groups).filter(g => g.items.length > 0)
}

function relative(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: vi }).replace(/^khoảng /, '')
}

/**
 * Cột hội thoại của K.AI: nút tạo mới, ô tìm, danh sách gom theo thời gian, và menu "…" cho
 * từng dòng (ghim, đổi tên tại chỗ, xoá). Hoàn tác xoá/đổi tên nằm ở toast do trang cha lo.
 */
export default function ConversationSidebar({
  conversations, loading, activeId, collapsed, mobileOpen,
  onToggleCollapsed, onCloseMobile, onNew, onSelect, onRename, onTogglePin, onDelete,
}: Props) {
  const [query, setQuery] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [menuId, setMenuId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (renamingId) inputRef.current?.select() }, [renamingId])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? conversations.filter(c => (c.title || '').toLowerCase().includes(q)) : conversations
  }, [conversations, query])
  const groups = useMemo(() => groupConversations(shown), [shown])

  const startRename = (c: ConversationResponse) => {
    setMenuId(null)
    setRenamingId(c.id)
    setDraft(c.title || '')
  }
  const commitRename = (c: ConversationResponse) => {
    const title = draft.trim()
    setRenamingId(null)
    if (title && title !== (c.title || '')) onRename(c, title)
  }

  return (
    <aside className={cn(
      'flex flex-col border-r border-[var(--color-border)] bg-[var(--color-card)] transition-[width,transform] duration-300',
      'fixed inset-y-0 left-0 z-40 w-[300px] md:static md:z-auto md:shrink-0',
      collapsed ? 'md:w-[64px]' : 'md:w-[300px]',
      mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
    )}>
      {/* ── Đầu cột: tạo mới + thu gọn ─────────────────────────── */}
      <div className={cn('flex shrink-0 items-center gap-2 p-3', collapsed && 'md:flex-col')}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="hidden md:flex text-[var(--color-ai)] hover:bg-[var(--color-ai-soft)]" onClick={onNew} aria-label="Cuộc trò chuyện mới">
                <Plus aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Cuộc trò chuyện mới</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            onClick={onNew}
            className="h-11 flex-1 justify-center gap-2 bg-[var(--color-ai-soft)] text-[var(--color-ai)] hover:bg-[var(--color-ai-soft)] hover:brightness-95 dark:hover:brightness-125 shadow-none"
          >
            <Plus aria-hidden="true" /> Cuộc trò chuyện mới
          </Button>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="hidden md:flex shrink-0 text-[var(--color-muted-foreground)]" onClick={onToggleCollapsed} aria-label={collapsed ? 'Mở rộng cột hội thoại' : 'Thu gọn cột hội thoại'}>
              {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{collapsed ? 'Mở rộng' : 'Thu gọn'}</TooltipContent>
        </Tooltip>
        <Button variant="ghost" size="icon" className="md:hidden shrink-0 text-[var(--color-muted-foreground)]" onClick={onCloseMobile} aria-label="Đóng danh sách hội thoại">
          <PanelLeftClose aria-hidden="true" />
        </Button>
      </div>

      {!collapsed && (
        <div className="px-3 pb-2">
          <label className="relative flex h-11 items-center">
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 text-[var(--color-muted-foreground)]" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Tìm kiếm hội thoại…"
              aria-label="Tìm kiếm hội thoại"
              className="h-11 w-full rounded-card border border-[var(--color-input)] bg-[var(--color-card)] pl-10 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)] hover:border-[var(--color-border-strong)] focus:border-[var(--color-ai-accent)] focus:ring-2 focus:ring-[var(--color-ai-accent)]"
            />
          </label>
        </div>
      )}

      {/* ── Danh sách ──────────────────────────────────────────── */}
      <ScrollArea className="flex-1">
        {collapsed ? (
          <div className="flex flex-col items-center gap-1 p-2">
            {conversations.slice(0, 20).map(c => (
              <Tooltip key={c.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onSelect(c)}
                    aria-label={c.title || 'Cuộc trò chuyện'}
                    className={cn('flex h-9 w-9 items-center justify-center rounded-control transition-colors',
                      activeId === c.id ? 'bg-[var(--color-ai-soft)] text-[var(--color-ai)]' : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]')}
                  >
                    {c.pinnedAt ? <Pin size={15} aria-hidden="true" /> : <MessageSquare size={15} aria-hidden="true" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[220px] truncate">{c.title || 'Cuộc trò chuyện'}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        ) : loading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-card bg-[var(--color-muted)]" />)}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]">
              <MessageSquare size={22} strokeWidth={1.75} className="text-[var(--color-muted-foreground)]" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-foreground)]">{query ? 'Không có hội thoại nào khớp' : 'Chưa có cuộc trò chuyện'}</p>
              <p className="mt-1 text-caption">{query ? 'Thử từ khoá khác.' : 'Bắt đầu hỏi để tạo mới.'}</p>
            </div>
          </div>
        ) : (
          <div className="px-3 pb-3">
            {groups.map(g => (
              <section key={g.key} className="mt-3 first:mt-1">
                <h3 className="px-2 pb-1.5 text-eyebrow">{g.label}</h3>
                <ul className="space-y-0.5">
                  {g.items.map(c => {
                    const active = c.id === activeId
                    const renaming = renamingId === c.id
                    return (
                      <li key={c.id} className={cn(
                        'group relative rounded-card transition-colors',
                        active ? 'bg-[var(--color-ai-soft)]' : 'hover:bg-[var(--color-muted)]',
                        menuId === c.id && !active && 'bg-[var(--color-muted)]',
                      )}>
                        {renaming ? (
                          <div className="px-3 py-2">
                            <input
                              ref={inputRef}
                              value={draft}
                              onChange={e => setDraft(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') { e.preventDefault(); commitRename(c) }
                                if (e.key === 'Escape') { e.preventDefault(); setRenamingId(null) }
                              }}
                              onBlur={() => commitRename(c)}
                              aria-label="Tên cuộc trò chuyện"
                              maxLength={255}
                              className="h-8 w-full rounded-control border border-[var(--color-ai-accent)] bg-[var(--color-card)] px-2 text-sm text-[var(--color-foreground)] outline-none ring-2 ring-[var(--color-ai-accent)]"
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSelect(c)}
                            aria-current={active ? 'true' : undefined}
                            className="flex w-full flex-col items-start rounded-card px-3 py-2 pr-10 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ai-accent)]"
                          >
                            <span className={cn('block w-full truncate text-sm', active ? 'font-medium text-[var(--color-foreground)]' : 'text-[var(--color-foreground)]')}>
                              {c.title || 'Cuộc trò chuyện'}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1 text-caption">
                              {c.pinnedAt && <Pin size={10} aria-hidden="true" className="text-[var(--color-ai)]" />}
                              {relative(c.updatedAt || c.createdAt)}
                            </span>
                          </button>
                        )}

                        {!renaming && (
                          <Popover open={menuId === c.id} onOpenChange={o => setMenuId(o ? c.id : null)}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label="Tùy chọn"
                                    aria-haspopup="menu"
                                    className={cn(
                                      'absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-control text-[var(--color-muted-foreground)] transition-opacity hover:bg-[var(--color-card)] hover:text-[var(--color-foreground)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ai-accent)] group-hover:opacity-100',
                                      menuId === c.id ? 'bg-[var(--color-card)] text-[var(--color-ai)] opacity-100 ring-2 ring-[var(--color-ai-accent)]' : 'opacity-0',
                                    )}
                                  >
                                    <MoreVertical size={15} aria-hidden="true" />
                                  </button>
                                </PopoverTrigger>
                              </TooltipTrigger>
                              <TooltipContent side="right">Tùy chọn</TooltipContent>
                            </Tooltip>
                            <PopoverContent align="start" side="bottom" className="w-56 p-1.5" role="menu">
                              <MenuItem icon={c.pinnedAt ? <PinOff /> : <Pin />} label={c.pinnedAt ? 'Bỏ ghim' : 'Ghim'} onClick={() => { setMenuId(null); onTogglePin(c) }} />
                              <MenuItem icon={<Pencil />} label="Đổi tên" onClick={() => startRename(c)} />
                              <div className="my-1.5 h-px bg-[var(--color-border)]" role="separator" />
                              <MenuItem icon={<Trash2 />} label="Xóa" danger onClick={() => { setMenuId(null); onDelete(c) }} />
                            </PopoverContent>
                          </Popover>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </ScrollArea>
    </aside>
  )
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm transition-colors focus-visible:outline-none [&_svg]:size-4 [&_svg]:shrink-0',
        danger
          ? 'text-[var(--color-error)] hover:bg-[var(--color-error-bg)] focus-visible:bg-[var(--color-error-bg)]'
          : 'text-[var(--color-foreground)] hover:bg-[var(--color-muted)] focus-visible:bg-[var(--color-muted)] [&_svg]:text-[var(--color-muted-foreground)]',
      )}
    >
      {icon}{label}
    </button>
  )
}
