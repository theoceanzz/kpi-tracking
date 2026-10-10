import type { Step } from 'react-joyride'
import { navItems, type NavItem } from '@/config/navigation'
import { splitTourKey, type TourKey } from '@/store/tourStore'
import i18n from 'i18next'

/**
 * Điều kiện để một bước có mặt: mã quyền (có MỘT trong các mã là đủ) hoặc một hàm tuỳ ý (vd. màn
 * hình đủ rộng). Xét MỘT LẦN lúc bắt đầu bài, để "Bước x / y" đúng theo vai trò ngay từ bước 1.
 */
export type TourRequirement = string | string[] | (() => boolean)

/**
 * Một bước hướng dẫn. Là `Step` của Joyride cộng vài trường của riêng app; các trường thêm này
 * bị gỡ ra trước khi đưa cho Joyride (xem `toJoyrideStep`).
 *
 * `prepare` chứ không phải `before`: `before` là hook của Joyride, có chữ ký riêng và chạy theo
 * nhịp của Joyride. Ở đây `TourHost` tự chạy `prepare` rồi CHỜ neo xuất hiện trước khi chuyển
 * bước, nhờ vậy bước neo vào phần tử chỉ có sau khi mở panel không bị coi là thiếu.
 */
export type TourStep = Step & {
  /** Khoá ổn định của bước, dùng để lưu "đang học dở tới đâu". Thiếu thì dùng vị trí trong bài. */
  id?: string
  requires?: TourRequirement
  /**
   * Đưa màn hình về đúng trạng thái bước cần (mở thư viện, đóng thư viện, chuyển tab…), thường là
   * `() => runTourAction('…')`. Phải LUỸ ĐẲNG: chạy lại khi Quay lại hoặc học tiếp từ giữa bài.
   */
  prepare?: () => void | Promise<void>
  /**
   * Cho bấm/gõ vào phần tử đang tô sáng. Mặc định KHÔNG: bước chỉ để nhìn, bấm nhầm vào thẻ
   * widget hay nút "Áp dụng" trong lúc học không được làm đổi gì.
   */
  interactive?: boolean
  /** Người dùng tự bấm đúng phần tử đang tô sáng thì sang bước kế (ngầm bật `interactive`). */
  advanceOnClick?: boolean
  /** Chờ neo xuất hiện tối đa bao lâu sau `prepare` (ms). Mặc định 2500. */
  waitTimeout?: number
}

/** Trần số bước của một bài. Dài hơn thì tách bài: người học bỏ ngang từ khoảng bước 15. */
export const MAX_TOUR_STEPS = 15

export interface TourDef {
  /**
   * Nhãn hiện trên menu "Xem lại hướng dẫn". Bỏ trống thì lấy nhãn của mục tương ứng
   * trong cây nav — chỉ tab cấp 3 mới cần khai, vì cây nav không mô tả tới tầng đó.
   */
  title?: string
  /**
   * Phiên bản bài, mặc định 1. Tăng khi VIẾT LẠI bài: người đã xem bản cũ không bị tự chạy bản
   * mới, chỉ thấy chấm "Có hướng dẫn mới" trên nút Hướng dẫn; người chưa xem bản nào vẫn tự chạy.
   */
  version?: number
  steps: TourStep[]
  /**
   * Chạy khi bài kết thúc vì BẤT KỲ lý do gì — xong, Bỏ qua, Esc, đóng, chuyển trang. Trả màn
   * hình về như trước bài (đóng panel mà bài đã mở…). Dữ liệu thì không cần lo ở đây: lưới widget
   * và nháp form tự đứng ngoài khi có bài chạy (`useTourSandbox`, `useFormDraft`).
   */
  cleanup?: () => void | Promise<void>
  /**
   * Bài kế tiếp của cùng một luồng. Luồng dài hơn `MAX_TOUR_STEPS` thì TÁCH thành nhiều bài nối
   * nhau — không gộp hay bỏ bước cho vừa. Bước cuối của bài này hiện nút "Tiếp: <tên bài sau>",
   * bấm là chạy luôn bài kế. Khoá bài nối dùng hậu tố `+`: `performance/kpi-criteria+create-1`
   * (không bao giờ tự chạy theo màn hình; chỉ chạy qua nút "Tiếp" hoặc menu Hướng dẫn).
   */
  next?: TourKey
}

export const tourVersionOf = (def: TourDef | undefined) => def?.version ?? 1

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

  const long = Object.entries(tourRegistry())
    .filter(([, def]) => def.steps.length > MAX_TOUR_STEPS)
    .map(([key, def]) => `${key} (${def.steps.length})`)
  if (long.length) {
    console.warn(`[tours] Bài dài quá ${MAX_TOUR_STEPS} bước — nên tách bài:\n  ${long.join('\n  ')}`)
  }
}
