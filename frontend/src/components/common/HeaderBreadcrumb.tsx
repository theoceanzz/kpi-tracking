import { useLocation, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { navItems, type NavItem } from '@/config/navigation'
import { useNavLabels } from '@/features/organization/hooks/useNavLabels'

/** Mục nav sở hữu trang gộp đang mở (trang có `sections` và path khớp route hiện tại). */
function findSectionOwner(pathname: string, items: NavItem[] = navItems): NavItem | undefined {
  for (const item of items) {
    if (item.sections && item.path === pathname) return item
    const found = item.children ? findSectionOwner(pathname, item.children) : undefined
    if (found) return found
  }
  return undefined
}

/**
 * Đường dẫn phân cấp của các trang gộp, đặt trên thanh header.
 *
 * Suy thẳng từ cây điều hướng và `?section=` chứ không nhờ trang tự báo lên: cây nav
 * vốn đã là nguồn duy nhất của đúng những thông tin này, nên không cần thêm một tầng
 * state đồng bộ giữa trang và layout — thứ dễ nháy khi chuyển trang.
 *
 * Không có mục nào đang mở (đang ở màn hình lưới thẻ) thì không hiện gì.
 */
export default function HeaderBreadcrumb() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { labelOf } = useNavLabels()

  const owner = findSectionOwner(location.pathname)
  const active = owner?.sections?.find(s => s.id === searchParams.get('section'))

  if (!owner || !active) return null

  const goBack = () =>
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      p.delete('section')
      return p
    }, { replace: true })

  return (
    <div className="flex items-center gap-3 min-w-0">
      <button
        onClick={goBack}
        aria-label={`Quay lại ${labelOf(owner)}`}
        title={`Quay lại ${labelOf(owner)}`}
        className="w-8 h-8 shrink-0 rounded-lg border border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/40 transition-colors flex items-center justify-center"
      >
        <ArrowLeft size={15} />
      </button>

      <nav aria-label="Đường dẫn" className="flex items-center gap-1 min-w-0 text-[11px] font-black uppercase tracking-widest">
        <button
          onClick={goBack}
          className="shrink-0 text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] transition-colors"
        >
          {labelOf(owner)}
        </button>
        {active.group && (
          <>
            <ChevronRight size={12} className="shrink-0 text-[var(--color-muted-foreground)] opacity-50" />
            <span className="shrink-0 text-[var(--color-muted-foreground)] opacity-70">{active.group}</span>
          </>
        )}
        <ChevronRight size={12} className="shrink-0 text-[var(--color-muted-foreground)] opacity-50" />
        <span className="truncate text-[var(--color-foreground)]">{labelOf(active)}</span>
      </nav>
    </div>
  )
}
