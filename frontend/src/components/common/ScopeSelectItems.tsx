import { useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { History, ChevronUp } from 'lucide-react'
import { SelectItem, SelectSeparator } from '@/components/ui/select'
import { splitByTime, type DatedScope } from './dateScope'

interface ScopeSelectItemsProps<T extends DatedScope> {
  items: T[] | undefined
  /** Mục đang chọn — nếu là mục đã qua thì vẫn luôn hiển thị, không thì ô chọn trông như trống. */
  selectedId?: string
  /** Danh từ dùng trong nhãn: "đợt" (mặc định) hay "kỳ". */
  noun?: string
  itemClassName?: string
  /** Nhãn hiển thị cho từng mục; mặc định là `name`. */
  renderLabel?: (x: T) => ReactNode
}

/**
 * Danh sách đợt/kỳ bên trong `SelectContent`: mặc định chỉ hiện mục đang diễn ra và mục
 * tương lai, kèm nút bung ra xem các mục đã qua.
 *
 * Đợt/kỳ cũ tồn đọng thêm mỗi năm trong khi số mục còn dùng thì không đổi; để chung một
 * danh sách thì mục đang chạy bị trôi mất giữa hàng chục mục đã chết.
 */
export default function ScopeSelectItems<T extends DatedScope>({
  items,
  selectedId,
  noun = 'đợt',
  itemClassName,
  renderLabel,
}: ScopeSelectItemsProps<T>) {
  const [showPast, setShowPast] = useState(false)
  const { upcoming, past } = useMemo(() => splitByTime(items), [items])

  // Mục đã qua đang được chọn vẫn phải nằm trong danh sách kể cả khi đang thu gọn.
  const pinnedPast = !showPast && selectedId ? past.find(x => x.id === selectedId) : undefined
  const visiblePast = showPast ? past : (pinnedPast ? [pinnedPast] : [])
  const hiddenPastCount = past.length - visiblePast.length

  const item = (x: T) => (
    <SelectItem key={x.id} value={x.id} className={itemClassName}>
      {renderLabel ? renderLabel(x) : x.name}
    </SelectItem>
  )

  const toggle = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowPast(v => !v)
  }

  const toggleClass =
    'mt-1 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'

  return (
    <>
      {upcoming.map(item)}

      {visiblePast.length > 0 && (
        <>
          {upcoming.length > 0 && <SelectSeparator />}
          {showPast && (
            <div className="px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              {noun} đã qua
            </div>
          )}
          {visiblePast.map(item)}
        </>
      )}

      {upcoming.length === 0 && visiblePast.length === 0 && hiddenPastCount === 0 && (
        <div className="px-2 py-3 text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
          Chưa có {noun} nào
        </div>
      )}

      {hiddenPastCount > 0 && (
        <button type="button" onClick={toggle} className={toggleClass}>
          <History size={13} /> Xem {hiddenPastCount} {noun} đã qua
        </button>
      )}
      {showPast && past.length > 0 && (
        <button type="button" onClick={toggle} className={toggleClass}>
          <ChevronUp size={13} /> Ẩn {noun} đã qua
        </button>
      )}
    </>
  )
}
