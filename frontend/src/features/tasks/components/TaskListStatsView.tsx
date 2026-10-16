import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDown, ArrowUp, LayoutDashboard, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import UserAvatar from '@/components/common/UserAvatar'
import ChartTooltip from '@/components/charts/ChartTooltip'
import { yAxisLabel } from '@/components/charts/axisLabel'
import { AXIS_COLORS, seriesColor } from '@/components/charts/chartPalette'
import { formatDate, formatNumber } from '@/i18n/format'
import { getApiErrorMessage } from '@/lib/apiError'
import { listApi } from '../api/listApi'
import { useSetTaskList, useTaskList, useTaskListStats } from '../hooks/useTasks'
import { isClosed, PRIORITY_COLOR } from '../taskUtils'
import { TASK_PRIORITIES, TASK_STATUSES, type KpiTask, type TaskListDetail, type TaskListStats } from '../types'

const DEFAULT_WIDGETS = ['summary', 'weekly', 'status', 'assignee', 'section']
const STATUS_COLOR: Record<string, string> = {
  TODO: 'var(--color-muted-foreground)', IN_PROGRESS: 'var(--color-info)', DONE: 'var(--color-success)', CANCELLED: 'var(--color-border-strong)',
}
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

/**
 * Bảng điều khiển của một danh sách kiểu Lark — chỉ trên các việc NGƯỜI XEM thấy được (máy chủ lọc). Các ô: số liệu
 * chính, diễn biến theo tuần, tỉ lệ trạng thái, ưu tiên, từng người thực hiện, từng nhóm, nhãn, trường chọn một. Người sửa
 * trở lên bật / tắt và sắp thứ tự ô ("Tuỳ chỉnh bảng"); cấu hình lưu cho cả danh sách.
 */
export default function TaskListStatsView({ list }: { list: TaskListDetail }) {
  const { t } = useTranslation('tasks')
  const { data: s, isLoading } = useTaskListStats(list.id)
  const { data: page } = useTaskList({ view: 'LIST', listId: list.id, size: 500 })
  const tasks = useMemo(() => page?.content ?? [], [page])
  const canEdit = !list.archived && (list.role === 'OWNER' || list.role === 'EDITOR')
  const selectFields = list.fields.filter((f) => f.type === 'SINGLE_SELECT')
  const available = ['summary', 'weekly', 'status', 'priority', 'assignee', 'section', 'tags', ...selectFields.map((f) => `field:${f.id}`)]
  const widgets = (list.dashboard?.widgets ?? DEFAULT_WIDGETS).filter((w) => available.includes(w))

  if (isLoading || !s) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[var(--color-subtle-foreground)]" /></div>
  }
  const label = (w: string) => w.startsWith('field:') ? list.fields.find((f) => `field:${f.id}` === w)?.name ?? '?' : t(`dashboard.w.${w}`)

  return (
    <div className="space-y-4 pb-8">
      {canEdit && (
        <div className="flex justify-end">
          <CustomizeButton list={list} available={available} current={widgets} label={label} />
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {widgets.map((w) => {
          const full = w === 'summary' || w === 'weekly'
          return <div key={w} className={full ? 'lg:col-span-2' : undefined}><Widget id={w} s={s} tasks={tasks} list={list} /></div>
        })}
      </div>
      {widgets.length === 0 && <p className="py-10 text-center text-sm text-[var(--color-subtle-foreground)]">{t('dashboard.empty')}</p>}
    </div>
  )
}

function Card({ title, children, legend }: { title: string; children: ReactNode; legend?: ReactNode }) {
  return (
    <div className="h-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-foreground)]">{title}</h3>
        <div className="flex-1" />
        {legend}
      </div>
      {children}
    </div>
  )
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <span className="flex flex-wrap gap-3">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5 text-xs text-[var(--color-subtle-foreground)]">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: i.color }} /> {i.label}
        </span>
      ))}
    </span>
  )
}

/** Thanh ngang so sánh giữa các nhóm (nhãn, lựa chọn của trường): tên · thanh · số. */
function HBars({ rows, unit }: { rows: { key: string; label: string; value: number; color?: string | null }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  if (rows.length === 0) return <p className="text-xs text-[var(--color-subtle-foreground)]">-</p>
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2 text-xs" title={`${r.label}: ${formatNumber(r.value)} ${unit}`}>
          <span className="w-28 shrink-0 truncate text-[var(--color-foreground)]">{r.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--color-muted)]">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, backgroundColor: r.color ?? seriesColor(0) }} />
          </div>
          <span className="w-10 shrink-0 text-right tabular-nums text-[var(--color-subtle-foreground)]">{formatNumber(r.value)}</span>
        </div>
      ))}
    </div>
  )
}

function Widget({ id, s, tasks, list }: { id: string; s: TaskListStats; tasks: KpiTask[]; list: TaskListDetail }) {
  const { t } = useTranslation('tasks')
  const open = tasks.filter((x) => !isClosed(x))
  const unit = t('stats.tasksUnit')

  if (id === 'summary') {
    const cards = [
      { key: 'total', value: s.total },
      { key: 'open', value: s.open },
      { key: 'done', value: s.done, hint: `${pct(s.done, s.total - s.cancelled)}%` },
      { key: 'overdue', value: s.overdue, tone: s.overdue ? 'text-[var(--color-error)]' : undefined },
      { key: 'noDue', value: s.noDue },
    ]
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {cards.map((c) => (
          <div key={c.key} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <p className="text-xs text-[var(--color-subtle-foreground)]">{t(`stats.${c.key}`)}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums text-[var(--color-foreground)] ${c.tone ?? ''}`}>
              {formatNumber(c.value)} {c.hint && <span className="text-sm font-normal text-[var(--color-subtle-foreground)]">{c.hint}</span>}
            </p>
          </div>
        ))}
      </div>
    )
  }

  if (id === 'weekly') {
    const weekly = s.weekly.map((w) => ({ ...w, label: formatDate(w.weekStart).slice(0, 5) }))
    const createdColor = seriesColor(0)
    const doneColor = seriesColor(2)
    return (
      <Card title={t('stats.weeklyTitle')} legend={<Legend items={[{ color: createdColor, label: t('stats.created') }, { color: doneColor, label: t('stats.completed') }]} />}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={weekly} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: AXIS_COLORS.tick }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: AXIS_COLORS.tick }} axisLine={false} tickLine={false} width={48}
              label={yAxisLabel(unit)} />
            <Tooltip cursor={{ fill: 'var(--color-muted)' }} content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const w = payload[0]!.payload as (typeof weekly)[number]
              return (
                <ChartTooltip title={t('stats.weekOf', { date: formatDate(w.weekStart) })} rows={[
                  { color: createdColor, label: t('stats.created'), value: `${formatNumber(w.created)} ${unit}` },
                  { color: doneColor, label: t('stats.completed'), value: `${formatNumber(w.completed)} ${unit}` },
                ]} />
              )
            }} />
            <Bar dataKey="created" fill={createdColor} radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="completed" fill={doneColor} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    )
  }

  if (id === 'status') {
    // Phần trên tổng thể ⇒ một thanh 100% chia theo trạng thái.
    const total = TASK_STATUSES.reduce((n, st) => n + (s.byStatus[st] ?? 0), 0)
    const items = TASK_STATUSES.map((st) => ({ color: STATUS_COLOR[st]!, label: t(`status.${st}`) }))
    return (
      <Card title={t('dashboard.w.status')} legend={<Legend items={items} />}>
        <div className="flex h-6 overflow-hidden rounded-full bg-[var(--color-muted)]">
          {TASK_STATUSES.map((st) => {
            const v = s.byStatus[st] ?? 0
            return v ? <div key={st} title={`${t(`status.${st}`)}: ${formatNumber(v)} ${unit} (${pct(v, total)}%)`}
              style={{ width: `${pct(v, total)}%`, backgroundColor: STATUS_COLOR[st] }} /> : null
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TASK_STATUSES.map((st) => (
            <div key={st} className="text-xs">
              <p className="text-[var(--color-subtle-foreground)]">{t(`status.${st}`)}</p>
              <p className="tabular-nums text-[var(--color-foreground)]">{formatNumber(s.byStatus[st] ?? 0)} {unit} · {pct(s.byStatus[st] ?? 0, total)}%</p>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  if (id === 'priority') {
    return (
      <Card title={t('dashboard.w.priority')}>
        <HBars unit={unit} rows={TASK_PRIORITIES.map((p) => ({
          key: p, label: t(`priority.${p}`), value: open.filter((x) => x.priority === p).length, color: PRIORITY_COLOR[p],
        }))} />
      </Card>
    )
  }

  if (id === 'assignee') {
    return (
      <Card title={t('stats.byAssignee')}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--color-subtle-foreground)]">
              <th className="pb-2 font-medium">{t('stats.person')}</th>
              <th className="pb-2 text-right font-medium">{t('stats.open')}</th>
              <th className="pb-2 text-right font-medium">{t('stats.done')}</th>
              <th className="pb-2 text-right font-medium">{t('stats.overdue')}</th>
            </tr>
          </thead>
          <tbody>
            {s.byAssignee.map((a) => (
              <tr key={a.userId} className="border-t border-[var(--color-border)]">
                <td className="py-2"><span className="inline-flex items-center gap-2">
                  <UserAvatar fullName={a.name} avatarUrl={a.avatarUrl} className="h-6 w-6 rounded-full text-[10px]" fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]" />{a.name}
                </span></td>
                <td className="py-2 text-right tabular-nums">{formatNumber(a.open)}</td>
                <td className="py-2 text-right tabular-nums">{formatNumber(a.done)}</td>
                <td className={`py-2 text-right tabular-nums ${a.overdue ? 'text-[var(--color-error)]' : ''}`}>{formatNumber(a.overdue)}</td>
              </tr>
            ))}
            {s.byAssignee.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-xs text-[var(--color-subtle-foreground)]">-</td></tr>}
          </tbody>
        </table>
      </Card>
    )
  }

  if (id === 'section') {
    return (
      <Card title={t('stats.bySection')}>
        <div className="space-y-3">
          {s.bySection.map((sec) => {
            const total = sec.open + sec.done
            return (
              <div key={sec.sectionId ?? 'none'}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-[var(--color-foreground)]">{sec.name ?? t('group.noSection')}</span>
                  <span className="tabular-nums text-[var(--color-subtle-foreground)]">
                    {t('stats.doneOf', { done: formatNumber(sec.done), total: formatNumber(total) })}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-muted)]">
                  <div className="h-full rounded-full bg-[var(--color-success)]" style={{ width: `${pct(sec.done, total)}%` }} />
                </div>
              </div>
            )
          })}
          {s.bySection.length === 0 && <p className="text-xs text-[var(--color-subtle-foreground)]">-</p>}
        </div>
      </Card>
    )
  }

  if (id === 'tags') {
    const counts = new Map<string, { label: string; color: string | null; value: number }>()
    open.forEach((x) => x.tags.forEach((g) => {
      const c = counts.get(g.id) ?? { label: g.name, color: g.color, value: 0 }
      c.value++
      counts.set(g.id, c)
    }))
    return (
      <Card title={t('dashboard.w.tags')}>
        <HBars unit={unit} rows={[...counts.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 12)
          .map(([k, v]) => ({ key: k, label: v.label, value: v.value, color: v.color }))} />
      </Card>
    )
  }

  if (id.startsWith('field:')) {
    const field = list.fields.find((f) => `field:${f.id}` === id)
    if (!field) return null
    const valueOf = (x: KpiTask) => x.fieldValues.find((v) => v.fieldId === field.id)?.value
    return (
      <Card title={t('dashboard.fieldTitle', { name: field.name })}>
        <HBars unit={unit} rows={[
          ...field.options.map((o) => ({ key: o.id, label: o.label, value: open.filter((x) => valueOf(x) === o.id).length, color: o.color })),
          { key: 'none', label: t('group.noValue'), value: open.filter((x) => valueOf(x) == null).length, color: 'var(--color-border-strong)' },
        ]} />
      </Card>
    )
  }
  return null
}

/** "Tuỳ chỉnh bảng": bật / tắt và sắp thứ tự các ô; lưu cho cả danh sách. */
function CustomizeButton({ list, available, current, label }: {
  list: TaskListDetail; available: string[]; current: string[]; label: (w: string) => string
}) {
  const { t } = useTranslation('tasks')
  const setList = useSetTaskList()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>(current)
  const order = [...draft, ...available.filter((w) => !draft.includes(w))]
  const move = (w: string, dir: -1 | 1) => {
    const i = draft.indexOf(w), j = i + dir
    if (i < 0 || j < 0 || j >= draft.length) return
    const next = [...draft]
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    setDraft(next)
  }
  const save = () => {
    listApi.setDashboard(list.id, { widgets: draft })
      .then((d) => { setList(d); setOpen(false); toast.success(t('dashboard.saved')) })
      .catch((e) => toast.error(getApiErrorMessage(e)))
  }
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setDraft(current) }}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline"><LayoutDashboard /> {t('dashboard.customize')}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end">
        <p className="px-1 pb-1.5 text-xs text-[var(--color-subtle-foreground)]">{t('dashboard.customizeHint')}</p>
        <div className="max-h-80 space-y-0.5 overflow-y-auto">
          {order.map((w) => {
            const on = draft.includes(w)
            return (
              <div key={w} className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-[var(--color-muted)]">
                <Checkbox checked={on} aria-label={label(w)} onCheckedChange={(v) => setDraft(v ? [...draft, w] : draft.filter((x) => x !== w))} />
                <span className="min-w-0 flex-1 truncate text-sm">{label(w)}</span>
                {on && (
                  <>
                    <button type="button" aria-label={t('lists.moveUp')} onClick={() => move(w, -1)} className="opacity-0 group-hover:opacity-100"><ArrowUp size={13} /></button>
                    <button type="button" aria-label={t('lists.moveDown')} onClick={() => move(w, 1)} className="opacity-0 group-hover:opacity-100"><ArrowDown size={13} /></button>
                  </>
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setDraft(DEFAULT_WIDGETS.filter((w) => available.includes(w)))}>{t('list.resetColumns')}</Button>
          <Button size="sm" onClick={save}>{t('lists.save')}</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
