import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Plus, Search, Star, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import UserAvatar from '@/components/common/UserAvatar'
import { cn } from '@/lib/utils'
import type { TaskOption } from '../types'

interface Props {
  options: TaskOption[]
  /** Người đầu tiên là người phụ trách chính. */
  value: string[]
  onChange: (ids: string[]) => void
  /** Chỉ cho chọn một người (cờ nhiều người thực hiện đang tắt). */
  single?: boolean
  disabled?: boolean
  placeholder?: string
  /** Nhãn hiện cho người đang đăng nhập. */
  meId?: string
  max?: number
  /**
   * `lark`: cả vùng giá trị là nút mở hộp chọn như bảng chi tiết của Lark — một người: viên "avatar + tên"; nhiều người:
   * chồng avatar + "N người thực hiện"; chưa có: chữ xám mời bấm. Mặc định `chips` (chip từng người + nút "+ Thêm").
   */
  variant?: 'chips' | 'lark'
  /** Chân hộp chọn (Lark: "Việc hoàn thành khi một người / tất cả hoàn thành ▾"). */
  footer?: ReactNode
}

/**
 * Chọn người thực hiện: chip người đã chọn (người đầu là người chính — bấm ngôi sao để đổi), ô tìm có danh sách nhóm theo
 * đơn vị. Chế độ một người: chọn ai thì thay người đó.
 */
export default function PeopleMultiPicker({ options, value, onChange, single, disabled, placeholder, meId, max = 20, variant = 'chips', footer }: Props) {
  const { t } = useTranslation('tasks')
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options])
  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase()
    return options.filter((o) => !k || o.name.toLowerCase().includes(k) || (o.secondary ?? '').toLowerCase().includes(k)).slice(0, 80)
  }, [options, q])

  const toggle = (id: string) => {
    if (single) { onChange([id]); setOpen(false); return }
    if (value.includes(id)) onChange(value.filter((x) => x !== id))
    else if (value.length < max) onChange([...value, id])
  }
  const label = (id: string) => {
    const o = byId.get(id)
    const name = o?.name ?? '…'
    return id === meId ? t('new.me', { name }) : name
  }

  const list = (
      <PopoverContent className="w-80 p-2" align="start">
        <Input size="sm" value={q} autoFocus onChange={(e) => setQ(e.target.value)} prefix={<Search size={13} />} placeholder={t('picker.searchPerson')} />
        <div className="mt-2 max-h-72 overflow-y-auto">
          {filtered.map((o) => {
            const on = value.includes(o.id)
            return (
              <button key={o.id} type="button" onClick={() => toggle(o.id)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-[var(--color-muted)]">
                <UserAvatar fullName={o.name} avatarUrl={o.avatarUrl} className="h-6 w-6 shrink-0 rounded-full text-[9px]" fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{o.id === meId ? t('new.me', { name: o.name }) : o.name}</span>
                  <span className="block truncate text-[11px] text-[var(--color-subtle-foreground)]">{[o.groupName, o.detail].filter(Boolean).join(' · ')}</span>
                </span>
                {on && variant === 'lark' && !single && value.length > 1 && value[0] !== o.id && (
                  <span role="button" tabIndex={0} aria-label={t('assignees.makePrimary')} title={t('assignees.makePrimary')}
                    onClick={(e) => { e.stopPropagation(); onChange([o.id, ...value.filter((x) => x !== o.id)]) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange([o.id, ...value.filter((x) => x !== o.id)]) } }}
                    className="rounded p-0.5 text-[var(--color-subtle-foreground)] hover:text-[var(--color-warning)]"><Star size={12} /></span>
                )}
                {on && <Check size={14} className="text-[var(--color-primary)]" />}
              </button>
            )
          })}
          {filtered.length === 0 && <p className="p-2 text-xs text-[var(--color-subtle-foreground)]">{t('assign.noPeople')}</p>}
        </div>
        {footer && <div className="-mx-2 -mb-2 mt-2 border-t border-[var(--color-border)] px-2 py-1.5">{footer}</div>}
      </PopoverContent>
  )

  if (variant === 'lark') {
    const people = value.map((id) => ({ id, name: label(id), avatarUrl: byId.get(id)?.avatarUrl ?? null }))
    const pill = 'inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--color-muted)] py-0.5 pl-0.5 pr-2.5 text-sm text-[var(--color-foreground)]'
    const face = (p: { name: string; avatarUrl: string | null }, cls = 'h-6 w-6') => (
      <UserAvatar fullName={p.name} avatarUrl={p.avatarUrl} className={cn(cls, 'shrink-0 rounded-full text-[10px] ring-2 ring-[var(--color-muted)]')}
        fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]" />
    )
    const shown = people.length === 0
      ? <span className="px-1.5 text-[var(--color-muted-foreground)]">{placeholder ?? t('assignees.add')}</span>
      : people.length === 1
        ? <span className={pill}>{face(people[0]!)}<span className="truncate">{people[0]!.name}</span></span>
        : (
          <span className={pill} title={people.map((p) => p.name).join(', ')}>
            <span className="flex -space-x-1.5">{people.slice(0, 3).map((p) => <span key={p.id}>{face(p)}</span>)}</span>
            {t('assignees.count', { count: people.length })}
          </span>
        )
    if (disabled) return shown
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={t('detail.assignees')} className="max-w-full rounded-full text-left hover:opacity-80">{shown}</button>
        </PopoverTrigger>
        {list}
      </Popover>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((id, i) => (
        <span key={id} className={cn('inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-xs',
          i === 0 ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'bg-[var(--color-muted)]')}>
          <UserAvatar fullName={byId.get(id)?.name ?? ''} avatarUrl={byId.get(id)?.avatarUrl ?? null} className="h-5 w-5 rounded-full text-[9px]" fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]" />
          {label(id)}
          {!single && value.length > 1 && i > 0 && !disabled && (
            <button type="button" aria-label={t('assignees.makePrimary')} title={t('assignees.makePrimary')}
              onClick={() => onChange([id, ...value.filter((x) => x !== id)])} className="opacity-60 hover:opacity-100"><Star size={11} /></button>
          )}
          {!disabled && value.length > 1 && (
            <button type="button" aria-label={t('assignees.remove')} onClick={() => onChange(value.filter((x) => x !== id))}
              className="opacity-60 hover:opacity-100"><X size={11} /></button>
          )}
        </span>
      ))}
      {!disabled && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button type="button" aria-label={placeholder ?? t('assignees.add')}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--color-border-strong)] px-2 py-0.5 text-xs text-[var(--color-subtle-foreground)] hover:text-[var(--color-foreground)]">
              <Plus size={12} /> {value.length === 0 ? (placeholder ?? t('assignees.add')) : single ? t('assignees.change') : t('assignees.add')}
            </button>
          </PopoverTrigger>
          {list}
        </Popover>
      )}
    </div>
  )
}
