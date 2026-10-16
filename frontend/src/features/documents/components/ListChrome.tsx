import { useTranslation } from 'react-i18next'
import { LayoutGrid, List } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocLayout } from './DocumentList'

/** Tab chữ gạch chân kiểu Lark ("Recent · Owned by Me · …"): không icon, tab đang chọn chữ + gạch màu chính. */
export function UnderlineTabs<K extends string>({ items, value, onChange, label }: {
  items: { key: K; label: string }[]; value: K; onChange: (k: K) => void; label: string
}) {
  return (
    // Chỉ cuộn ngang khi hết chỗ (màn hẹp), không bao giờ cuộn dọc; ẩn thanh cuộn như tab của Lark.
    <div role="tablist" aria-label={label} className="flex min-w-0 gap-6 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map(it => (
        <button key={it.key} type="button" role="tab" aria-selected={value === it.key} onClick={() => onChange(it.key)}
                className={cn('shrink-0 border-b-2 py-2.5 text-[15px] transition-colors',
                  value === it.key
                    ? 'border-[var(--color-primary)] font-medium text-[var(--color-primary)]'
                    : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]')}>
          {it.label}
        </button>
      ))}
    </div>
  )
}

/** Hai nút danh sách / lưới ở góc phải danh sách (như Lark). */
export function LayoutToggle({ value, onChange }: { value: DocLayout; onChange: (l: DocLayout) => void }) {
  const { t } = useTranslation('documents')
  const btn = (l: DocLayout, Icon: typeof List, label: string) => (
    <button type="button" onClick={() => onChange(l)} aria-pressed={value === l} aria-label={label} title={label}
            className={cn('flex h-7 w-7 items-center justify-center rounded-control transition-colors [&_svg]:size-4',
              value === l ? 'bg-[var(--color-card)] text-[var(--color-primary)] shadow-sm' : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]')}>
      <Icon aria-hidden="true" />
    </button>
  )
  return (
    <div role="group" aria-label={t('layout.label')} className="flex gap-0.5 rounded-control bg-[var(--color-muted)] p-0.5">
      {btn('list', List, t('layout.list'))}
      {btn('grid', LayoutGrid, t('layout.grid'))}
    </div>
  )
}
