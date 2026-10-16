import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, ClipboardCheck, Folder, FolderMinus, MoreHorizontal, Pin, PinOff } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { listApi } from '../api/listApi'
import { taskKeys } from '../hooks/useTasks'
import type { TaskSidebarList } from '../types'

const FOLDERS_KEY = 'tasks.sidebar.closedFolders'

/**
 * Khối "Danh sách" ở cột trái kiểu Lark: danh sách đã ghim lên đầu, rồi các thư mục (thu / mở được, nhớ theo trình duyệt),
 * rồi danh sách lẻ. Mỗi dòng có biểu tượng (emoji hoặc ô màu), số việc chưa xong và menu "…": ghim, chuyển vào thư mục,
 * bỏ khỏi thư mục. Ghim và thư mục là của RIÊNG người dùng.
 */
export default function SidebarLists({ lists, activeListId, onSelect }: {
  lists: TaskSidebarList[]
  activeListId?: string
  onSelect: (listId: string) => void
}) {
  const [closed, setClosed] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(FOLDERS_KEY) ?? '[]') } catch { return [] } })
  const toggleFolder = (f: string) => {
    const next = closed.includes(f) ? closed.filter((x) => x !== f) : [...closed, f]
    setClosed(next)
    try { localStorage.setItem(FOLDERS_KEY, JSON.stringify(next)) } catch { /* bỏ qua */ }
  }
  const pinned = lists.filter((l) => l.pinned)
  const rest = lists.filter((l) => !l.pinned)
  const folders = [...new Set(rest.map((l) => l.folder).filter((f): f is string => !!f))].sort((a, b) => a.localeCompare(b))
  const loose = rest.filter((l) => !l.folder)
  const allFolders = [...new Set(lists.map((l) => l.folder).filter((f): f is string => !!f))]

  const row = (l: TaskSidebarList, indent = false) => (
    <ListRow key={l.listId} list={l} active={activeListId === l.listId} indent={indent} folders={allFolders} onSelect={() => onSelect(l.listId)} />
  )
  return (
    <>
      {pinned.map((l) => row(l))}
      {folders.map((f) => {
        const open = !closed.includes(f)
        const inside = rest.filter((l) => l.folder === f)
        return (
          <div key={f}>
            <button type="button" onClick={() => toggleFolder(f)}
              className="flex w-full items-center gap-2 rounded-md py-1.5 pl-9 pr-2 text-left text-[15px] text-[var(--color-foreground)] hover:bg-[var(--color-muted)]">
              <Folder size={15} className="shrink-0 text-[var(--color-subtle-foreground)]" />
              <span className="min-w-0 flex-1 truncate">{f}</span>
              {open ? <ChevronDown size={14} className="shrink-0 text-[var(--color-subtle-foreground)]" /> : <ChevronRight size={14} className="shrink-0 text-[var(--color-subtle-foreground)]" />}
            </button>
            {open && inside.map((l) => row(l, true))}
          </div>
        )
      })}
      {loose.map((l) => row(l))}
    </>
  )
}

function ListRow({ list, active, indent, folders, onSelect }: {
  list: TaskSidebarList; active: boolean; indent: boolean; folders: string[]; onSelect: () => void
}) {
  const { t } = useTranslation('tasks')
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const save = (input: { pinned?: boolean; folder?: string; clearFolder?: boolean }) => {
    setOpen(false)
    listApi.setMyPrefs(list.listId, input)
      .then(() => qc.invalidateQueries({ queryKey: taskKeys.sidebar }))
      .catch((e) => toast.error(getApiErrorMessage(e)))
  }
  const item = 'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--color-muted)]'
  return (
    <div className={cn('group/list flex items-center rounded-md', active ? 'bg-[var(--color-primary-soft)]' : 'hover:bg-[var(--color-muted)]')}>
      <button type="button" onClick={onSelect}
        className={cn('flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-1 text-left text-[15px]', indent ? 'pl-14' : 'pl-9',
          active ? 'text-[var(--color-primary)]' : 'text-[var(--color-foreground)]')}>
        {/* Lark: icon danh sách (hoặc biểu tượng tự chọn), không số đếm. */}
        {list.icon
          ? <span className="w-4 shrink-0 text-center text-[14px] leading-none">{list.icon}</span>
          : <ClipboardCheck size={15} className="shrink-0" style={{ color: active ? undefined : list.color ?? 'var(--color-subtle-foreground)' }} />}
        <span className="min-w-0 flex-1 truncate">{list.name}</span>
        {list.pinned && <Pin size={11} className="shrink-0 text-[var(--color-subtle-foreground)]" aria-label={t('sidebar.pinned')} />}
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={t('menu.more')}
            className="mr-1 hidden rounded p-0.5 text-[var(--color-subtle-foreground)] hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)] group-hover/list:block data-[state=open]:block">
            <MoreHorizontal size={14} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="start">
          <button type="button" className={item} onClick={() => save({ pinned: !list.pinned })}>
            {list.pinned ? <><PinOff size={14} /> {t('sidebar.unpin')}</> : <><Pin size={14} /> {t('sidebar.pin')}</>}
          </button>
          <div className="my-1 h-px bg-[var(--color-border)]" />
          <p className="px-2 pb-1 pt-0.5 text-[11px] text-[var(--color-subtle-foreground)]">{t('sidebar.moveToFolder')}</p>
          {folders.filter((f) => f !== list.folder).map((f) => (
            <button key={f} type="button" className={item} onClick={() => save({ folder: f })}><Folder size={14} /> {f}</button>
          ))}
          <div className="px-1 pb-1">
            {/* Ô gõ tên thư mục mới trong menu — ngoại lệ có chủ đích của quy ước Input. */}
            <input value={folderName} maxLength={100} placeholder={t('sidebar.newFolder')}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && folderName.trim()) { save({ folder: folderName.trim() }); setFolderName('') } }}
              className="no-edit-hint w-full rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-sm outline-none focus:border-[var(--color-ring)]" />
          </div>
          {list.folder && (
            <button type="button" className={item} onClick={() => save({ clearFolder: true })}><FolderMinus size={14} /> {t('sidebar.removeFromFolder')}</button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
