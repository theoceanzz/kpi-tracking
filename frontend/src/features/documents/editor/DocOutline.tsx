import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronsLeft, ListTree } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface OutlineItem {
  id: string
  level: number
  text: string
}

interface Props {
  title: string
  items: OutlineItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

const scrollTo = (id: string) =>
  document.querySelector(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

/** Danh sách mục lục: dòng đầu là tên tài liệu, dưới là các tiêu đề thụt theo cấp; bấm để cuộn tới. */
function OutlineList({ title, items, onPick }: { title: string; items: OutlineItem[]; onPick?: () => void }) {
  const { t } = useTranslation('documents')
  return (
    <>
      <button type="button" onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); onPick?.() }}
              className="block w-full truncate rounded-control px-2 py-1 text-left text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-muted)]"
              title={title}>
        {title || t('editor.titlePlaceholder')}
      </button>
      <ul className="mt-0.5">
        {items.map(h => (
          <li key={h.id}>
            <button type="button" onClick={() => { scrollTo(h.id); onPick?.() }} title={h.text}
                    className={cn('block w-full truncate rounded-control py-1 pr-2 text-left text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]',
                      h.level <= 1 ? 'pl-2' : h.level === 2 ? 'pl-5' : 'pl-8')}>
              {h.text}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

/**
 * Mục lục kiểu Lark (docs/DOCUMENTS_LARK_REFERENCE.md §6), nằm nổi trong LỀ TRÁI của khung tài liệu — không chiếm cột
 * riêng, nên nội dung luôn ở giữa trang. Lề đủ rộng: danh sách dính theo khi cuộn, « thu gọn thành một nút. Lề hẹp:
 * chỉ một nút, bấm mở danh sách nổi. Trang chỉ vẽ khi tài liệu có tiêu đề.
 */
export default function DocOutline({ title, items, open, onOpenChange }: Props) {
  const { t } = useTranslation('documents')
  const [popover, setPopover] = useState(false)
  const iconBtn = 'flex h-8 w-8 items-center justify-center rounded-control text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]'

  return (
    <>
      {/* Lề rộng (khung ≥ 1300px: còn ≥ 200px mỗi bên nội dung 900px). */}
      <nav aria-label={t('editor.toc')} className="sticky top-20 hidden max-h-[calc(100dvh-120px)] overflow-y-auto pr-2 @min-[1300px]:block">
        {open ? (
          <>
            <button type="button" onClick={() => onOpenChange(false)} aria-label={t('editor.tocCollapse')} title={t('editor.tocCollapse')}
                    className={cn(iconBtn, 'mb-2 h-7 w-7')}>
              <ChevronsLeft size={16} aria-hidden="true" />
            </button>
            <OutlineList title={title} items={items} />
          </>
        ) : (
          <button type="button" onClick={() => onOpenChange(true)} aria-label={t('editor.tocExpand')} title={t('editor.tocExpand')} className={iconBtn}>
            <ListTree size={16} aria-hidden="true" />
          </button>
        )}
      </nav>

      {/* Lề hẹp: nút nhỏ ở góc, danh sách nổi. */}
      <div className="sticky top-20 @min-[1300px]:hidden">
        <Popover open={popover} onOpenChange={setPopover}>
          <PopoverTrigger asChild>
            <button type="button" aria-label={t('editor.toc')} title={t('editor.toc')} className={iconBtn}>
              <ListTree size={16} aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" side="bottom" className="custom-scrollbar max-h-[60vh] w-64 overflow-y-auto p-1.5">
            <OutlineList title={title} items={items} onPick={() => setPopover(false)} />
          </PopoverContent>
        </Popover>
      </div>
    </>
  )
}
