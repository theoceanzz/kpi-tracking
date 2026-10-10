import { useEffect, useRef, useState } from 'react'
import { CircleHelp, Lightbulb, RotateCcw, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useTourStore, tourLevelOf, tourSeenStatus, type TourKey } from '@/store/tourStore'
import { availableTourChain, getTour, tourTitleOf, tourVersionOf, withContinuations } from './tours'
import { tourAnchor } from './tours/anchors'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

const LEVEL_LABEL = perLanguage((): Record<string, string> => ({
  page: i18n.t('shared:TourHelpButton.page'),
  section: i18n.t('shared:TourHelpButton.section'),
  tab: 'Tab',
  series: i18n.t('shared:TourHelpButton.series'),
}))

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
  const { t } = useTranslation('shared')
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
  // Menu liệt kê cả bài nối tiếp (vd. "Tạo KPI 2/3") để mở thẳng; chấm/nhấp nháy chỉ xét chuỗi màn hình.
  const menu = withContinuations(chain)
  if (!user?.id || chain.length === 0) return null

  const seen = seenToursByUser[user.id] ?? {}
  const statusOf = (key: TourKey) => tourSeenStatus(seen[key], tourVersionOf(getTour(key)))
  const hasUnseen = chain.some((key) => statusOf(key) === 'unseen')
  // Bài đã xem bản cũ rồi được viết lại: không tự chạy, chỉ báo bằng chấm để người dùng tự mở.
  const hasUpdate = !hasUnseen && chain.some((key) => statusOf(key) === 'outdated')

  const play = (key: TourKey) => {
    setOpen(false)
    // Dừng rồi mới chạy: nếu đang có bài chạy dở, đặt thẳng khoá mới không làm
    // Joyride dựng lại từ bước một.
    useTourStore.getState().stopTour()
    setTimeout(() => startTour(key), 20)
  }

  const handleClick = () => {
    if (menu.length === 1) play(menu[0]!)
    else setOpen(!open)
  }

  return (
    <div className="relative" ref={menuRef}>
      {hasUpdate && !activeTour && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-1 top-1 z-10 size-2 rounded-full bg-[var(--color-destructive)] ring-2 ring-[var(--color-card)]"
        />
      )}
      <Button {...tourAnchor('tour.help')} variant="ghost" size="icon-sm" className={cn(
          '',
          activeTour
            ? 'text-[var(--color-primary)] bg-[var(--color-primary-soft)]'
            : hasUnseen
              ? 'text-[var(--color-warning)] bg-[var(--color-warning-bg)] animate-pulse'
              : 'hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]'
        )} onClick={handleClick} title={hasUnseen ? t('TourHelpButton.thisScreenHasAGuideYou') : hasUpdate ? t('TourHelpButton.newGuideAvailable') : t('TourHelpButton.reviewGuide')} aria-label={hasUpdate ? `${t('TourHelpButton.userGuide')} — ${t('TourHelpButton.newGuideAvailable')}` : t('TourHelpButton.userGuide')}>
        {hasUnseen ? <Lightbulb aria-hidden="true" /> : <CircleHelp aria-hidden="true" />}
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-card border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="text-eyebrow px-4 py-2.5 border-b border-[var(--color-border)]">
            {t('TourHelpButton.guideForThisScreen')}
          </div>

          {menu.map((key) => (
            <button type="button" className="flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[var(--color-muted-foreground)]" key={key} onClick={() => play(key)}>
              {/* Đủ rộng cho nhãn dài nhất ("Bài tiếp" / "Next guide") trên một dòng, tên bài thẳng cột. */}
              <span className="text-eyebrow shrink-0 w-20 whitespace-nowrap">
                {LEVEL_LABEL()[tourLevelOf(key)]}
              </span>
              <span className="flex-1 min-w-0 truncate text-[13px] font-medium text-[var(--color-foreground)]">
                {tourTitleOf(key)}
              </span>
              {/* Bài nối chưa mở lần nào (vd. bài đi qua từng ô của một form) cũng là "mới". */}
              {(statusOf(key) === 'outdated' || (tourLevelOf(key) === 'series' && statusOf(key) === 'unseen')) && (
                <span className="shrink-0 rounded-full bg-[var(--color-primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]">
                  {t('TourHelpButton.new')}
                </span>
              )}
              {statusOf(key) === 'current' && <Check aria-hidden="true" className="shrink-0 text-[var(--color-success)]" />}
            </button>
          ))}

          <button type="button" className="flex h-9 w-full items-center justify-center gap-2 rounded-control border border-[var(--color-border)] bg-[var(--color-card)] text-sm font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] [&_svg]:size-4" onClick={() => {
              setOpen(false)
              resetAll()
            }}>
            <RotateCcw aria-hidden="true" />
            {t('TourHelpButton.resetAllGuides')}
          </button>
        </div>
      )}
    </div>
  )
}
