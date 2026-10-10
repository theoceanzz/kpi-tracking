import { useTranslation } from 'react-i18next'
import { CheckCircle2, Eye, Inbox, Layers, ListTodo, Send, Target, User as UserIcon, Users } from 'lucide-react'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { TaskSidebar, TaskView } from '../types'
import { tourAnchor } from '@/components/common/tours/anchors'

export interface SidebarSelection {
  view: TaskView
  kpiId?: string
}

interface Props {
  data?: TaskSidebar
  value: SidebarSelection
  onChange: (v: SidebarSelection) => void
}

const VIEWS: { view: TaskView; icon: typeof Inbox; count: (d: TaskSidebar) => number | null }[] = [
  { view: 'ASSIGNED', icon: UserIcon, count: (d) => d.assigned },
  { view: 'FOLLOWING', icon: Eye, count: (d) => d.following },
  { view: 'CREATED', icon: Inbox, count: (d) => d.created },
  { view: 'DELEGATED', icon: Send, count: (d) => d.delegated },
  { view: 'DONE', icon: CheckCircle2, count: () => null },
  { view: 'ALL', icon: Layers, count: (d) => d.all },
]

const keyOf = (v: SidebarSelection) => (v.kpiId ? `kpi:${v.kpiId}` : `view:${v.view}`)

/**
 * Cột trái của trang Công việc: nhóm "Của tôi" (Tôi phụ trách / theo dõi / tạo / giao cho người khác / Đã hoàn thành /
 * Tất cả), nhóm "Theo KPI" (KPI của tôi trong đợt đang diễn ra + số việc chưa xong) và "Việc của đơn vị" (TASK:VIEW_TEAM).
 * Điện thoại: thành một ô chọn thả xuống.
 */
export default function TaskSidebarNav({ data, value, onChange }: Props) {
  const { t } = useTranslation('tasks')
  const active = keyOf(value)

  const item = (key: string, label: string, Icon: typeof Inbox, count: number | null | undefined, onClick: () => void) => (
    <button key={key} type="button" onClick={onClick}
      className={cn('flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
        active === key ? 'bg-[var(--color-primary-soft)] font-medium text-[var(--color-primary)]' : 'text-[var(--color-foreground)] hover:bg-[var(--color-muted)]')}>
      <Icon size={15} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {!!count && <span className="text-xs text-[var(--color-subtle-foreground)]">{count}</span>}
    </button>
  )

  return (
    <>
      {/* Điện thoại */}
      <div className="md:hidden">
        <Select value={active} onValueChange={(k) => {
          if (k.startsWith('kpi:')) onChange({ view: 'ALL', kpiId: k.slice(4) })
          else onChange({ view: k.slice(5) as TaskView })
        }}>
          <SelectTrigger {...tourAnchor('tasks.views')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>{t('sidebar.mine')}</SelectLabel>
              {VIEWS.map((v) => <SelectItem key={v.view} value={`view:${v.view}`}>{t(`view.${v.view}`)}</SelectItem>)}
              {data?.canViewTeam && <SelectItem value="view:TEAM">{t('view.TEAM')}</SelectItem>}
            </SelectGroup>
            {!!data?.kpis.length && (
              <SelectGroup>
                <SelectLabel>{t('sidebar.byKpi')}</SelectLabel>
                {data.kpis.map((k) => <SelectItem key={k.kpiId} value={`kpi:${k.kpiId}`}>{k.kpiName} ({k.open})</SelectItem>)}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Máy tính */}
      <nav {...tourAnchor('tasks.views')} className="hidden w-60 shrink-0 space-y-4 md:block" aria-label={t('sidebar.label')}>
        <div className="space-y-0.5">
          <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--color-subtle-foreground)]">{t('sidebar.mine')}</p>
          {VIEWS.map((v) => item(`view:${v.view}`, t(`view.${v.view}`), v.icon, data ? v.count(data) : null, () => onChange({ view: v.view })))}
        </div>
        {data?.canViewTeam && (
          <div className="space-y-0.5">
            <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--color-subtle-foreground)]">{t('sidebar.team')}</p>
            {item('view:TEAM', t('view.TEAM'), Users, null, () => onChange({ view: 'TEAM' }))}
          </div>
        )}
        <div className="space-y-0.5">
          <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--color-subtle-foreground)]">{t('sidebar.byKpi')}</p>
          {(data?.kpis ?? []).map((k) => item(`kpi:${k.kpiId}`, k.kpiName, Target, k.open, () => onChange({ view: 'ALL', kpiId: k.kpiId })))}
          {data && data.kpis.length === 0 && (
            <p className="flex items-center gap-2 px-2.5 py-1 text-xs text-[var(--color-subtle-foreground)]"><ListTodo size={13} /> {t('sidebar.noKpis')}</p>
          )}
        </div>
      </nav>
    </>
  )
}
