import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  totalElements: number
  size: number
  itemLabel?: string
}

/**
 * Phân trang chuẩn: dòng "x–y trong N" bên trái, nút số trang bên phải. Trang hiện tại
 * là nút nền đặc màu chủ đạo; các nút khác là ghost. Kích thước 32px — đây là điều
 * khiển phụ, không cần to như nút hành động.
 */
export default function Pagination({ currentPage, totalPages, onPageChange, totalElements, size, itemLabel = 'nhân sự' }: PaginationProps) {
  const start = totalElements === 0 ? 0 : currentPage * size + 1
  const end = Math.min((currentPage + 1) * size, totalElements)

  const pages: number[] = []
  const delta = 2
  for (let i = 0; i < totalPages; i++) {
    if (i === 0 || i === totalPages - 1 || (i >= currentPage - delta && i <= currentPage + delta)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== -1) {
      pages.push(-1)
    }
  }

  const btn = 'inline-flex h-8 min-w-8 items-center justify-center rounded-control px-2 text-[13px] font-medium tabular-nums transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 ' +
    'disabled:pointer-events-none disabled:opacity-40'
  const inactive = 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]'
  const active = 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'

  const isFirst = currentPage === 0
  const isLast = currentPage >= totalPages - 1

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--color-border)] px-4 py-3 sm:flex-row">
      <p className="text-caption tabular-nums">
        Hiển thị <span className="font-medium text-[var(--color-foreground)]">{start}–{end}</span> trong{' '}
        <span className="font-medium text-[var(--color-foreground)]">{totalElements}</span> {itemLabel}
      </p>

      {totalPages > 1 && (
        <nav aria-label="Phân trang" className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" onClick={() => onPageChange(0)} disabled={isFirst} aria-label="Trang đầu">
            <ChevronsLeft aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onPageChange(currentPage - 1)} disabled={isFirst} aria-label="Trang trước">
            <ChevronLeft aria-hidden="true" />
          </Button>

          <div className="mx-1 flex items-center gap-0.5">
            {pages.map((p, idx) => p === -1 ? (
              <span key={`gap-${idx}`} aria-hidden="true" className="w-6 text-center text-[var(--color-subtle-foreground)]">…</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={currentPage === p ? 'page' : undefined}
                aria-label={`Trang ${p + 1}`}
                className={cn(btn, currentPage === p ? active : inactive)}
              >
                {p + 1}
              </button>
            ))}
          </div>

          <Button variant="ghost" size="icon-sm" onClick={() => onPageChange(currentPage + 1)} disabled={isLast} aria-label="Trang sau">
            <ChevronRight aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onPageChange(totalPages - 1)} disabled={isLast} aria-label="Trang cuối">
            <ChevronsRight aria-hidden="true" />
          </Button>
        </nav>
      )}
    </div>
  )
}
