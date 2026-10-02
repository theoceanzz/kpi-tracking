import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import { Pin } from 'lucide-react'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { cn } from '@/lib/utils'
import type { KbDocument } from '../types'
import { FileTypeIcon } from './docUi'
import { useDocumentActions } from './DocumentActions'

export interface NavItem<K extends string> {
  key: K
  label: string
  icon: LucideIcon
  /** Nhóm "Drive" có tiêu đề riêng như Lark. */
  group?: 'drive'
  /** Số việc đang chờ (vd. đề xuất chờ duyệt). */
  badge?: number
}

interface Props<K extends string> {
  items: NavItem<K>[]
  active: K
  onSelect: (key: K) => void
  pinned: KbDocument[]
}

/**
 * Thanh điều hướng bên trong trang Tài liệu (kiểu Lark): Trang chủ, Drive (Của tôi / Đơn vị / Công ty), Thùng rác,
 * và các tài liệu đã ghim. Dưới `lg` thu thành một hàng chip cuộn ngang.
 */
export default function DocumentsNav<K extends string>({ items, active, onSelect, pinned }: Props<K>) {
  const { t } = useTranslation('documents')
  const actions = useDocumentActions()
  const top = items.filter(i => !i.group)
  const drive = items.filter(i => i.group === 'drive')
  const last = top.slice(1)

  return (
    <>
      {/* Màn hẹp: một hàng chip. */}
      <div className="custom-scrollbar flex gap-1.5 overflow-x-auto pb-1 lg:hidden" role="navigation" aria-label={t('nav.label')}>
        {items.map(i => {
          const Icon = i.icon
          return (
            <ChoiceChip key={i.key} selected={i.key === active} onClick={() => onSelect(i.key)}>
              <Icon aria-hidden="true" /> {i.label}
              {!!i.badge && <span className="rounded-full bg-[var(--color-primary)] px-1.5 text-[10px] leading-4 text-[var(--color-primary-foreground)] tabular-nums">{i.badge}</span>}
            </ChoiceChip>
          )
        })}
      </div>

      {/* Màn rộng: cột trái. */}
      <nav aria-label={t('nav.label')} className="hidden space-y-4 lg:block">
        <div className="space-y-0.5">
          {top.slice(0, 1).map(i => <NavButton key={i.key} item={i} selected={i.key === active} onSelect={onSelect} />)}
        </div>
        {drive.length > 0 && (
          <div className="space-y-0.5">
            <p className="px-2.5 pb-1 text-eyebrow">{t('nav.drive')}</p>
            {drive.map(i => <NavButton key={i.key} item={i} selected={i.key === active} onSelect={onSelect} />)}
          </div>
        )}
        {last.length > 0 && <div className="space-y-0.5">{last.map(i => <NavButton key={i.key} item={i} selected={i.key === active} onSelect={onSelect} />)}</div>}

        <div>
          <p className="flex items-center gap-1.5 px-2.5 pb-1 text-eyebrow"><Pin size={12} aria-hidden="true" />{t('nav.pinned')}</p>
          {pinned.length === 0 ? (
            <p className="px-2.5 text-caption">{t('nav.pinnedEmpty')}</p>
          ) : (
            <ul className="space-y-0.5">
              {pinned.map(d => (
                <li key={d.id}>
                  <button type="button" onClick={() => actions.open(d)} title={d.title}
                          className="flex h-8 w-full items-center gap-2 rounded-control px-2.5 text-left text-sm text-[var(--color-foreground)] hover:bg-[var(--color-muted)]">
                    <FileTypeIcon doc={d} size={12} />
                    <span className="truncate">{d.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </nav>
    </>
  )
}

function NavButton<K extends string>({ item, selected, onSelect }: { item: NavItem<K>; selected: boolean; onSelect: (k: K) => void }) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={() => onSelect(item.key)}
      aria-current={selected ? 'page' : undefined}
      className={cn(
        'flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm transition-colors [&_svg]:size-4 [&_svg]:shrink-0',
        selected
          ? 'bg-[var(--color-primary-soft)] font-medium text-[var(--color-primary)]'
          : 'text-[var(--color-foreground)] hover:bg-[var(--color-muted)] [&_svg]:text-[var(--color-muted-foreground)]',
      )}
    >
      <Icon aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {!!item.badge && (
        <span className="rounded-full bg-[var(--color-primary)] px-1.5 text-xs leading-5 text-[var(--color-primary-foreground)] tabular-nums">{item.badge}</span>
      )}
    </button>
  )
}
