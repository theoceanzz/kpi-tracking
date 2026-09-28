import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Hướng dẫn cho "Phân tích" — dòng sidebar và sáu góc nhìn bên trong.
 *
 * Trang này trước đó có đúng một bước giới thiệu lưới thẻ, còn sáu góc nhìn thì không
 * cái nào có hướng dẫn — trong khi đây lại là phần khách hàng hay hỏi "số này lấy ở
 * đâu ra" nhất.
 *
 * Sáu góc nhìn dựng theo cùng một khuôn — tiêu đề + nút Thêm biểu đồ, rồi lưới widget (hàng
 * ô chỉ số là ô đầu lưới) — nên chúng dùng CHUNG một bộ neo: `#tour-analytics-metrics`,
 * `#tour-analytics-customize`, `#tour-analytics-widgets`. Không còn bộ lọc cấp trang: đơn vị và
 * khoảng thời gian nằm trong bảng cấu hình của từng ô.
 * Dùng chung được vì mỗi lúc chỉ có đúng một mục được vẽ ra, không bao giờ hai mục cùng
 * tồn tại để đụng id. Hai mục So sánh giữa các đơn vị và Thẻ điểm BSC có thêm neo riêng.
 */

const note = (text: string) => (
  <p className="text-xs bg-[var(--color-primary-soft)] p-2 rounded-control text-[var(--color-primary)] font-medium italic">
    💡 {text}
  </p>
)

const warn = (text: string) => (
  <p className="text-xs bg-[var(--color-warning-bg)] p-2 rounded-control text-[var(--color-warning)] font-medium italic border-l-4 border-[var(--color-warning-border)]">
    ⚠️ {text}
  </p>
)

const analyticsTours = perLanguage((): Record<TourKey, TourDef> => ({
  /* ══════════ Cấp trang ══════════ */
  'analytics': {
    steps: [
      {
        target: '#tour-settings-nav',
        title: i18n.t('shared:analytics.threeGroupsThreeViews'),
        content: (
          <div className="space-y-2">
            <p>
              <strong>{i18n.t('shared:analytics.personal')}</strong> {i18n.t('shared:analytics.isYourOwnResultsOnlyPeople')}{' '}
              <strong>{i18n.t('shared:analytics.unit')}</strong> {i18n.t('shared:analytics.isTheUnitYouManageAnd')}
            </p>
            <p>
              <strong>{i18n.t('shared:analytics.wholeCompany')}</strong> {i18n.t('shared:analytics.isTheBscScorecardIsThe')}
            </p>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-settings-nav',
        title: i18n.t('shared:analytics.seeOkrOrSeeKpi'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:analytics.theFirstTwoGroupsChangeWith')} <strong>{i18n.t('shared:analytics.okrOn')}</strong> {i18n.t('shared:analytics.showsObjectivesAndKeyResults')} <strong>{i18n.t('shared:analytics.okrOff')}</strong> {i18n.t('shared:analytics.showsKpis')}
            </p>
            <p className="text-caption">
              {i18n.t('shared:analytics.theyAreNotTwoParallelSets')}
            </p>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-settings-nav',
        title: i18n.t('shared:analytics.everyFigureIsPerCycle'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:analytics.eachViewHasAPeriodOr')}
            </p>
            {warn(i18n.t('shared:analytics.seeAnEmptyChartCheckThe'))}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  /* ══════════ Cụm Kết quả — bản OKR ══════════ */
  'analytics/my-objectives': {
    steps: [
      {
        target: '#tour-analytics-widgets',
        title: i18n.t('shared:analytics.eachCardPicksItsOwnTime'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:analytics.underEachCardsTitleAChip')} <strong>{i18n.t('shared:analytics.timeRange')}</strong>{i18n.t('shared:analytics.theCardFollowsClickItTo')}
            </p>
            {note(i18n.t('shared:analytics.aBoldChipMeansTheCard'))}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-analytics-metrics',
        title: i18n.t('shared:analytics.whereYourObjectivesStand'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:analytics.thisRowOfCardsSummarizesAll')}
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-analytics-widgets',
        title: i18n.t('shared:analytics.theTrendMattersMoreThanTodays'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:analytics.trendChartsShowWhetherYouAre')}
            </p>
            {note(i18n.t('shared:analytics.theUnitObjectiveAndKrTree'))}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-analytics-customize',
        title: i18n.t('shared:analytics.thisScreenCanBeRearranged'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:analytics.hoverOverACardAndGrab')}{' '}
              <strong>{i18n.t('shared:analytics.addChart')}</strong> {i18n.t('shared:analytics.toAddMoreFromTheLibrary')}
            </p>
            {note(i18n.t('shared:analytics.theLayoutIsRememberedForYour'))}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'analytics/subordinate': {
    steps: [
      {
        target: '#tour-analytics-metrics',
        title: i18n.t('shared:analytics.objectivesOfTheWholeUnit'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:analytics.fiveCardsOverallProgressOverallPerformance')}
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-analytics-metrics',
        title: i18n.t('shared:analytics.lookAtTheRiskCardFirst'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:analytics.theCard')} <strong>{i18n.t('shared:analytics.atRiskObjectives')}</strong> {i18n.t('shared:analytics.alreadyFiltersForLowProgressAnd')}
            </p>
            {warn(i18n.t('shared:analytics.objectivesThatFallIntoTheRisk'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-analytics-widgets',
        title: i18n.t('shared:analytics.downToEachPerson'),
        content: (
          <p>
            {i18n.t('shared:analytics.theBlock')} <strong>{i18n.t('shared:analytics.peopleByRole')}</strong> {i18n.t('shared:analytics.showsWhoCarriesWhichObjectiveSo')}{' '}
            <strong>{i18n.t('shared:analytics.childUnitsPerformanceProgressSubmissions')}</strong> {i18n.t('shared:analytics.comparesChildUnitsWithEachOther')}
          </p>
        ),
        placement: 'top',
      },
      {
        target: '#tour-analytics-widgets',
        title: i18n.t('shared:analytics.changeTheCycleRightOnEach'),
        content: (
          <p>
            {i18n.t('shared:analytics.eachCardIsComputedOverThe')}
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  /* ══════════ Cụm Kết quả — bản KPI ══════════ */
  'analytics/my': {
    steps: [
      {
        target: '#tour-analytics-metrics',
        title: i18n.t('shared:analytics.yourOwnResults'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:analytics.fiveSummaryCardsKpisYouHold')}
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-analytics-widgets',
        title: i18n.t('shared:analytics.threeBlocksAnswerThreeQuestions'),
        content: (
          <div className="space-y-2">
            <ul className="text-xs space-y-1.5 list-disc pl-4 text-[var(--color-muted-foreground)] font-medium">
              <li><strong className="text-[var(--color-foreground)]">{i18n.t('shared:analytics.myKpiList')}</strong> {i18n.t('shared:analytics.whereMyWorkIsStuck')}</li>
              <li><strong className="text-[var(--color-foreground)]">{i18n.t('shared:analytics.submissionApprovalStatus')}</strong> {i18n.t('shared:analytics.amILateOnAnySubmission')}</li>
              <li><strong className="text-[var(--color-foreground)]">{i18n.t('shared:analytics.evaluationScoresAcrossPeriods')}</strong> {i18n.t('shared:analytics.amIImprovingOrDeclining')}</li>
            </ul>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-analytics-widgets',
        title: i18n.t('shared:analytics.checkBeforeAsking'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:analytics.theCard')} <strong>{i18n.t('shared:analytics.evaluationScoresAcrossPeriods2')}</strong> {i18n.t('shared:analytics.recordsTheScoreAndCommentsOf')}
            </p>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-analytics-widgets',
        title: i18n.t('shared:analytics.eachCardHasItsOwnTime'),
        content: (
          <p>
            {i18n.t('shared:analytics.eachCardsPeriodCycleOrDate')}
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'analytics/summary': {
    steps: [
      {
        target: '#tour-analytics-metrics',
        title: i18n.t('shared:analytics.thePictureOfYourUnit'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:analytics.aKpiSummaryOfTheUnit')}
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-analytics-widgets',
        title: i18n.t('shared:analytics.twoKindsOfSlowDoNot'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:analytics.theCard')} <strong>{i18n.t('shared:analytics.childUnitsPerformanceProgressSubmissions')}</strong> {i18n.t('shared:analytics.showsAWholeDepartmentBehindPlan')}{' '}<strong>{i18n.t('shared:analytics.peopleRanking')}</strong> {i18n.t('shared:analytics.showsAFewIndividualsPullingThe')}
            </p>
            {note(i18n.t('shared:analytics.theFixesAreCompletelyDifferentThe'))}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-analytics-customize',
        title: i18n.t('shared:analytics.chooseTheChartsYouWantTo'),
        content: (
          <div className="space-y-2">
            <p>
              <strong>{i18n.t('shared:analytics.addChart')}</strong> {i18n.t('shared:analytics.addsMoreFromTheLibraryOn')}
            </p>
            {note(i18n.t('shared:analytics.theLayoutIsRememberedForYour2'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-analytics-widgets',
        title: i18n.t('shared:analytics.unitAndTimeRangeLiveOn'),
        content: (
          <p>
            {i18n.t('shared:analytics.theChipRowUnderEachCards')} <strong>{i18n.t('shared:analytics.unit2')}</strong>, <strong>{i18n.t('shared:analytics.timeRange')}</strong>{i18n.t('shared:analytics.theCardIsViewingClickIt')}
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  /* ══════════ Cụm Toàn công ty ══════════ */
  'analytics/drilldown': {
    steps: [
      {
        target: '#tour-drilldown-tree',
        title: i18n.t('shared:analytics.theUnitTreeOnTheLeft'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:analytics.startAtTheTopLevelAnd')}
            </p>
            {note(i18n.t('shared:analytics.onNarrowScreensTheTreeIs'))}
          </div>
        ),
        placement: 'right',
      },
      {
        target: '#tour-drilldown-banner',
        title: i18n.t('shared:analytics.whereYouAre'),
        content: (
          <p>
            {i18n.t('shared:analytics.theColoredStripShowsTheSelected')}
          </p>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-drilldown-members',
        title: i18n.t('shared:analytics.distributionMattersMoreThanTheAverage'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:analytics.theMemberTableAndRatingMatrix')}
            </p>
            {warn(i18n.t('shared:analytics.doNotRankUnitsByAn'))}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-drilldown-members',
        title: i18n.t('shared:analytics.takeFiguresOffTheScreen'),
        content: (
          <p>
            {i18n.t('shared:analytics.hoverOverACardOpenThe')} <strong>{i18n.t('shared:analytics.copyImage')}</strong>{i18n.t('shared:analytics.capturesExactlyTheCardYouAre')}
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'analytics/bsc': {
    steps: [
      {
        target: '#tour-analytics-metrics',
        title: i18n.t('shared:analytics.bscHealthOfThePeriod'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:analytics.fourScorecardFiguresForThePeriod')} <strong>{i18n.t('shared:analytics.bscAchievement')}</strong> {i18n.t('shared:analytics.againstThe100TargetTheNumber')}{' '}
              <strong>{i18n.t('shared:analytics.unitScorecards')}</strong> {i18n.t('shared:analytics.inEffectHowManyUnits')} <strong>{i18n.t('shared:analytics.passTheGateItems')}</strong>{i18n.t('shared:analytics.and')} <strong>{i18n.t('shared:analytics.cascadeCoverage')}</strong> {i18n.t('shared:analytics.whetherKpisAssignedToUnitsAre')}
            </p>
            {warn(i18n.t('shared:analytics.aCardSayingResultsNotComputed'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-bsc-balance',
        title: i18n.t('shared:analytics.scorecardAchievementOfEachUnit'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:analytics.oneAchievementDotPerUnitThe')} <strong>{i18n.t('shared:analytics.red')}</strong> {i18n.t('shared:analytics.dotIsAUnitFailingThe')}
            </p>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-analytics-widgets',
        title: i18n.t('shared:analytics.kpisTrendsAndCascading'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:analytics.theCard')} <strong>{i18n.t('shared:analytics.eachKpiAgainstTargetAndFloor')}</strong> {i18n.t('shared:analytics.putsActualsNextToTheTarget')}{' '}
              <strong>{i18n.t('shared:analytics.achievementTrend')}</strong> {i18n.t('shared:analytics.plotsAchievementAcrossPeriodsSplittableBy')}{' '}
              <strong>{i18n.t('shared:analytics.cascadeCoverage2')}</strong> {i18n.t('shared:analytics.showsWhichKpisAssignedToUnits')}
            </p>
            {note(i18n.t('shared:analytics.eachCardPicksItsOwnUnit'))}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-analytics-metrics',
        title: i18n.t('shared:analytics.whereToEditScorecards'),
        content: (
          <p>
            {i18n.t('shared:analytics.thisIsViewOnlyToAdd')}
          </p>
        ),
        placement: 'bottom',
      },
    ],
  },
}))

export default analyticsTours
