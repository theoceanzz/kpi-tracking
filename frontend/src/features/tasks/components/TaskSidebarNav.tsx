import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, Bookmark, ChevronDown, ChevronRight, ClipboardCheck, FolderPlus, History, ListPlus, Plus, Target, User as UserIcon, Users, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { TaskSavedView, TaskSidebar, TaskView } from '../types'
import { tourAnchor } from '@/components/common/tours/anchors'
import SidebarLists from './SidebarLists'

export interface SidebarSelection {
  view: TaskView
  kpiId?: string
  listId?: string
}

interface Props {
  data?: TaskSidebar
  value: SidebarSelection
  onChange: (v: SidebarSelection) => void
  onCreateList: () => void
  /** Thư mục mới (Lark: Task List + > New Group) — tạo bằng cách chuyển một danh sách vào thư mục. */
  onCreateFolder?: () => void
  views: TaskSavedView[]
  activeViewId?: string | null
  onApplyView: (v: TaskSavedView) => void
  onDeleteView: (v: TaskSavedView) => void
}

/** Truy cập nhanh của Lark (All Tasks · Created · Assigned · Completed) + hai lối riêng của KeyGo ở cuối. */
const QUICK: TaskView[] = ['ALL', 'CREATED', 'DELEGATED', 'DONE', 'NOKPI']
const OPEN_KEY = 'tasks.sidebar.closedGroups'

const keyOf = (v: SidebarSelection) => (v.listId ? `list:${v.listId}` : v.kpiId ? `kpi:${v.kpiId}` : `view:${v.view}`)

function parseKey(k: string): SidebarSelection {
  if (k.startsWith('kpi:')) return { view: 'ALL', kpiId: k.slice(4) }
  if (k.startsWith('list:')) return { view: 'ALL', listId: k.slice(5) }
  return { view: k.slice(5) as TaskView }
}

/**
 * Cột trái của trang Công việc theo đúng Lark (docs/TASKS_LARK_REFERENCE.md): tiêu đề "Công việc"; Tôi phụ trách (số việc) ·
 * Tôi theo dõi · Hoạt động; nhóm thu gọn "Truy cập nhanh" (Tất cả · Tôi tạo · Tôi giao · Đã hoàn thành, thêm "Không gắn
 * KPI" của KeyGo); "Danh sách" + (Danh sách mới / Thư mục mới), "Hiện danh sách đã lưu trữ". Sau phần của Lark là các
 * mục KeyGo: Việc của đơn vị, Chế độ xem đã lưu, Theo KPI. Nhóm thu / mở nhớ theo trình duyệt. Điện thoại: một ô chọn.
 */
export default function TaskSidebarNav({ data, value, onChange, onCreateList, onCreateFolder, views, activeViewId, onApplyView, onDeleteView }: Props) {
  const { t } = useTranslation('tasks')
  const active = keyOf(value)
  const [showArchived, setShowArchived] = useState(false)
  const [closed, setClosed] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]') } catch { return [] } })
  const toggle = (g: string) => {
    const next = closed.includes(g) ? closed.filter((x) => x !== g) : [...closed, g]
    setClosed(next)
    try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)) } catch { /* bỏ qua */ }
  }
  const lists = data?.lists ?? []
  const liveLists = lists.filter((l) => !l.archived)
  const archived = lists.filter((l) => l.archived)

  const rowCls = (on: boolean) => cn('flex w-full items-center gap-2.5 rounded-md py-1.5 pr-2 text-left text-[15px] transition-colors',
    on ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'text-[var(--color-foreground)] hover:bg-[var(--color-muted)]')
  const top = (view: TaskView, Icon: typeof UserIcon, count?: number | null) => (
    <button key={view} {...(view === 'ACTIVITY' ? tourAnchor('tasks.activity') : {})} type="button" onClick={() => onChange({ view })}
      className={cn(rowCls(active === `view:${view}`), 'pl-2.5')}>
      <Icon size={17} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{t(`view.${view}`)}</span>
      {!!count && <span className="text-sm text-[var(--color-subtle-foreground)]">{count}</span>}
    </button>
  )
  const sub = (key: string, label: string, onClick: () => void, extra?: ReactNode) => (
    <button key={key} type="button" onClick={onClick} className={cn(rowCls(active === key), 'pl-9')}>
      <span className="min-w-0 flex-1 truncate">{label}</span>{extra}
    </button>
  )
  const group = (id: string, label: string, children: ReactNode, action?: ReactNode, icon?: ReactNode) => {
    const open = !closed.includes(id)
    return (
      <div className="space-y-0.5">
        <div className="group/head flex items-center rounded-md hover:bg-[var(--color-muted)]">
          <button type="button" onClick={() => toggle(id)} aria-expanded={open}
            className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pl-2.5 text-left text-[15px] text-[var(--color-foreground)]">
            {icon ?? (open ? <ChevronDown size={17} className="shrink-0" /> : <ChevronRight size={17} className="shrink-0" />)}
            <span className="truncate">{label}</span>
          </button>
          {action}
        </div>
        {open && children}
      </div>
    )
  }
  const divider = <div className="mx-2.5 my-2 h-px bg-[var(--color-border)]" />

  return (
    <>
      {/* Điện thoại */}
      <div className="flex gap-2 md:hidden">
        <Select value={active} onValueChange={(k) => onChange(parseKey(k))}>
          <SelectTrigger {...tourAnchor('tasks.views')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {(['ASSIGNED', 'FOLLOWING', 'ACTIVITY'] as TaskView[]).map((v) => <SelectItem key={v} value={`view:${v}`}>{t(`view.${v}`)}</SelectItem>)}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>{t('sidebar.quickAccess')}</SelectLabel>
              {QUICK.map((v) => <SelectItem key={v} value={`view:${v}`}>{t(`view.${v}`)}</SelectItem>)}
              {data?.canViewTeam && <SelectItem value="view:TEAM">{t('view.TEAM')}</SelectItem>}
            </SelectGroup>
            {liveLists.length > 0 && (
              <SelectGroup>
                <SelectLabel>{t('sidebar.lists')}</SelectLabel>
                {liveLists.map((l) => <SelectItem key={l.listId} value={`list:${l.listId}`}>{l.name}</SelectItem>)}
              </SelectGroup>
            )}
            {!!data?.kpis.length && (
              <SelectGroup>
                <SelectLabel>{t('sidebar.byKpi')}</SelectLabel>
                {data.kpis.map((k) => <SelectItem key={k.kpiId} value={`kpi:${k.kpiId}`}>{k.kpiName} ({k.open})</SelectItem>)}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
        <button {...tourAnchor('tasks.lists.create')} type="button" aria-label={t('lists.create')} onClick={onCreateList}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-[var(--color-border)]"><Plus size={16} /></button>
      </div>

      {/* Máy tính */}
      <nav {...tourAnchor('tasks.views')} className="hidden w-60 shrink-0 md:block" aria-label={t('sidebar.label')}>
        <h2 className="px-2.5 pb-3 text-xl font-semibold text-[var(--color-foreground)]">{t('sidebar.title')}</h2>
        <div className="space-y-0.5">
          {top('ASSIGNED', UserIcon, data?.assigned)}
          {top('FOLLOWING', Bookmark)}
          {top('ACTIVITY', History)}
        </div>
        {divider}
        {group('quick', t('sidebar.quickAccess'), (
          <>
            {QUICK.map((v) => sub(`view:${v}`, t(`view.${v}`), () => onChange({ view: v })))}
            {data?.canViewTeam && sub('view:TEAM', t('view.TEAM'), () => onChange({ view: 'TEAM' }), <Users size={14} className="shrink-0 text-[var(--color-subtle-foreground)]" />)}
          </>
        ))}
        {divider}
        <div {...tourAnchor('tasks.lists')}>
          {group('lists', t('sidebar.lists'), (
            <>
              <SidebarLists lists={liveLists} activeListId={value.listId} onSelect={(id) => onChange({ view: 'ALL', listId: id })} />
              {liveLists.length === 0 && (
                <button type="button" onClick={onCreateList} className={cn(rowCls(false), 'pl-9 text-sm text-[var(--color-subtle-foreground)]')}>
                  <Plus size={14} /> {t('sidebar.noLists')}
                </button>
              )}
              {archived.length > 0 && (
                <>
                  <button type="button" onClick={() => setShowArchived((v) => !v)}
                    className="flex w-full items-center gap-1.5 py-1 pl-9 text-left text-sm text-[var(--color-subtle-foreground)] hover:text-[var(--color-foreground)]">
                    {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {t('sidebar.showArchived', { count: archived.length })}
                  </button>
                  {showArchived && archived.map((l) => sub(`list:${l.listId}`, l.name, () => onChange({ view: 'ALL', listId: l.listId }),
                    <Archive size={13} className="shrink-0 text-[var(--color-subtle-foreground)]" />))}
                </>
              )}
            </>
          ), (
            <Popover>
              <PopoverTrigger asChild>
                <button {...tourAnchor('tasks.lists.create')} type="button" aria-label={t('lists.create')} title={t('lists.create')}
                  className="mr-1 rounded p-1 text-[var(--color-subtle-foreground)] hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)]"><Plus size={16} /></button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                <button type="button" onClick={onCreateList} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--color-muted)]">
                  <ListPlus size={15} /> {t('sidebar.newList')}
                </button>
                {onCreateFolder && (
                  <button type="button" onClick={onCreateFolder} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--color-muted)]">
                    <FolderPlus size={15} /> {t('sidebar.newFolderItem')}
                  </button>
                )}
              </PopoverContent>
            </Popover>
          ), <ClipboardCheck size={17} className="shrink-0" />)}
        </div>
        {views.length > 0 && (
          <>
            {divider}
            {group('views', t('sidebar.savedViews'), views.map((v) => (
              <div key={v.id} className={cn('group flex items-center rounded-md', activeViewId === v.id ? 'bg-[var(--color-primary-soft)]' : 'hover:bg-[var(--color-muted)]')}>
                <button type="button" onClick={() => onApplyView(v)}
                  className={cn('flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-9 text-left text-[15px]', activeViewId === v.id && 'text-[var(--color-primary)]')}>
                  <span className="min-w-0 flex-1 truncate">{v.name}</span>
                  {v.shared && <Users size={12} className="shrink-0 text-[var(--color-subtle-foreground)]" aria-label={t('views.shared')} />}
                </button>
                {v.mine && (
                  <button type="button" aria-label={t('views.delete')} onClick={() => onDeleteView(v)}
                    className="hidden px-1.5 text-[var(--color-subtle-foreground)] hover:text-[var(--color-error)] group-hover:block"><X size={13} /></button>
                )}
              </div>
            )))}
          </>
        )}
        {!!data?.kpis.length && (
          <>
            {divider}
            {group('kpis', t('sidebar.byKpi'), data.kpis.map((k) => sub(`kpi:${k.kpiId}`, k.kpiName, () => onChange({ view: 'ALL', kpiId: k.kpiId }),
              <span className="text-sm text-[var(--color-subtle-foreground)]">{k.open}</span>)), undefined, <Target size={17} className="shrink-0" />)}
          </>
        )}
      </nav>
    </>
  )
}
