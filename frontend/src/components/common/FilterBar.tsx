import { useState, type ReactNode } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChoiceChip } from '@/components/ui/choice-chip'

interface FilterBarProps {
  /** Các bộ lọc chính, theo thứ tự cố định của nhóm pattern (đợt → đơn vị → trạng thái…). */
  children?: ReactNode
  /** Ô tìm kiếm — luôn ở mép phải. */
  search?: { value: string; onChange: (v: string) => void; placeholder?: string; /** Bề ngang ô tìm (mặc định `sm:w-64`), tăng khi placeholder dài. */ className?: string }
  /** Bộ lọc phụ, gom vào popover "Bộ lọc" thay vì xuống hàng hai. */
  overflow?: ReactNode
  /** Số bộ lọc phụ đang có giá trị — hiện trên nút "Bộ lọc". */
  overflowActiveCount?: number
  /** Nút thuộc về cách hiển thị (đổi dạng xem, mở/đóng nhóm) — đứng sau tìm kiếm. */
  trailing?: ReactNode
  /** Neo cho tour. */
  id?: string
  className?: string
}

/**
 * Hàng bộ lọc chuẩn (UX_PATTERNS.md §R3): MỘT hàng cao 36px, gap 8px; bộ lọc chính bên trái,
 * tìm kiếm bên phải, bộ lọc phụ trong popover. Dưới `lg` các ô xuống dòng nhưng vẫn giữ thứ tự.
 * Mỗi ô con tự đặt bề rộng (`w-48`, `w-56`…) để cột filter thẳng hàng giữa các trang.
 */
export default function FilterBar({ children, search, overflow, overflowActiveCount = 0, trailing, id, className }: FilterBarProps) {
  const [open, setOpen] = useState(false)
  return (
    <div id={id} className={cn('flex flex-wrap items-center gap-2', className)}>
      {children}
      {overflow && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" aria-expanded={open}>
              <SlidersHorizontal aria-hidden="true" />
              Bộ lọc
              {overflowActiveCount > 0 && (
                <span className="rounded-full bg-[var(--color-primary)] px-1.5 text-xs font-medium leading-4 text-[var(--color-primary-foreground)] tabular-nums">
                  {overflowActiveCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 space-y-3">
            {overflow}
          </PopoverContent>
        </Popover>
      )}
      {search && (
        // Ô nhập chuẩn (focus một lớp); nút xoá chỉ hiện khi có chữ — không thì placeholder bị cắt oan.
        <Input
          type="search"
          value={search.value}
          onChange={e => search.onChange(e.target.value)}
          placeholder={search.placeholder ?? 'Tìm kiếm…'}
          aria-label={search.placeholder ?? 'Tìm kiếm'}
          prefix={<Search aria-hidden="true" />}
          suffix={search.value ? (
            <button
              type="button"
              onClick={() => search.onChange('')}
              aria-label="Xoá tìm kiếm"
              className="flex h-5 w-5 items-center justify-center rounded-sm hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] [&_svg]:size-3.5"
            >
              <X />
            </button>
          ) : undefined}
          className={cn('ml-auto w-full', search.className ?? 'sm:w-64')}
          // Nút xoá riêng ở trên — ẩn nút ✕ mặc định của trình duyệt cho ô type="search" để khỏi hai nút.
          inputClassName="[&::-webkit-search-cancel-button]:appearance-none"
        />
      )}
      {trailing && <div className={cn('flex items-center gap-1', !search && 'ml-auto')}>{trailing}</div>}
    </div>
  )
}

/** Nút bật/tắt dạng xem, dùng trong `trailing`. */
export function SegmentedControl<T extends string>({ value, onChange, options, ariaLabel }: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; title?: string }[]
  ariaLabel: string
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="custom-scrollbar flex h-9 max-w-full items-center gap-0.5 overflow-x-auto rounded-control bg-[var(--color-muted)] p-0.5">
      {options.map(o => {
        const active = o.value === value
        return (
          <ChoiceChip selected={active} variant="segment" className="min-w-8" key={o.value} title={o.title} onClick={() => onChange(o.value)}>
            {o.label}
          </ChoiceChip>
        )
      })}
    </div>
  )
}
