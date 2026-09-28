import type { Step } from 'react-joyride'
import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Hướng dẫn cho "Tổng quan".
 *
 * Trang này không có mục con theo `?section=`; thay vào đó nó chọn bố cục theo quyền và theo
 * `?view=`. Bốn vai trò đó được đặt vào chỗ của `sectionId` — nhờ vậy mỗi vai có bài riêng và
 * được đánh dấu đã-xem riêng, mà không cần thêm khái niệm mới nào vào mô hình khoá. Chính
 * component dashboard báo lên nó đang vẽ bảng nào (`useTourScope('dashboard', 'director')`).
 *
 * Cả bốn bài dùng chung bộ bước: trang chủ giờ chỉ là một lưới widget, khác nhau ở việc vai
 * nào thấy thêm widget cấp đơn vị. Phần khác biệt nằm ở bước mở đầu.
 */

const note = (text: string) => (
  <p className="text-xs bg-[var(--color-primary-soft)] p-2 rounded-control text-[var(--color-primary)] font-medium italic">
    💡 {text}
  </p>
)

/** Bước mở đầu riêng cho từng vai — nói rõ phạm vi dữ liệu vai đó nhìn thấy. */
const intro = (title: string, body: React.ReactNode): Step => ({
  target: 'body',
  title,
  content: <div className="space-y-2">{body}</div>,
  placement: 'center',
})

/** Ba bước chung: lưới widget → nút tuỳ chỉnh → thư viện widget. */
const commonSteps = perLanguage((): Step[] => ([
  {
    target: '#tour-dashboard-grid',
    title: i18n.t('shared:dashboard.theHomePageIsYourWidget'),
    content: (
      <div className="space-y-2">
        <p>
          {i18n.t('shared:dashboard.eachCardHereIs')} <strong>{i18n.t('shared:dashboard.exactlyTheChartAndExactlyThe')}</strong> {i18n.t('shared:dashboard.onTheAnalyticsStatisticsPageNot')}
        </p>
        <p className="text-caption">
          {i18n.t('shared:dashboard.theLayoutIsSavedPerPerson')}
        </p>
      </div>
    ),
    placement: 'top',
  },
  {
    target: '#tour-dashboard-customize',
    title: i18n.t('shared:dashboard.customizeRightOnTheTitleBar'),
    content: (
      <div className="space-y-2">
        <p>
          {i18n.t('shared:dashboard.click')} <strong>{i18n.t('shared:dashboard.customize')}</strong> {i18n.t('shared:dashboard.toEnterEditModeDragAnd')}
        </p>
        {note(i18n.t('shared:dashboard.rememberToClickSaveLeavingWith'))}
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-dashboard-customize',
    title: i18n.t('shared:dashboard.addAndRemoveContent'),
    content: (
      <div className="space-y-2">
        <p>
          {i18n.t('shared:dashboard.inEditMode')} <strong>{i18n.t('shared:dashboard.addChart')}</strong> {i18n.t('shared:dashboard.opensTheWidgetLibraryClickA')} <strong>{i18n.t('shared:dashboard.hideShow')}</strong> {i18n.t('shared:dashboard.keepsTheWidgetButTemporarilyPuts')}
        </p>
        <p className="text-caption">
          {i18n.t('shared:dashboard.notSureWhereToStartChoose')} <strong>{i18n.t('shared:dashboard.suggestedLayout')}</strong> {i18n.t('shared:dashboard.atTheTopOfTheLibrary')}
        </p>
      </div>
    ),
    placement: 'bottom',
  },
]))

const dashboardTours = perLanguage((): Record<TourKey, TourDef> => ({
  'dashboard/director': {
    title: i18n.t('shared:dashboard.overviewDirector'),
    steps: [
      intro(i18n.t('shared:dashboard.theBoardForDirectors'), (
        <>
          <p>
            {i18n.t('shared:dashboard.youSeeBothUnitLevelWidgets')}
          </p>
          {note(i18n.t('shared:dashboard.wantToGoDeeperIntoA'))}
        </>
      )),
      ...commonSteps(),
    ],
  },

  'dashboard/head': {
    title: i18n.t('shared:dashboard.overviewUnitHead'),
    steps: [
      intro(i18n.t('shared:dashboard.theBoardForUnitHeads'), (
        <>
          <p>
            {i18n.t('shared:dashboard.unitLevelWidgetsHereFollowThe')}
          </p>
          {note(i18n.t('shared:dashboard.submissionsAndKpisPendingApprovalAre'))}
        </>
      )),
      ...commonSteps(),
    ],
  },

  'dashboard/deputy': {
    title: i18n.t('shared:dashboard.overviewDeputyHead'),
    steps: [
      intro(i18n.t('shared:dashboard.theBoardForDeputyHeads'), (
        <>
          <p>
            {i18n.t('shared:dashboard.aDeputyBothManagesAnArea')}
          </p>
          {note(i18n.t('shared:dashboard.wantToSeeOnlyYourOwn'))}
        </>
      )),
      ...commonSteps(),
    ],
  },

  'dashboard/staff': {
    title: i18n.t('shared:dashboard.overviewPersonal'),
    steps: [
      intro(i18n.t('shared:dashboard.theBoardForYou'), (
        <>
          <p>
            {i18n.t('shared:dashboard.theHomePageShowsTheKpis')}
          </p>
          {note(i18n.t('shared:dashboard.submittingReportsAndViewingYourEvaluations'))}
        </>
      )),
      ...commonSteps(),
    ],
  },
}))

export default dashboardTours
