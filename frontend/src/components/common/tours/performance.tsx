import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'
import {
  kpiCriteriaSteps,
  kpiPendingSteps,
  kpiAdjustmentsSteps,
  orgUnitSubmissionsSteps,
} from './inherited'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Hướng dẫn cho "Quản lý hiệu suất" — dòng sidebar và năm mục bên trong.
 *
 * Bốn mục đầu đã có nội dung từ hồi chúng còn là bốn dòng sidebar riêng. Viết mới ở đây
 * là cấp trang và mục "Đánh giá kỳ" — mục duy nhất của trang chưa từng có hướng dẫn, mà
 * lại là mục khó nhất vì nó động tới chuỗi duyệt theo cấp và cơ chế khoá.
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

const performanceTours = perLanguage((): Record<TourKey, TourDef> => ({
  /* ══════════ Cấp trang ══════════ */
  'performance': {
    steps: [
      {
        target: '#tour-settings-nav',
        title: i18n.t('shared:performance.theLifeCycleOfAKpi'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:performance.theGroup')} <strong>{i18n.t('shared:performance.kpis')}</strong> {i18n.t('shared:performance.isTheSettingAndApprovalPart')}
            </p>
            <p>
              {i18n.t('shared:performance.theGroup')} <strong>{i18n.t('shared:performance.evaluation')}</strong> {i18n.t('shared:performance.isTheScoringPartByPeriod')}
            </p>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-card-kpi-criteria',
        title: i18n.t('shared:performance.n1StartOfCycleSetAnd'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:performance.assignKpisToPeopleAndUnits')}
            </p>
            {warn(i18n.t('shared:performance.kpisNotYetApprovedDoNot'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-card-submissions-org-unit',
        title: i18n.t('shared:performance.n2EndOfPeriodScoring'),
        content: (
          <div className="space-y-2">
            <p>
              <strong>{i18n.t('shared:performance.periodEvaluation')}</strong> {i18n.t('shared:performance.isScoringEachSubmissionOfA')} <strong>{i18n.t('shared:performance.cycleEvaluation')}</strong>{' '}
              {i18n.t('shared:performance.combinesSeveralPeriodsIntoASummary')}
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-settings-nav',
        title: i18n.t('shared:performance.aRedNumberIsWorkWaiting'),
        content: (
          <p>
            {i18n.t('shared:performance.theRedNumberOnCardsAnd')}
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  /* ══════════ Cụm Chỉ tiêu ══════════ */
  'performance/kpi-criteria': { steps: kpiCriteriaSteps() },
  'performance/kpi-criteria-pending': { steps: kpiPendingSteps() },
  'performance/kpi-adjustments-pending': { steps: kpiAdjustmentsSteps() },

  /* ══════════ Cụm Đánh giá ══════════ */
  'performance/submissions-org-unit': { steps: orgUnitSubmissionsSteps() },

  'performance/cycle-evaluation': {
    steps: [
      {
        target: '#tour-cycleeval-toolbar',
        title: i18n.t('shared:performance.chooseTheCycleAndUnitFirst'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:performance.withoutChoosingA')} <strong>{i18n.t('shared:performance.cycle')}</strong> {i18n.t('shared:performance.and')} <strong>{i18n.t('shared:performance.unit')}</strong> {i18n.t('shared:performance.theWholeScreenIsEmptyThese')}
            </p>
            {note(i18n.t('shared:performance.periodEvaluationScoresEachSubmissionThis'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-cycleeval-header',
        title: i18n.t('shared:performance.metricRowAndUnitRating'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:performance.theMetricCardsAreTheAverage')} <strong>{i18n.t('shared:performance.unitRating')}</strong>
              {i18n.t('shared:performance.nextToItIsTheFinal')}
            </p>
            {note(i18n.t('shared:performance.avgRatingAndAvgQualitativeAre'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-cycleeval-table',
        title: i18n.t('shared:performance.threeScoreColumnsThreeScorers'),
        content: (
          <div className="space-y-2">
            <ul className="text-xs space-y-1.5 list-disc pl-4 text-[var(--color-muted-foreground)] font-medium">
              <li><strong className="text-[var(--color-foreground)]">{i18n.t('shared:performance.employeeSelfAssessment')}</strong> {i18n.t('shared:performance.theScoreTheyGaveThemselves')}</li>
              <li><strong className="text-[var(--color-foreground)]">{i18n.t('shared:performance.directManagerAssessment')}</strong> {i18n.t('shared:performance.theScoreYouGive')}</li>
              <li><strong className="text-[var(--color-foreground)]">{i18n.t('shared:performance.finalizedScore')}</strong> {i18n.t('shared:performance.theResultRecordedForTheCycle')}</li>
            </ul>
            {note(i18n.t('shared:performance.lettingTheFirstTwoColumnsDiffer'))}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-cycleeval-chain',
        title: i18n.t('shared:performance.lockingByLevel'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:performance.thisStripIsTheApprovalChain')} <strong>{i18n.t('shared:performance.locked')}</strong>{i18n.t('shared:performance.andOnlyThenDoesTheNext')}
            </p>
            {warn(i18n.t('shared:performance.aLockedRowShowsWhichUnit'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-cycleeval-actions',
        title: i18n.t('shared:performance.exportSendAndFinalize'),
        content: (
          <div className="space-y-2">
            <p>
              <strong>{i18n.t('shared:performance.exportExcel')}</strong> {i18n.t('shared:performance.exportsTheWholeTableToA')} <strong>{i18n.t('shared:performance.sendEvaluations')}</strong> {i18n.t('shared:performance.emailsTheResultsToEachEmployee')} <strong>{i18n.t('shared:performance.finalizeDepartmentEvaluation')}</strong> {i18n.t('shared:performance.locksTheCycleAndCapturesThe')}
            </p>
            {warn(i18n.t('shared:performance.unlockingToEditOverwritesWhatThe'))}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },
}))

export default performanceTours
