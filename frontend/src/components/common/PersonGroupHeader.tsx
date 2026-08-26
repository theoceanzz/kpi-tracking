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
    slate: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    amber: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40',
    rose: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-900/40',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-900/40',
  }
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest whitespace-nowrap',
      tones[tone]
    )}>
      <span className="text-[11px] leading-none">{value}</span> {label}
    </span>
  )
}

/** Phần ruột dùng chung cho cả biến thể hàng bảng lẫn biến thể thẻ. */
function HeaderContent({ person, expanded, onToggle, badges, actions, isCurrentUser, indent }: PersonGroupHeaderProps) {
  const isUnassigned = person.id === UNASSIGNED_ID

  return (
    <div className={cn("flex items-center gap-3 sm:gap-4 w-full", indent && "pl-4 sm:pl-8")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 text-left group/person cursor-pointer"
      >
        <ChevronDown
          size={18}
          className={cn(
            'shrink-0 text-slate-400 transition-transform duration-300 group-hover/person:text-indigo-600',
            !expanded && '-rotate-90'
          )}
        />

        {isUnassigned ? (
          <div className="w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400">
            <UserX size={18} />
          </div>
        ) : (
          <UserAvatar
            fullName={person.name}
            avatarUrl={person.avatarUrl}
            className="w-10 h-10 rounded-2xl border border-indigo-200/50 dark:border-indigo-800/30 shadow-inner"
            fallbackClassName="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-900/40 font-black text-xs text-indigo-600 dark:text-indigo-400"
          />
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-slate-900 dark:text-white truncate group-hover/person:text-indigo-600 transition-colors">
              {person.name}
            </span>
            {isCurrentUser && (
              <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest shrink-0">
                Bạn
              </span>
            )}
          </div>
          {person.orgUnitName && (
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight truncate block">
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
    <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-y border-slate-100 dark:border-slate-800">
      <td colSpan={colSpan} className="px-4 py-3">
        <HeaderContent {...props} />
      </td>
    </tr>
  )
}

/** Biến thể dùng cho chế độ thẻ và bản mobile. */
export function PersonGroupHeaderCard(props: PersonGroupHeaderProps) {
  return (
    <div className="px-4 py-3 rounded-[20px] bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
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
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 text-left group/unit cursor-pointer"
      >
        <ChevronDown
          size={20}
          className={cn(
            'shrink-0 text-slate-500 dark:text-slate-400 transition-transform duration-300 group-hover/unit:text-indigo-600',
            !expanded && '-rotate-90'
          )}
        />
        <div className={cn(
          'w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center shadow-inner',
          isUnknown
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            : 'bg-gradient-to-br from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 text-white dark:text-slate-900'
        )}>
          <Building2 size={18} />
        </div>
        <div className="min-w-0 flex items-center gap-2">
          <span className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white truncate group-hover/unit:text-indigo-600 transition-colors">
            {unit.name}
          </span>
          {isCurrentUnit && (
            <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest shrink-0">
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
    <tr className="bg-slate-100/80 dark:bg-slate-800/70 border-y-2 border-slate-200 dark:border-slate-700">
      <td colSpan={colSpan} className="px-4 py-3.5">
        <UnitHeaderContent {...props} />
      </td>
    </tr>
  )
}

export function UnitGroupHeaderCard(props: UnitGroupHeaderProps) {
  return (
    <div className="px-4 py-3.5 rounded-[20px] bg-slate-100/80 dark:bg-slate-800/70 border-2 border-slate-200 dark:border-slate-700">
      <UnitHeaderContent {...props} />
    </div>
  )
}
