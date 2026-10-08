import type { TourKey } from '@/store/tourStore'
import type { TourDef, TourStep } from './registry'
import { tourKit, tourTarget } from './kit'
import { runTourAction } from './actions'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Hướng dẫn cho "Thống kê" — trang gộp và từng góc nhìn.
 *
 * Mọi góc nhìn dùng chung lưới widget của trang Tổng quan, nên chung một bộ bước (ô biểu đồ, kéo,
 * menu, bảng cấu hình); chỉ bước mở đầu và nút K.AI riêng của góc nhìn là khác. Bước bảng cấu
 * hình MỞ bảng của ô đầu tiên cho người học thấy chỗ chọn đơn vị và khoảng thời gian — chỉ là
 * trạng thái giao diện, `cleanup` đóng lại.
 *
 * Bản 2 viết lại theo khuôn từng bước nhỏ (xem `kit.tsx`).
 */

const V = 2
const { s, sectionCards } = tourKit('tourAnalytics')

const atLeast = (px: number) => () => window.matchMedia(`(min-width: ${px}px)`).matches
const closeConfig = () => runTourAction('widgets.config.close')
const openConfig = () => runTourAction('widgets.config.open')

/** Bộ bước chung của một góc nhìn; `id` là khoá câu mở đầu và câu nút K.AI riêng của góc nhìn. */
const viewTour = (id: string, extra: TourStep[] = []): TourDef => ({
  version: V,
  cleanup: closeConfig,
  steps: [
    s(`${id}.intro`, 'body', 'center', { prepare: closeConfig }),
    s(`${id}.ai`, tourTarget('analytics.ai'), 'bottom', { prepare: closeConfig }),
    ...extra,
    s('grid.add', tourTarget('widgets.add'), 'bottom', { prepare: closeConfig }),
    s('grid.cell', tourTarget('widgets.cell'), 'auto', { prepare: closeConfig }),
    s('grid.drag', tourTarget('widgets.cell.drag'), 'left', { requires: atLeast(768), prepare: closeConfig }),
    s('grid.menu', tourTarget('widgets.cell.menu'), 'left', { prepare: closeConfig }),
    s('grid.config', tourTarget('widgets.config'), 'left', { prepare: openConfig }),
  ],
})

const analyticsTours = perLanguage((): Record<TourKey, TourDef> => ({
  analytics: { version: V, steps: sectionCards('analytics') },
  'analytics/my-objectives': viewTour('myObjectives'),
  'analytics/my': viewTour('my'),
  'analytics/subordinate': viewTour('subordinate'),
  'analytics/summary': viewTour('summary'),
  'analytics/drilldown': viewTour('drilldown', [
    s('drilldown.sidebar', tourTarget('widgets.sidebar'), 'right', { prepare: closeConfig }),
  ]),
  'analytics/bsc': viewTour('bsc'),
}))

export default analyticsTours
