import type { TourKey } from '@/store/tourStore'
import type { TourDef, TourStep } from './registry'
import { tourTarget } from './anchors'
import { runTourAction } from './actions'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Hướng dẫn cho "Tổng quan" — bài mẫu của bộ máy hướng dẫn từng bước nhỏ.
 *
 * Trang này không có mục con theo `?section=`; thay vào đó nó chọn bố cục theo quyền và theo
 * `?view=`. Bốn vai trò đó được đặt vào chỗ của `sectionId` — nhờ vậy mỗi vai có bài riêng và
 * được đánh dấu đã-xem riêng, mà không cần thêm khái niệm mới nào vào mô hình khoá. Chính
 * component dashboard báo lên nó đang vẽ bảng nào (`useTourScope('dashboard', 'director')`).
 *
 * Bốn bài dùng chung bộ bước, chỉ khác bước mở đầu. Trang chủ KHÔNG còn chế độ chỉnh sửa: kéo
 * thả bằng cụm chấm, thả tay là tự lưu — bài bản 1 còn dạy nút "Tuỳ chỉnh" / "Lưu" đã bỏ, nên
 * được viết lại thành bản 2 (người đã xem bản 1 chỉ thấy chấm "Có hướng dẫn mới").
 *
 * Bài không làm đổi dữ liệu thật: các bước mặc định chặn bấm vào vùng tô sáng; bước cho thao tác
 * (gõ tìm kiếm) chỉ đổi state cục bộ, và lưới widget đứng ngoài tự lưu suốt lúc bài chạy
 * (`useTourSandbox` trong `useDashboardLayout`).
 */

const TOUR_VERSION = 2

const t = (key: string) => i18n.t(`shared:dashboard.${key}`)
const p = (text: string) => <p>{text}</p>

/** Màn hình đủ rộng để phần tử `hidden md:*` hiện ra. Xét lúc bắt đầu bài để "Bước x / y" đúng ngay. */
const atLeast = (px: number) => () => window.matchMedia(`(min-width: ${px}px)`).matches

const openLibrary = () => runTourAction('widgets.library.open')
/** Mở thư viện và xoá từ khoá/bộ lọc người học vừa gõ thử ở bước tìm kiếm. */
const openCleanLibrary = () => runTourAction('widgets.library.open', { clean: true })
const closeLibrary = () => runTourAction('widgets.library.close')

const intro = (title: string, body: string): TourStep => ({
  id: 'intro',
  target: 'body',
  title,
  content: p(body),
  placement: 'center',
})

/** 14 bước chung: ô widget → menu → tự lưu → thư viện → nút xem lại hướng dẫn. */
const commonSteps = perLanguage((): TourStep[] => [
  {
    id: 'cell',
    target: tourTarget('widgets.cell'),
    title: t('cellTitle'),
    content: p(t('cellBody')),
    placement: 'auto',
    prepare: closeLibrary,
  },
  {
    id: 'drag',
    target: tourTarget('widgets.cell.drag'),
    title: t('dragTitle'),
    content: p(t('dragBody')),
    placement: 'left',
    // Cụm chấm là `hidden md:flex`: màn hẹp không kéo được, sắp bằng menu ⋮.
    requires: atLeast(768),
    prepare: closeLibrary,
  },
  {
    id: 'resize',
    target: `${tourTarget('widgets.cell')} > .react-resizable-handle-se`,
    title: t('resizeTitle'),
    content: p(t('resizeBody')),
    placement: 'left',
    spotlightPadding: 10,
    prepare: closeLibrary,
  },
  {
    id: 'menu',
    target: tourTarget('widgets.cell.menu'),
    title: t('menuTitle'),
    content: p(t('menuBody')),
    placement: 'left',
    prepare: closeLibrary,
  },
  {
    id: 'autosave',
    target: tourTarget('dashboard.toolbar'),
    title: t('autosaveTitle'),
    content: p(t('autosaveBody')),
    placement: 'bottom',
    prepare: closeLibrary,
  },
  {
    id: 'add',
    target: tourTarget('widgets.add'),
    title: t('addTitle'),
    content: p(t('addBody')),
    placement: 'bottom',
    advanceOnClick: true,
    prepare: closeLibrary,
  },
  {
    id: 'library-search',
    target: tourTarget('widgets.library.search'),
    title: t('searchTitle'),
    content: p(t('searchBody')),
    placement: 'bottom',
    interactive: true,
    prepare: openLibrary,
  },
  {
    id: 'library-filter',
    target: tourTarget('widgets.library.filter'),
    title: t('filterTitle'),
    content: p(t('filterBody')),
    placement: 'bottom',
    prepare: openCleanLibrary,
  },
  {
    id: 'library-presets',
    target: tourTarget('widgets.library.presets'),
    title: t('presetsTitle'),
    content: p(t('presetsBody')),
    placement: 'bottom',
    prepare: openCleanLibrary,
  },
  {
    id: 'library-groups',
    target: tourTarget('widgets.library.groups'),
    title: t('groupsTitle'),
    content: p(t('groupsBody')),
    placement: 'right',
    requires: atLeast(768),
    prepare: openCleanLibrary,
  },
  {
    id: 'library-card',
    target: tourTarget('widgets.library.card'),
    title: t('cardTitle'),
    content: p(t('cardBody')),
    placement: 'auto',
    prepare: openCleanLibrary,
  },
  {
    id: 'library-reset',
    target: tourTarget('widgets.library.reset'),
    title: t('resetTitle'),
    content: p(t('resetBody')),
    placement: 'top',
    prepare: openCleanLibrary,
  },
  {
    id: 'library-done',
    target: tourTarget('widgets.library.done'),
    title: t('doneTitle'),
    content: p(t('doneBody')),
    placement: 'top',
    prepare: openCleanLibrary,
  },
  {
    id: 'help',
    target: tourTarget('tour.help'),
    title: t('helpTitle'),
    content: p(t('helpBody')),
    placement: 'bottom',
    prepare: closeLibrary,
  },
])

const roleTour = (title: string, introTitle: string, introBody: string): TourDef => ({
  title,
  version: TOUR_VERSION,
  steps: [intro(introTitle, introBody), ...commonSteps()],
  cleanup: closeLibrary,
})

const dashboardTours = perLanguage((): Record<TourKey, TourDef> => ({
  'dashboard/director': roleTour(t('overviewDirector'), t('introDirectorTitle'), t('youSeeBothUnitLevelWidgets')),
  'dashboard/head': roleTour(t('overviewUnitHead'), t('introHeadTitle'), t('unitLevelWidgetsHereFollowThe')),
  'dashboard/deputy': roleTour(t('overviewDeputyHead'), t('introDeputyTitle'), t('aDeputyBothManagesAnArea')),
  'dashboard/staff': roleTour(t('overviewPersonal'), t('introStaffTitle'), t('theHomePageShowsTheKpis')),
}))

export default dashboardTours
