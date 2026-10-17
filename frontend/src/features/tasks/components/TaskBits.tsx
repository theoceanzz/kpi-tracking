import { useFieldText } from '../hooks/useFieldText'
import { CheckCircle2 } from 'lucide-react'
import type { ReactNode } from 'react'
import UserAvatar from '@/components/common/UserAvatar'
import { cn } from '@/lib/utils'
import { assigneesOf } from '../taskUtils'
import type { KpiTask, TaskListField, TaskTag } from '../types'

/** Chồng avatar người thực hiện (người chính đứng đầu); người đã tích phần mình có dấu xanh nhỏ. */
export function AssigneeStack({ task, max = 3, size = 'md' }: { task: KpiTask; max?: number; size?: 'sm' | 'md' }) {
  const people = assigneesOf(task)
  const shown = people.slice(0, max)
  const cls = size === 'sm' ? 'h-5 w-5 text-[9px]' : 'h-6 w-6 text-[10px]'
  return (
    <span className="inline-flex shrink-0 items-center -space-x-1.5" title={people.map((p) => p.fullName).join(', ')}>
      {shown.map((p) => (
        <span key={p.id} className="relative">
          <UserAvatar fullName={p.fullName} avatarUrl={p.avatarUrl} className={cn(cls, 'rounded-full ring-2 ring-[var(--color-card)]')} fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]" />
          {task.completionMode === 'ALL' && p.completedAt && (
            <CheckCircle2 size={10} className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[var(--color-card)] text-[var(--color-success)]" />
          )}
        </span>
      ))}
      {people.length > max && (
        <span className={cn(cls, 'inline-flex items-center justify-center rounded-full bg-[var(--color-muted)] text-[var(--color-subtle-foreground)] ring-2 ring-[var(--color-card)]')}>
          +{people.length - max}
        </span>
      )}
    </span>
  )
}

/** Viên "avatar + tên" như ô người của Lark ("Clarie S..."). */
export function PersonPill({ name, avatarUrl, suffix }: { name: string; avatarUrl: string | null; suffix?: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-[var(--color-muted)] py-0.5 pl-0.5 pr-2.5 text-sm text-[var(--color-foreground)]">
      <UserAvatar fullName={name} avatarUrl={avatarUrl} className="h-6 w-6 shrink-0 rounded-full text-[10px]"
        fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]" />
      <span className="min-w-0 truncate">{name}</span>
      {suffix}
    </span>
  )
}

/**
 * Người thực hiện trong cột bảng (như Lark): một người ⇒ viên avatar + tên; nhiều người ⇒ viên chồng avatar + tên người
 * chính "+N". Tên cắt gọn theo bề ngang cột, rê chuột xem đủ danh sách.
 */
export function AssigneeLabel({ task }: { task: KpiTask }) {
  const people = assigneesOf(task)
  const first = people.find((p) => p.primary) ?? people[0]
  if (!first) return null
  if (people.length === 1) return <span className="min-w-0 max-w-full" title={first.fullName ?? ''}><PersonPill name={first.fullName ?? ''} avatarUrl={first.avatarUrl} /></span>
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-[var(--color-muted)] py-0.5 pl-0.5 pr-2.5 text-sm text-[var(--color-foreground)]"
      title={people.map((p) => p.fullName).join(', ')}>
      <AssigneeStack task={task} max={2} />
      <span className="min-w-0 truncate">{first.fullName}</span>
      <span className="shrink-0 text-xs text-[var(--color-subtle-foreground)]">+{people.length - 1}</span>
    </span>
  )
}

export function TagChip({ tag, onRemove }: { tag: Pick<TaskTag, 'name' | 'color'>; onRemove?: () => void }) {
  const color = tag.color || 'var(--color-primary)'
  return (
    <span className="inline-flex max-w-[140px] items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>
      <span className="truncate">{tag.name}</span>
      {onRemove && <button type="button" onClick={onRemove} className="opacity-70 hover:opacity-100">×</button>}
    </span>
  )
}

/** Chip giá trị trường của một việc trong danh sách đang xem. */
export function FieldChips({ task, fields }: { task: KpiTask; fields: TaskListField[] }) {
  const text = useFieldText()
  const chips = fields.map((f) => {
    const v = task.fieldValues.find((x) => x.fieldId === f.id)?.value
    const label = text(f, v)
    if (!label) return null
    const color = f.type === 'SINGLE_SELECT' ? f.options.find((o) => o.id === v)?.color : null
    return (
      <span key={f.id} title={f.name} className="hidden max-w-[140px] truncate rounded border border-[var(--color-border)] px-1.5 text-[11px] text-[var(--color-subtle-foreground)] lg:inline"
        style={color ? { borderColor: color, color } : undefined}>
        {label}
      </span>
    )
  }).filter(Boolean)
  return <>{chips}</>
}
