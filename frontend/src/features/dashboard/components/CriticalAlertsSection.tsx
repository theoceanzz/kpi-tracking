import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  TriangleAlert, ShieldCheck, Clock, Building2, Users,
  ChevronRight, Search, ExternalLink, Flame, Eye, Activity,
  type LucideIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SEVERITY_META, countBySeverity,
  type AlertSeverity, type DashboardAlert
} from '../utils/dashboardAlerts'

const PAGE_SIZE = 6

type FilterKey = 'ALL' | AlertSeverity

const severityStyles: Record<AlertSeverity, {
  chip: string
  bar: string
  icon: string
  dot: string
  tile: string
}> = {
  URGENT: {
    chip: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30',
    bar: 'bg-red-500',
    icon: 'bg-red-500/10 text-red-500 border-red-500/20',
    dot: 'bg-red-500',
    tile: 'hover:border-red-300/70 dark:hover:border-red-500/40 hover:shadow-[0_16px_40px_-20px_rgba(239,68,68,0.5)]',
  },
  REVIEW: {
    chip: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30',
    bar: 'bg-amber-500',
    icon: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    dot: 'bg-amber-500',
    tile: 'hover:border-amber-300/70 dark:hover:border-amber-500/40 hover:shadow-[0_16px_40px_-20px_rgba(245,158,11,0.5)]',
  },
  MONITOR: {
    chip: 'bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30',
    bar: 'bg-sky-500',
    icon: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
    dot: 'bg-sky-500',
    tile: 'hover:border-sky-300/70 dark:hover:border-sky-500/40 hover:shadow-[0_16px_40px_-20px_rgba(14,165,233,0.5)]',
  },
}

const severityIcon: Record<AlertSeverity, LucideIcon> = {
  URGENT: Flame,
  REVIEW: Eye,
  MONITOR: Activity,
}

const kindIcon = {
  APPROVAL: Clock,
  ORG_UNIT: Building2,
  EMPLOYEE: Users,
} as const

interface Props {
  alerts: DashboardAlert[]
  periodName?: string | null
  daysRemaining: number | null
  /** Mở modal hiệu suất chi tiết của nhân sự; chỉ có khi đang trong một kỳ */
  onSelectEmployee?: (userId: string, fullName: string) => void
}

export function CriticalAlertsSection({ alerts, periodName, daysRemaining, onSelectEmployee }: Props) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<FilterKey>('ALL')
  const [search, setSearch] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const counts = useMemo(() => countBySeverity(alerts), [alerts])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return alerts.filter(a => {
      if (filter !== 'ALL' && a.severity !== filter) return false
      if (!keyword) return true
      return (
        a.title.toLowerCase().includes(keyword) ||
        a.subtitle.toLowerCase().includes(keyword) ||
        a.reasons.some(r => r.toLowerCase().includes(keyword))
      )
    })
  }, [alerts, filter, search])

  const shown = filtered.slice(0, visible)

  const changeFilter = (key: FilterKey) => {
    setFilter(key)
    setVisible(PAGE_SIZE)
  }

  const openAlert = (alert: DashboardAlert) => {
    if (alert.employee && onSelectEmployee) {
      onSelectEmployee(alert.employee.userId, alert.employee.fullName)
      return
    }
    if (alert.link) navigate(alert.link)
  }

  const filters: { key: FilterKey; label: string; count: number; hint: string }[] = [
    { key: 'ALL', label: 'Tất cả', count: alerts.length, hint: 'Toàn bộ cảnh báo đang mở' },
    { key: 'URGENT', label: SEVERITY_META.URGENT.label, count: counts.URGENT, hint: SEVERITY_META.URGENT.hint },
    { key: 'REVIEW', label: SEVERITY_META.REVIEW.label, count: counts.REVIEW, hint: SEVERITY_META.REVIEW.hint },
    { key: 'MONITOR', label: SEVERITY_META.MONITOR.label, count: counts.MONITOR, hint: SEVERITY_META.MONITOR.hint },
  ]

  return (
    <div
      id="tour-dashboard-alerts"
      className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200/60 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shrink-0">
            <TriangleAlert size={22} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base md:text-lg font-black tracking-tight text-slate-900 dark:text-white">
              Tiêu điểm cần can thiệp
            </h3>
            <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-[0.18em] mt-1 truncate">
              Xếp theo mức ưu tiên
              {periodName ? ` • ${periodName}` : ''}
              {daysRemaining !== null ? ` • còn ${daysRemaining} ngày` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:w-[260px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setVisible(PAGE_SIZE) }}
              placeholder="Tìm nhân sự, đơn vị, lý do..."
              className="w-full pl-11 pr-4 py-3 rounded-[18px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none text-xs font-semibold transition-all"
            />
          </div>
          <Link
            to="/submissions/org-unit"
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-[18px] bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 dark:hover:bg-indigo-600 dark:hover:text-white transition-all active:scale-95 shrink-0"
          >
            Trung tâm duyệt <ExternalLink size={14} />
          </Link>
        </div>
      </div>

      {/* Bộ lọc mức ưu tiên */}
      <div className="px-6 md:px-8 pt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {filters.map(f => {
          const active = filter === f.key
          const style = f.key === 'ALL' ? null : severityStyles[f.key]
          return (
            <button
              key={f.key}
              onClick={() => changeFilter(f.key)}
              className={cn(
                'text-left p-4 rounded-[22px] border transition-all active:scale-[0.98]',
                active
                  ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white shadow-lg'
                  : 'border-slate-200/70 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={cn('w-2 h-2 rounded-full', style ? style.dot : 'bg-indigo-500')} />
                <span className={cn(
                  'text-[9px] font-black uppercase tracking-[0.2em]',
                  active ? 'text-white dark:text-slate-900' : 'text-slate-400'
                )}>
                  {f.label}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={cn(
                  'text-2xl font-black tracking-tighter',
                  active ? 'text-white dark:text-slate-900' : 'text-slate-900 dark:text-white'
                )}>
                  {f.count}
                </span>
                <span className={cn(
                  'text-[10px] font-bold truncate',
                  active ? 'text-white/60 dark:text-slate-900/60' : 'text-slate-400'
                )}>
                  mục
                </span>
              </div>
              <p className={cn(
                'text-[9px] font-bold mt-1.5 leading-tight',
                active ? 'text-white/60 dark:text-slate-900/60' : 'text-slate-400'
              )}>
                {f.hint}
              </p>
            </button>
          )
        })}
      </div>

      {/* Danh sách cảnh báo */}
      <div className="p-6 md:p-8 space-y-3">
        {shown.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-4">
              <ShieldCheck size={30} />
            </div>
            <p className="text-sm font-black text-slate-700 dark:text-slate-200">
              {alerts.length === 0 ? 'Hệ thống đang vận hành ổn định' : 'Không có mục nào khớp bộ lọc'}
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
              {alerts.length === 0 ? 'Không có cảnh báo mới' : 'Thử đổi mức ưu tiên hoặc từ khoá khác'}
            </p>
          </div>
        ) : (
          <>
            {shown.map(alert => (
              <AlertRow key={alert.id} alert={alert} onOpen={() => openAlert(alert)} />
            ))}

            {filtered.length > shown.length && (
              <button
                onClick={() => setVisible(v => v + PAGE_SIZE)}
                className="w-full py-4 rounded-[22px] border border-dashed border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-all"
              >
                Xem thêm {filtered.length - shown.length} mục
              </button>
            )}
            {visible > PAGE_SIZE && filtered.length <= shown.length && (
              <button
                onClick={() => setVisible(PAGE_SIZE)}
                className="w-full py-4 rounded-[22px] border border-dashed border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600 transition-all"
              >
                Thu gọn
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function AlertRow({ alert, onOpen }: { alert: DashboardAlert; onOpen: () => void }) {
  const style = severityStyles[alert.severity]
  const SeverityIcon = severityIcon[alert.severity]
  const KindIcon = kindIcon[alert.kind]

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        'group relative flex flex-col lg:flex-row lg:items-center gap-4 p-4 md:p-5 pl-6 rounded-[24px] border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900/60 cursor-pointer transition-all overflow-hidden',
        style.tile
      )}
    >
      <span className={cn('absolute left-0 top-4 bottom-4 w-1.5 rounded-full', style.bar)} />

      <div className={cn('w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0', style.icon)}>
        <KindIcon size={19} />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-[0.15em]',
            style.chip
          )}>
            <SeverityIcon size={11} /> {SEVERITY_META[alert.severity].label}
          </span>
          <p className="text-sm font-black text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {alert.title}
          </p>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
            • {alert.subtitle}
          </span>
        </div>

        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
          {alert.description}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {alert.reasons.map((reason, i) => (
            <span
              key={i}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300"
            >
              {reason}
            </span>
          ))}
        </div>

        {alert.progress !== null && (
          <div className="h-1.5 w-full max-w-md bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-1000', style.bar)}
              style={{ width: `${Math.min(100, Math.max(0, alert.progress))}%` }}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-5 lg:gap-6 shrink-0 lg:border-l border-slate-100 dark:border-slate-800 lg:pl-6">
        {alert.metrics.map(metric => (
          <div key={metric.label} className="text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">{metric.label}</p>
            <p className="text-base font-black text-slate-900 dark:text-white tracking-tight mt-0.5">{metric.value}</p>
          </div>
        ))}

        <div className="w-9 h-9 shrink-0 ml-auto lg:ml-0 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 group-hover:bg-indigo-600 group-hover:text-white transition-all">
          <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </div>
  )
}
