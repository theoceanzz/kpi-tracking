import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import { ChevronRight, HardDrive, Search } from 'lucide-react'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { KbDocument } from '../types'
import { FileTypeIcon } from './docUi'
import { useDocumentActions } from './DocumentActions'
import { tourAnchor } from '@/components/common/tours/anchors'

export interface NavItem<K extends string> {
  key: K
  label: string
  icon: LucideIcon
  /** "drive": các kho dưới mục Drive; "bottom": nút ở đáy thanh bên (Dung lượng | Thùng rác) như Lark. */
  group?: 'drive' | 'bottom'
  /** Số việc đang chờ (vd. đề xuất chờ duyệt). */
  badge?: number
}

interface Props<K extends string> {
  items: NavItem<K>[]
  active: K
  onSelect: (key: K) => void
  pinned: KbDocument[]
  /** Ô "Tìm kiếm" đầu thanh bên (tìm mọi tài liệu mình xem được). */
  search: string
  onSearch: (q: string) => void
}

/**
 * Thanh bên của trang Tài liệu theo Lark (docs/DOCUMENTS_LARK_REFERENCE.md §1): ô Tìm kiếm, Trang chủ, Drive (Của tôi /
 * Đơn vị / Công ty), Đề xuất, "Đã ghim ›" (chỉ hiện khi đã ghim), đáy là hai nút Dung lượng | Thùng rác. Dưới `lg` thu
 * thành một hàng chip cuộn ngang + ô tìm.
 */
export default function DocumentsNav<K extends string>({ items, active, onSelect, pinned, search, onSearch }: Props<K>) {
  const { t } = useTranslation('documents')
  const actions = useDocumentActions()
  const top = items.filter(i => !i.group)
  const drive = items.filter(i => i.group === 'drive')
  const bottom = items.filter(i => i.group === 'bottom')
  const [pinnedOpen, setPinnedOpen] = useState(true)

  // Ô tìm giữ chữ đang gõ; báo lên trang sau 300ms để không đổi URL theo từng phím.
  const [q, setQ] = useState(search)
  useEffect(() => { setQ(search) }, [search])
  useEffect(() => {
    if (q.trim() === search) return
    const h = setTimeout(() => onSearch(q.trim()), 300)
    return () => clearTimeout(h)
  }, [q, search, onSearch])
  const searchBox = (
    <Input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('nav.search')} aria-label={t('nav.search')}
           prefix={<Search aria-hidden="true" />} className="bg-[var(--color-muted)]" />
  )

  return (
    <>
      {/* Màn hẹp: ô tìm + một hàng chip. */}
      <div className="space-y-2 lg:hidden">
        {searchBox}
        <div className="custom-scrollbar flex gap-1.5 overflow-x-auto pb-1" role="navigation" aria-label={t('nav.label')}>
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
      </div>

      {/* Màn rộng: cột trái, đáy dính dưới cùng. */}
      <nav aria-label={t('nav.label')} className="hidden min-h-[calc(100dvh-220px)] flex-col rounded-card bg-[var(--color-card)] p-2 lg:flex">
        <div className="mb-2">{searchBox}</div>
        <div className="space-y-0.5">
          {top.slice(0, 1).map(i => <NavButton key={i.key} item={i} selected={i.key === active} onSelect={onSelect} />)}
        </div>
        {drive.length > 0 && (
          <div className="mt-0.5 space-y-0.5">
            <p className="flex h-9 items-center gap-2.5 px-2.5 text-sm text-[var(--color-foreground)]">
              <HardDrive size={16} className="text-[var(--color-muted-foreground)]" aria-hidden="true" />{t('nav.drive')}
            </p>
            {drive.map(i => <NavButton key={i.key} item={i} selected={i.key === active} onSelect={onSelect} indent />)}
          </div>
        )}
        {top.length > 1 && <div className="mt-0.5 space-y-0.5">{top.slice(1).map(i => <NavButton key={i.key} item={i} selected={i.key === active} onSelect={onSelect} />)}</div>}

        {/* Lark: "Pinned Docs" chỉ có trên thanh bên khi đã ghim thứ gì. */}
        {pinned.length > 0 && (
          <div className="mt-4">
            <button type="button" onClick={() => setPinnedOpen(o => !o)} aria-expanded={pinnedOpen}
                    className="flex items-center gap-1 px-2.5 pb-1 text-[13px] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
              {t('nav.pinned')}
              <ChevronRight size={13} className={cn('transition-transform', pinnedOpen && 'rotate-90')} aria-hidden="true" />
            </button>
            {pinnedOpen && (
              <ul className="space-y-0.5">
                {pinned.map(d => (
                  <li key={d.id}>
                    <button type="button" onClick={() => actions.open(d)} title={d.title}
                            className="flex h-8 w-full items-center gap-2 rounded-control px-2.5 text-left text-sm text-[var(--color-foreground)] hover:bg-[var(--color-muted)]">
                      <FileTypeIcon doc={d} size={11} />
                      <span className="truncate">{d.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {bottom.length > 0 && (
          <div className="mt-auto flex items-stretch border-t border-[var(--color-border)] pt-2">
            {bottom.map((i, idx) => {
              const Icon = i.icon
              const selected = i.key === active
              return (
                <span key={i.key} className="flex flex-1 items-center">
                  {idx > 0 && <span className="h-4 w-px bg-[var(--color-border)]" aria-hidden="true" />}
                  <button {...tourAnchor(`docs.nav.${i.key}`)} type="button" onClick={() => onSelect(i.key)}
                          aria-current={selected ? 'page' : undefined}
                          className={cn('mx-1 flex h-9 flex-1 items-center justify-center gap-1.5 rounded-control text-sm transition-colors [&_svg]:size-4',
                            selected ? 'bg-[var(--color-primary-soft)] font-medium text-[var(--color-primary)]'
                              : 'text-[var(--color-foreground)] hover:bg-[var(--color-muted)] [&_svg]:text-[var(--color-muted-foreground)]')}>
                    <Icon aria-hidden="true" /> {i.label}
                  </button>
                </span>
              )
            })}
          </div>
        )}
      </nav>
    </>
  )
}

function NavButton<K extends string>({ item, selected, onSelect, indent }: { item: NavItem<K>; selected: boolean; onSelect: (k: K) => void; indent?: boolean }) {
  const Icon = item.icon
  return (
    <button {...tourAnchor(`docs.nav.${item.key}`)}
      type="button"
      onClick={() => onSelect(item.key)}
      aria-current={selected ? 'page' : undefined}
      className={cn(
        'flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm transition-colors [&_svg]:size-4 [&_svg]:shrink-0',
        indent && 'pl-8',
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
