import type { Step } from 'react-joyride'
import { navItems, type NavItem } from '@/config/navigation'
import { splitTourKey, type TourKey } from '@/store/tourStore'
import i18n from 'i18next'

export interface TourDef {
  /**
   * Nhãn hiện trên menu "Xem lại hướng dẫn". Bỏ trống thì lấy nhãn của mục tương ứng
   * trong cây nav — chỉ tab cấp 3 mới cần khai, vì cây nav không mô tả tới tầng đó.
   */
  title?: string
  steps: Step[]
}

/**
 * Toàn bộ bài hướng dẫn của app, keyed theo `TourKey` ba tầng.
 *
 * Gom về một bản đồ phẳng thay vì để mỗi trang tự gắn `<PageTour/>`: có bản đồ thì
 * kiểm được độ phủ (xem `warnMissingTours` bên dưới), và nút "Xem lại hướng dẫn" trên
 * header liệt kê được các tầng mà không phải đi hỏi từng trang.
 */
type TourSource = () => Record<TourKey, TourDef>

const sources: TourSource[] = []
let cache: { lang: string | undefined; count: number; value: Record<TourKey, TourDef> } | null = null

/**
 * Bài hướng dẫn có chữ đã dịch, nên phải dựng lại mỗi khi đổi ngôn ngữ: registry giữ các HÀM dựng
 * (getter) và chỉ gộp lại khi ngôn ngữ đổi hoặc có cụm mới được đăng ký.
 */
export function tourRegistry(): Record<TourKey, TourDef> {
  const lang = i18n.language
  if (cache && cache.lang === lang && cache.count === sources.length) return cache.value
  const value: Record<TourKey, TourDef> = {}
  for (const source of sources) {
    for (const [key, def] of Object.entries(source())) {
      if (import.meta.env.DEV && value[key]) {
        console.warn(`[tours] Khoá "${key}" bị đăng ký hai lần — bài sau ghi đè bài trước.`)
      }
      value[key] = def
    }
  }
  cache = { lang, count: sources.length, value }
  return value
}

/** Nạp một cụm bài hướng dẫn vào registry. Mỗi file trong thư mục này gọi một lần, truyền getter. */
export function registerTours(source: TourSource) {
  sources.push(source)
}

export function getTour(key: TourKey | null | undefined): TourDef | undefined {
  return key ? tourRegistry()[key] : undefined
}

export function hasTour(key: TourKey | null | undefined): boolean {
  return !!getTour(key)
}

/* ─── Nhãn ─── */

function findPageItem(navId: string, items: NavItem[] = navItems()): NavItem | undefined {
  for (const item of items) {
    if (item.id === navId) return item
    const found = item.children ? findPageItem(navId, item.children) : undefined
    if (found) return found
  }
  return undefined
}

/**
 * Tên hiển thị của một bài hướng dẫn.
 *
 * Tra `sectionId` TRONG chính dòng sidebar chứa nó chứ không tra toàn cây: `id` của mục
 * trong trang chỉ duy nhất trong phạm vi trang, và đã có hai mục trùng `id` ở hai trang
 * khác nhau (`bsc`). Tra toàn cây sẽ lấy nhầm nhãn của mục kia.
 */
export function tourTitleOf(key: TourKey): string {
  const explicit = tourRegistry()[key]?.title
  if (explicit) return explicit

  const { navId, sectionId } = splitTourKey(key)
  const page = findPageItem(navId)
  if (!page) return key
  if (!sectionId) return page.label
  return page.sections?.find((s) => s.id === sectionId)?.label ?? sectionId
}

/* ─── Kiểm độ phủ ở chế độ dev ─── */

/**
 * Cảnh báo mọi dòng sidebar và mọi mục trong trang chưa có bài hướng dẫn.
 *
 * Có cái này vì cấu trúc điều hướng và nội dung hướng dẫn đã lệch nhau một lần rồi:
 * app chuyển sang ba tầng còn tour thì vẫn viết cho cấu trúc phẳng cũ, và 25 mục im
 * lặng không có hướng dẫn nào suốt nhiều tháng. Thêm mục mới mà quên viết hướng dẫn
 * thì giờ biết ngay ở lần chạy dev kế tiếp.
 *
 * Không xét cờ tính năng: một mục bị tắt ở tổ chức này vẫn bật ở tổ chức khác.
 */
export function warnMissingTours() {
  if (!import.meta.env.DEV) return

  const missing: string[] = []

  const walk = (items: NavItem[]) => {
    for (const item of items) {
      if (item.children?.length) {
        walk(item.children)
        continue
      }
      if (!item.path) continue

      // Dashboard chia bài theo vai trò nên không có bài nào mang đúng khoá `dashboard`.
      const hasAnyVariant =
        hasTour(item.id) || Object.keys(tourRegistry()).some((k) => k.startsWith(`${item.id}/`))
      if (!hasAnyVariant) missing.push(item.id)

      for (const section of item.sections ?? []) {
        const key = `${item.id}/${section.id}`
        if (!hasTour(key)) missing.push(key)
      }
    }
  }
  walk(navItems())

  if (missing.length) {
    console.warn(
      i18n.t('shared:registry.toursNavigationItemsHaveNoGuide', { count: missing.length }) + missing.join('\n  ')
    )
  }
}
