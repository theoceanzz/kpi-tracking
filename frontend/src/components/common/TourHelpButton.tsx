import { useEffect, useRef, useState } from 'react'
import { CircleHelp, Lightbulb, RotateCcw, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useTourStore, tourLevelOf, type TourKey } from '@/store/tourStore'
import { availableTourChain, tourTitleOf } from './tours'

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
      <button
        onClick={handleClick}
        title={hasUnseen ? 'Màn hình này có hướng dẫn bạn chưa xem' : 'Xem lại hướng dẫn'}
        aria-label="Hướng dẫn sử dụng"
        className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
          activeTour
            ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'
            : hasUnseen
              ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 animate-pulse'
              : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]'
        )}
      >
        {hasUnseen ? <Lightbulb size={18} /> : <CircleHelp size={18} />}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--color-muted-foreground)] border-b border-[var(--color-border)]">
            Hướng dẫn màn hình này
          </div>

          {chain.map((key) => (
            <button
              key={key}
              onClick={() => play(key)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--color-accent)] transition-colors"
            >
              <span className="shrink-0 w-10 text-[9px] font-black uppercase tracking-wider text-[var(--color-muted-foreground)]">
                {LEVEL_LABEL[tourLevelOf(key)]}
              </span>
              <span className="flex-1 min-w-0 truncate text-[13px] font-bold text-[var(--color-foreground)]">
                {tourTitleOf(key)}
              </span>
              {seen[key] && <Check size={13} className="shrink-0 text-emerald-500" />}
            </button>
          ))}

          <button
            onClick={() => {
              setOpen(false)
              resetAll()
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-left border-t border-[var(--color-border)] text-[12px] font-bold text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)] transition-colors"
          >
            <RotateCcw size={13} />
            Đặt lại toàn bộ hướng dẫn
          </button>
        </div>
      )}
    </div>
  )
}
