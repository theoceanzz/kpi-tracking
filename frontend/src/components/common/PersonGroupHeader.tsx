import type { ReactNode } from 'react'
import { Building2, ChevronDown, UserX } from 'lucide-react'
import UserAvatar from './UserAvatar'
import { cn } from '@/lib/utils'
import { UNASSIGNED_ID, UNKNOWN_UNIT_ID, type PersonRef, type UnitRef } from '@/lib/personGrouping'

interface PersonGroupHeaderProps {
  person: PersonRef
  expanded: boolean
  onToggle: () => void
  /** Số liệu tóm tắt của nhóm — dùng <PersonGroupBadge> cho đồng bộ. */
  badges?: ReactNode
  /** Nút thao tác áp cho cả nhóm (chọn tất cả, duyệt tất cả…). Tự chặn nổi bọt click. */
  actions?: ReactNode
  /** Đánh dấu nhóm của chính người đang đăng nhập. */
  isCurrentUser?: boolean
  /** Thụt vào khi nhóm người nằm bên trong một nhóm đơn vị. */
  indent?: boolean
}

interface UnitGroupHeaderProps {
  unit: UnitRef
  expanded: boolean
  onToggle: () => void
  badges?: ReactNode
  actions?: ReactNode
  /** Đánh dấu đơn vị của chính người đang đăng nhập. */
  isCurrentUnit?: boolean
}

/** Badge nhỏ dùng trong header nhóm, để 4 trang hiển thị số liệu giống nhau. */
export function PersonGroupBadge({ label, value, tone = 'slate' }: {
  label: string
  value: ReactNode
  tone?: 'slate' | 'amber' | 'emerald' | 'rose' | 'indigo'
}) {
  const tones: Record<string, string> = {
    slate: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)] border-[var(--color-border)]',
    amber: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]',
    emerald: 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]',
    rose: 'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error-border)]',
    indigo: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)] border-[var(--color-border)]',
  }
  return (
    <span className={cn(
      'text-eyebrow inline-flex items-center gap-1.5 px-2.5 py-1 rounded-control border whitespace-nowrap',
      tones[tone]
    )}>
      <span className="text-xs leading-none">{value}</span> {label}
    </span>
  )
}

/** Phần ruột dùng chung cho cả biến thể hàng bảng lẫn biến thể thẻ. */
function HeaderContent({ person, expanded, onToggle, badges, actions, isCurrentUser, indent }: PersonGroupHeaderProps) {
  const isUnassigned = person.id === UNASSIGNED_ID

  return (
    <div className={cn("flex items-center gap-3 sm:gap-4 w-full", indent && "pl-4 sm:pl-8")}>
      <button className="flex w-full items-center gap-3 rounded-card p-3 text-left transition-colors hover:bg-[var(--color-muted)] sm:gap-4 flex-1 min-w-0" type="button" onClick={onToggle} aria-expanded={expanded}>
        <ChevronDown aria-hidden="true"
          className={cn(
            'shrink-0 text-[var(--color-subtle-foreground)] transition-transform duration-300 group-hover/person:text-[var(--color-primary)]',
            !expanded && '-rotate-90'
          )}
        />

        {isUnassigned ? (
          <div className="w-10 h-10 rounded-card shrink-0 flex items-center justify-center bg-[var(--color-muted)] text-[var(--color-subtle-foreground)]">
            <UserX aria-hidden="true" />
          </div>
        ) : (
          <UserAvatar aria-hidden="true"
            fullName={person.name}
            avatarUrl={person.avatarUrl}
            className="w-10 h-10 rounded-card border border-[var(--color-border)] shadow-inner"
            fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-xs text-[var(--color-primary)]"
          />
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--color-foreground)] truncate group-hover/person:text-[var(--color-primary)] transition-colors">
              {person.name}
            </span>
            {isCurrentUser && (
              <span className="text-eyebrow px-1.5 py-0.5 rounded-control bg-[var(--color-primary-soft)] text-[var(--color-primary)] shrink-0">
                Bạn
              </span>
            )}
          </div>
          {person.orgUnitName && (
            <span className="text-caption font-medium uppercase tracking-tight truncate block">
              {person.orgUnitName}
            </span>
          )}
        </div>
      </button>

      {badges && <div className="hidden md:flex items-center gap-2 shrink-0">{badges}</div>}
      {actions && (
        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  )
}

/** Biến thể dùng bên trong <tbody> — chiếm trọn chiều ngang bảng. */
export function PersonGroupHeaderRow({ colSpan, ...props }: PersonGroupHeaderProps & { colSpan: number }) {
  return (
    <tr className="bg-[var(--color-muted)] border-y border-[var(--color-border)]">
      <td colSpan={colSpan} className="px-4 py-3">
        <HeaderContent {...props} />
      </td>
    </tr>
  )
}

/** Biến thể dùng cho chế độ thẻ và bản mobile. */
export function PersonGroupHeaderCard(props: PersonGroupHeaderProps) {
  return (
    <div className="px-4 py-3 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)]">
      <HeaderContent {...props} />
    </div>
  )
}

/**
 * Header của một ĐƠN VỊ — cấp ngoài cùng khi danh sách gom Đơn vị → Người → chi tiết.
 * Đậm hơn header người để hai cấp không lẫn vào nhau.
 */
function UnitHeaderContent({ unit, expanded, onToggle, badges, actions, isCurrentUnit }: UnitGroupHeaderProps) {
  const isUnknown = unit.id === UNKNOWN_UNIT_ID

  return (
    <div className="flex items-center gap-3 sm:gap-4 w-full">
      <button className="flex w-full items-center gap-3 rounded-card p-3 text-left transition-colors hover:bg-[var(--color-muted)] sm:gap-4 flex-1 min-w-0" type="button" onClick={onToggle} aria-expanded={expanded}>
        <ChevronDown aria-hidden="true"
          className={cn(
            'shrink-0 text-[var(--color-muted-foreground)] transition-transform duration-300 group-hover/unit:text-[var(--color-primary)]',
            !expanded && '-rotate-90'
          )}
        />
        <div className={cn(
          'w-10 h-10 rounded-card shrink-0 flex items-center justify-center shadow-inner',
          isUnknown
            ? 'bg-[var(--color-muted)] text-[var(--color-subtle-foreground)]'
            : 'bg-[var(--color-foreground)] text-[var(--color-background)]'
        )}>
          <Building2 aria-hidden="true" />
        </div>
        <div className="min-w-0 flex items-center gap-2">
          <span className="text-sm font-semibold uppercase tracking-tight text-[var(--color-foreground)] truncate group-hover/unit:text-[var(--color-primary)] transition-colors">
            {unit.name}
          </span>
          {isCurrentUnit && (
            <span className="text-eyebrow px-1.5 py-0.5 rounded-control bg-[var(--color-primary-soft)] text-[var(--color-primary)] shrink-0">
              Đơn vị của bạn
            </span>
          )}
        </div>
      </button>

      {badges && <div className="hidden md:flex items-center gap-2 shrink-0">{badges}</div>}
      {actions && (
        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  )
}

export function UnitGroupHeaderRow({ colSpan, ...props }: UnitGroupHeaderProps & { colSpan: number }) {
  return (
    <tr className="bg-[var(--color-muted)] border-y-2 border-[var(--color-border)]">
      <td colSpan={colSpan} className="px-4 py-3.5">
        <UnitHeaderContent {...props} />
      </td>
    </tr>
  )
}

export function UnitGroupHeaderCard(props: UnitGroupHeaderProps) {
  return (
    <div className="px-4 py-3.5 rounded-card bg-[var(--color-muted)] border-2 border-[var(--color-border)]">
      <UnitHeaderContent {...props} />
    </div>
  )
}
