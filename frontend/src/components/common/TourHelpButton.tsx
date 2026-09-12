import { useEffect, useRef, useState } from 'react'
import { CircleHelp, Lightbulb, RotateCcw, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useTourStore, tourLevelOf, type TourKey } from '@/store/tourStore'
import { availableTourChain, tourTitleOf } from './tours'
import { Button } from '@/components/ui/button'

const LEVEL_LABEL: Record<string, string> = {
  page: 'Trang',
  section: 'Mục',
  tab: 'Tab',
}

/**
 * Nút xem lại hướng dẫn, đặt trên thanh header.
 *
 * Thay cho nút 💡 cũ gắn vào từng dòng sidebar. Nút cũ tra bài theo `path`, mà từ khi
 * hàng chục màn hình gộp thành mục trong trang thì mọi mục của một trang đều chung một
 * `path` — đứng ở "Quản lý nhân viên" bấm nút vẫn ra bài của cả trang "Thiết lập công
 * ty". Ở header thì nút biết chính xác đang đứng ở tầng nào, và khi có nhiều tầng thì
 * cho chọn xem lại tầng nào.
 */
export default function TourHelpButton() {
  const { user } = useAuthStore()
  const scope = useTourStore((s) => s.scope)
  const activeTour = useTourStore((s) => s.activeTour)
  const seenToursByUser = useTourStore((s) => s.seenToursByUser)
  const { startTour, resetAll } = useTourStore()

  // Menu mở "cho màn hình nào" chứ không phải một cờ bật/tắt trần. Đổi màn hình là
  // khoá không còn khớp nên menu tự đóng, khỏi cần effect đồng bộ lại.
  const scopeKey = `${scope.navId}|${scope.sectionId}|${scope.tabKey}`
  const [openFor, setOpenFor] = useState<string | null>(null)
  const open = openFor === scopeKey
  const setOpen = (next: boolean) => setOpenFor(next ? scopeKey : null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenFor(null)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const chain = availableTourChain(scope)
  if (!user?.id || chain.length === 0) return null

  const seen = seenToursByUser[user.id] ?? {}
  const hasUnseen = chain.some((key) => !seen[key])

  const play = (key: TourKey) => {
    setOpen(false)
    // Dừng rồi mới chạy: nếu đang có bài chạy dở, đặt thẳng khoá mới không làm
    // Joyride dựng lại từ bước một.
    useTourStore.getState().stopTour()
    setTimeout(() => startTour(key), 20)
  }

  const handleClick = () => {
    if (chain.length === 1) play(chain[0]!)
    else setOpen(!open)
  }

  return (
    <div className="relative" ref={menuRef}>
      <Button variant="ghost" size="icon-sm" className={cn(
          '',
          activeTour
            ? 'text-[var(--color-primary)] bg-[var(--color-primary-soft)]'
            : hasUnseen
              ? 'text-[var(--color-warning)] bg-[var(--color-warning-bg)] animate-pulse'
              : 'hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]'
        )} onClick={handleClick} title={hasUnseen ? 'Màn hình này có hướng dẫn bạn chưa xem' : 'Xem lại hướng dẫn'} aria-label="Hướng dẫn sử dụng">
        {hasUnseen ? <Lightbulb aria-hidden="true" /> : <CircleHelp aria-hidden="true" />}
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="text-eyebrow px-4 py-2.5 border-b border-[var(--color-border)]">
            Hướng dẫn màn hình này
          </div>

          {chain.map((key) => (
            <button type="button" className="flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[var(--color-muted-foreground)]" key={key} onClick={() => play(key)}>
              <span className="text-eyebrow shrink-0 w-10">
                {LEVEL_LABEL[tourLevelOf(key)]}
              </span>
              <span className="flex-1 min-w-0 truncate text-[13px] font-medium text-[var(--color-foreground)]">
                {tourTitleOf(key)}
              </span>
              {seen[key] && <Check aria-hidden="true" className="shrink-0 text-[var(--color-success)]" />}
            </button>
          ))}

          <button type="button" className="flex h-9 w-full items-center justify-center gap-2 rounded-control border border-[var(--color-border)] bg-[var(--color-card)] text-sm font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] [&_svg]:size-4" onClick={() => {
              setOpen(false)
              resetAll()
            }}>
            <RotateCcw aria-hidden="true" />
            Đặt lại toàn bộ hướng dẫn
          </button>
        </div>
      )}
    </div>
  )
}
