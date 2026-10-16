import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Cuối danh sách việc tải dần: hiện "Đã hiện N / M việc", lọt vào màn hình (kể cả trong khung cuộn riêng) thì tự tải trang
 * kế; vẫn có nút bấm cho bàn phím / trình duyệt không hỗ trợ IntersectionObserver.
 */
export default function LoadMoreRow({ shown, total, loading, onLoadMore }: {
  shown: number; total: number; loading: boolean; onLoadMore: () => void
}) {
  const { t } = useTranslation('tasks')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) onLoadMore() }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [onLoadMore])
  return (
    <div ref={ref} className="flex items-center justify-center gap-2 px-3 py-2 text-xs text-[var(--color-subtle-foreground)]">
      <span>{t('list.shownOf', { shown, total })}</span>
      <Button size="sm" variant="ghost" disabled={loading} onClick={onLoadMore}>
        {loading && <Loader2 className="animate-spin" />} {t('list.loadMore')}
      </Button>
    </div>
  )
}
