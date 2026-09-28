import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Hướng dẫn cho "Thiết lập công cụ" — dòng sidebar, mười mục bên trong, và các tab của
 * từng mục.
 *
 * Trang này được viết lại đầu tiên vì trước đó nó thiếu nhiều nhất: cả trang chỉ có
 * đúng một bước giới thiệu lưới thẻ, còn mười mục bên trong thì không mục nào có hướng
 * dẫn, kể cả những mục khó nhất (thang điểm, ma trận, xếp loại đơn vị).
 *
 * Neo dùng ở đây đều là neo chung của khung, không phải neo riêng của từng màn:
 *   `#tour-settings-nav`    lưới thẻ ở màn hình chọn mục
 *   `#tour-card-<id>`       một thẻ trên lưới
 *   `#tour-section-tabs`    hàng tab cấp 2 (các mục cùng cụm)
 *   `#tour-section-root`    thân của mục đang mở — mục nào cũng có
 *   `#tour-workspace-card`  card mở đầu của mục (mô tả, số liệu, nút hành động)
 *   `#tour-workspace-tabs`  hàng tab cấp 3 bên trong card đó
 * Nhờ vậy thêm bước hướng dẫn không phải sửa vào component nghiệp vụ.
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

const setupToolsTours = perLanguage((): Record<TourKey, TourDef> => ({
  /* ══════════ Cấp trang ══════════ */
  'setup-tools': {
    steps: [
      {
        target: '#tour-settings-nav',
        title: i18n.t('shared:setup_tools.twoGroupsTwoKindsOfWork'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.theGroup')} <strong>{i18n.t('shared:setup_tools.configuration')}</strong> {i18n.t('shared:setup_tools.answersWhichRulesTheOrganizationScores')}
            </p>
            <p>
              {i18n.t('shared:setup_tools.theGroup')} <strong>{i18n.t('shared:setup_tools.tools')}</strong> {i18n.t('shared:setup_tools.isWhere')} <strong>{i18n.t('shared:setup_tools.eachCyclesOperations')}</strong>{i18n.t('shared:setup_tools.happenOpenEvaluationCyclesBuildOkr')}
            </p>
            <p className="text-caption">
              {i18n.t('shared:setup_tools.aMissingCardMeansTheOrganization')}
            </p>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-card-modules',
        title: i18n.t('shared:setup_tools.n1StartHere'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.thisIsTheMasterSwitchTurning')}
            </p>
            {note(i18n.t('shared:setup_tools.newOrganizationsShouldGoThroughThe'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-card-scoring',
        title: i18n.t('shared:setup_tools.n2ScoringRules'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.theNextThreeCardsFormA')} <strong>{i18n.t('shared:setup_tools.scoringScales')}</strong> {i18n.t('shared:setup_tools.convertResultsIntoScores')} <strong>{i18n.t('shared:setup_tools.evaluationMatrix')}</strong> {i18n.t('shared:setup_tools.combineConductScoreWithKpiInto')} <strong>{i18n.t('shared:setup_tools.unitRating')}</strong> {i18n.t('shared:setup_tools.applyStandardsToWholeDepartments')}
            </p>
            {warn(i18n.t('shared:setup_tools.changingTheScoringScaleMidCycle'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-card-kpi-cycles',
        title: i18n.t('shared:setup_tools.n3ThenOperations'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.onceConfiguredOpenAn')} <strong>{i18n.t('shared:setup_tools.evaluationCycle')}</strong> {i18n.t('shared:setup_tools.everyKpiActivityIsAttachedTo')}
            </p>
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  /* ══════════ Cụm Cấu hình ══════════ */
  'setup-tools/modules': {
    steps: [
      {
        target: '#tour-modules-grid',
        title: i18n.t('shared:setup_tools.theOrganizationsMasterSwitches'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.eachSwitchOpensAnAreaOf')}
            </p>
            {warn(i18n.t('shared:setup_tools.turningOffAModuleDoesNot'))}
          </div>
        ),
        placement: 'right',
      },
      {
        target: '#tour-modules-grid',
        title: i18n.t('shared:setup_tools.whatDependsOnWhat'),
        content: (
          <div className="space-y-2">
            <ul className="text-xs space-y-1.5 list-disc pl-4 text-[var(--color-muted-foreground)] font-medium">
              <li><strong className="text-[var(--color-foreground)]">{i18n.t('shared:setup_tools.behavioralKpis')}</strong> {i18n.t('shared:setup_tools.mustBeOnForTheQualitative')}</li>
              <li><strong className="text-[var(--color-foreground)]">BSC:</strong> {i18n.t('shared:setup_tools.whenOnThereIsASection')}</li>
              <li><strong className="text-[var(--color-foreground)]">OKR:</strong> {i18n.t('shared:setup_tools.whenOnAnalyticsSwitchesFromViewing')}</li>
              <li><strong className="text-[var(--color-foreground)]">{i18n.t('shared:setup_tools.rewardsWallet')}</strong> {i18n.t('shared:setup_tools.twoDifferentBalancesPointsAndMoney')}</li>
            </ul>
          </div>
        ),
        placement: 'right',
      },
      {
        target: '#tour-section-tabs',
        title: i18n.t('shared:setup_tools.moveWithinTheGroup'),
        content: (
          <p>
            {i18n.t('shared:setup_tools.thisTabRowOnlyListsThe')} <strong>{i18n.t('shared:setup_tools.inTheSameGroup')}</strong> {i18n.t('shared:setup_tools.asTheOpenOneToJump')}
          </p>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-tools/scoring': {
    steps: [
      {
        target: '#tour-workspace-tabs',
        title: i18n.t('shared:setup_tools.threeScalesThreeKindsOfQuestion'),
        content: (
          <div className="space-y-2">
            <ul className="text-xs space-y-1.5 list-disc pl-4 text-[var(--color-muted-foreground)] font-medium">
              <li><strong className="text-[var(--color-foreground)]">{i18n.t('shared:setup_tools.quantitative')}</strong> {i18n.t('shared:setup_tools.measurableByNumbersRevenueNumberOf')}</li>
              <li><strong className="text-[var(--color-foreground)]">{i18n.t('shared:setup_tools.qualitative')}</strong> {i18n.t('shared:setup_tools.theScorerChoosesAPresetLevel')}</li>
              <li><strong className="text-[var(--color-foreground)]">{i18n.t('shared:setup_tools.conduct')}</strong> {i18n.t('shared:setup_tools.aWeightedConductCriteriaSetScored')}</li>
            </ul>
            {note(i18n.t('shared:setup_tools.aMissingTabMeansTheOrganization'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-workspace-card',
        title: i18n.t('shared:setup_tools.viewFirstEditLater'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.byDefaultTheScreenIsIn')} <strong>{i18n.t('shared:setup_tools.viewOnly')}</strong>{i18n.t('shared:setup_tools.modeClick')} <strong>{i18n.t('shared:setup_tools.edit')}</strong> {i18n.t('shared:setup_tools.inTheRightCornerOfThis')} <strong>↺</strong> {i18n.t('shared:setup_tools.nextToItReturnsTheWhole')}
            </p>
            {warn(i18n.t('shared:setup_tools.resettingToDefaultOverwritesEveryLevel'))}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-tools/scoring#quantitative': {
    title: i18n.t('shared:setup_tools.quantitativeScale'),
    steps: [
      {
        target: '#tour-scoring-max',
        title: i18n.t('shared:setup_tools.howManyPointsIsTheScale'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.theNumberInThePurpleBlock')} <strong>{i18n.t('shared:setup_tools.maximumScore')}</strong> {i18n.t('shared:setup_tools.ofAQuantitativeKpiEveryCompletion')}
            </p>
            {warn(i18n.t('shared:setup_tools.changingTheScaleMidCycleMeans'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-scoring-levels',
        title: i18n.t('shared:setup_tools.ratingLevels'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.eachLevelHasA')} <strong>{i18n.t('shared:setup_tools.name')}</strong>, <strong>{i18n.t('shared:setup_tools.scoreThreshold')}</strong> {i18n.t('shared:setup_tools.and')} <strong>{i18n.t('shared:setup_tools.color')}</strong>{i18n.t('shared:setup_tools.aResultFallsIntoTheLevel')}
            </p>
            {note(i18n.t('shared:setup_tools.theColorHereIsTheColor'))}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-scoring-levels',
        title: i18n.t('shared:setup_tools.addAndRemoveLevels'),
        content: (
          <p>
            {i18n.t('shared:setup_tools.inEditModeEachLevelHas')} <strong>{i18n.t('shared:setup_tools.addLevel')}</strong> {i18n.t('shared:setup_tools.atTheTopOfTheList')} <strong>{i18n.t('shared:setup_tools.saveSettings')}</strong> {i18n.t('shared:setup_tools.atTheBottomSkipSavingAnd')}
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/scoring#qualitative': {
    title: i18n.t('shared:setup_tools.qualitativeScale'),
    steps: [
      {
        target: '#tour-qualitative-guide',
        title: i18n.t('shared:setup_tools.noFormulaOnlyLevels'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.unlikeQuantitativeTheScorer')} <strong>{i18n.t('shared:setup_tools.choosesALevelDirectly')}</strong> {i18n.t('shared:setup_tools.fromTheListYouDeclareHere')}
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-qualitative-levels',
        title: i18n.t('shared:setup_tools.positionValueBsc'),
        content: (
          <div className="space-y-2">
            <ul className="text-xs space-y-1.5 list-disc pl-4 text-[var(--color-muted-foreground)] font-medium">
              <li><strong className="text-[var(--color-foreground)]">{i18n.t('shared:setup_tools.position')}</strong> {i18n.t('shared:setup_tools.columnOrderWhenExportingSpreadsheets')}</li>
              <li><strong className="text-[var(--color-foreground)]">{i18n.t('shared:setup_tools.value')}</strong> {i18n.t('shared:setup_tools.theConvertedScoreUsedAsAn')}</li>
              <li><strong className="text-[var(--color-foreground)]">% BSC:</strong> {i18n.t('shared:setup_tools.theCorrespondingCompletionLevelWhenComputing')}</li>
            </ul>
            {note(i18n.t('shared:setup_tools.valueAndBscAreIndependentA'))}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-qualitative-levels',
        title: i18n.t('shared:setup_tools.nameLevelsInYourCompanysLanguage'),
        content: (
          <p>
            {i18n.t('shared:setup_tools.scorersReadExactlyTheNameYou')}
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/scoring#conduct': {
    title: i18n.t('shared:setup_tools.conductCriteriaSets'),
    steps: [
      {
        target: '#tour-conduct-sets',
        title: i18n.t('shared:setup_tools.oneCriteriaSetPerCycle'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.aConductCriteriaSetIsA')} <strong>{i18n.t('shared:setup_tools.weights')}</strong>{i18n.t('shared:setup_tools.aSetIsAssignedToOne')} <strong>{i18n.t('shared:setup_tools.defaultSet')}</strong>.
            </p>
            {warn(i18n.t('shared:setup_tools.withoutADefaultSetUnassignedCycles'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-conduct-sets',
        title: i18n.t('shared:setup_tools.theTotalWeightMustEqual100'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.openASetToEditCriterion')}
            </p>
            {warn(i18n.t('shared:setup_tools.ifTheTotalIsNot100'))}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-conduct-add-set',
        title: i18n.t('shared:setup_tools.duplicateInsteadOfRetyping'),
        content: (
          <p>
            {i18n.t('shared:setup_tools.ifNextCycleOnlyDiffersIn')} <strong>{i18n.t('shared:setup_tools.duplicate')}</strong> {i18n.t('shared:setup_tools.onTheOldSetAndEdit')}
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/matrix': {
    steps: [
      {
        target: '#tour-matrix-guide',
        title: i18n.t('shared:setup_tools.twoAxesIntoOneRating'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.theMatrixCombinesThe')} <strong>{i18n.t('shared:setup_tools.conductScore')}</strong> {i18n.t('shared:setup_tools.rowsWith')} <strong>{i18n.t('shared:setup_tools.kpiCompletion')}</strong> {i18n.t('shared:setup_tools.columnsIntoAPersonsFinalRating')}
            </p>
            {warn(i18n.t('shared:setup_tools.aRatingOnlyComesOutWhen'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-matrix-table',
        title: i18n.t('shared:setup_tools.readTheTableInTwoDirections'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.theTopLeftCellNamesThe')} <strong>{i18n.t('shared:setup_tools.rating')}</strong> {i18n.t('shared:setup_tools.theEmployeeReceives')}
            </p>
            {note(i18n.t('shared:setup_tools.ifTheTableIsWiderThan'))}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-matrix-header',
        title: i18n.t('shared:setup_tools.editLabelsAddOrRemoveBands'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.clickThePencilIconHereTo')} <strong>{i18n.t('shared:setup_tools.row')}</strong> / <strong>{i18n.t('shared:setup_tools.column')}</strong>{i18n.t('shared:setup_tools.andFillInTheCellValues')}
            </p>
            {warn(i18n.t('shared:setup_tools.cellValuesMustBeIntegersOf'))}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-tools/unit-class': {
    steps: [
      {
        target: '#tour-unitclass-header',
        title: i18n.t('shared:setup_tools.ratingForTheWholeUnit'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.theMatrixInThePreviousSection')} <strong>{i18n.t('shared:setup_tools.eachPerson')}</strong>{i18n.t('shared:setup_tools.thisSectionRates')} <strong>{i18n.t('shared:setup_tools.theWholeDepartment')}</strong> {i18n.t('shared:setup_tools.byTheShareOfItsPeople')}
            </p>
            {note(i18n.t('shared:setup_tools.theButtonNextToTheHeading'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-unitclass-levels',
        title: i18n.t('shared:setup_tools.levelScaleForReference'),
        content: (
          <p>
            {i18n.t('shared:setup_tools.thisThinRowListsTheCurrent')}
          </p>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-unitclass-profiles',
        title: i18n.t('shared:setup_tools.oneSetOfRulesPerProfile'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.openAProfileToSeeThe')} <strong>{i18n.t('shared:setup_tools.ratingLevels2')}</strong> {i18n.t('shared:setup_tools.orderedFromHighToLowEach')}
            </p>
            <p>
              {i18n.t('shared:setup_tools.theUnitIsPlacedInThe')} <strong>{i18n.t('shared:setup_tools.firstLevelFromTheTop')}</strong> {i18n.t('shared:setup_tools.thatItSatisfies')} <strong>{i18n.t('shared:setup_tools.all')}</strong>
              {i18n.t('shared:setup_tools.conditionsOfSoLevelOrderMatters')}
            </p>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-unitclass-add',
        title: i18n.t('shared:setup_tools.oneProfilePerGroupOfUnits'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.addAProfileWhenTheSales')}
            </p>
            {warn(i18n.t('shared:setup_tools.alwaysKeepADefaultProfileA'))}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  /* ══════════ Cụm Công cụ ══════════ */
  'setup-tools/kpi-cycles': {
    steps: [
      {
        target: '#tour-workspace-tabs',
        title: i18n.t('shared:setup_tools.aCycleGroupsPeriods'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.twoTimeLayersDoNotMix')} <strong>{i18n.t('shared:setup_tools.aPeriod')}</strong> {i18n.t('shared:setup_tools.isOneRoundOfSubmissionAnd')} <strong>{i18n.t('shared:setup_tools.aCycle')}</strong> {i18n.t('shared:setup_tools.groupsSeveralPeriodsIntoOneCombined')}
            </p>
            <p className="text-caption">
              {i18n.t('shared:setup_tools.employeesSubmitReportsByPeriodRatings')}
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-workspace-card',
        title: i18n.t('shared:setup_tools.withoutAnOpenPeriodNobodyCan'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.thisIsTheSectionToTouch')}
            </p>
            {warn(i18n.t('shared:setup_tools.forgettingToOpenAPeriodMeans'))}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-tools/kpi-cycles#cycles': {
    title: i18n.t('shared:setup_tools.evaluationCycles'),
    steps: [
      {
        target: '#tour-cycles-header',
        title: i18n.t('shared:setup_tools.aCycleGroupsPeriods2'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.aCycleIsAMonthQuarter')}
            </p>
            {note(i18n.t('shared:setup_tools.createTheCycleFirstThenGo'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-cycles-toolbar',
        title: i18n.t('shared:setup_tools.findAndFilterOldCycles'),
        content: (
          <p>
            {i18n.t('shared:setup_tools.filterByNameCycleTypeAnd')}
            <strong> {i18n.t('shared:setup_tools.tableView')}</strong> {i18n.t('shared:setup_tools.and')} <strong>{i18n.t('shared:setup_tools.cardView')}</strong> {i18n.t('shared:setup_tools.theTableSuitsComparingDatesCards')}
          </p>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-cycles-content',
        title: i18n.t('shared:setup_tools.numberOfPeriodsOnEachRow'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.theColumn')} <strong>{i18n.t('shared:setup_tools.periods')}</strong> {i18n.t('shared:setup_tools.showsHowManyPeriodsTheCycle')}
            </p>
            {warn(i18n.t('shared:setup_tools.deletingACycleDoesNotDelete'))}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/kpi-cycles#periods': {
    title: i18n.t('shared:setup_tools.evaluationPeriods'),
    steps: [
      {
        target: '#tour-periods-header',
        title: i18n.t('shared:setup_tools.aPeriodIsOneRoundOf'),
        content: (
          <div className="space-y-2">
            <p>{i18n.t('shared:setup_tools.aKpiPeriodIsOneOfficial')}</p>
            <p className="text-caption">
              {i18n.t('shared:setup_tools.setItUpBy')} <strong>{i18n.t('shared:setup_tools.monthQuarterYear')}</strong> {i18n.t('shared:setup_tools.orByShortTermCampaignDepending')}
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-periods-toolbar',
        title: i18n.t('shared:setup_tools.reviewOldPeriods'),
        content: (
          <p>
            {i18n.t('shared:setup_tools.theSystemKeepsDataForMany')}
          </p>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-periods-content',
        title: i18n.t('shared:setup_tools.datesDecideEverything'),
        content: (
          <div className="space-y-3">
            <p>
              {i18n.t('shared:setup_tools.setThe')} <strong>{i18n.t('shared:setup_tools.startAndEndDates')}</strong> {i18n.t('shared:setup_tools.forThePeriodEmployeesCanOnly')}
            </p>
            {warn(i18n.t('shared:setup_tools.shorteningTheEndDateOfA'))}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-tools/okr': {
    steps: [
      {
        target: '#tour-okr-header',
        title: i18n.t('shared:setup_tools.strategyManagementOkr'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.whereYouSetStrategic')} <strong>{i18n.t('shared:setup_tools.objectives')}</strong> {i18n.t('shared:setup_tools.andQuantitative')}{' '}
              <strong>{i18n.t('shared:setup_tools.keyResults')}</strong> {i18n.t('shared:setup_tools.thatMeasureSuccess')}
            </p>
            {note(i18n.t('shared:setup_tools.okrHelpsTheWholeOrganizationFocus'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-okr-add-btn',
        title: i18n.t('shared:setup_tools.objectiveFirstKeyResultsAfter'),
        content: (
          <p>
            {i18n.t('shared:setup_tools.createAnInspiring')} <strong>Objective</strong> {i18n.t('shared:setup_tools.firstThenAddSpecific')}{' '}
            <strong>Key Result</strong> {i18n.t('shared:setup_tools.toMeasureItAnObjectiveWithout')}
          </p>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-okr-list',
        title: i18n.t('shared:setup_tools.progressUpdatesItself'),
        content: (
          <div className="space-y-2">
            <p>{i18n.t('shared:setup_tools.anObjectivesProgressIsComputedAutomatically')}</p>
            {warn(i18n.t('shared:setup_tools.aKeyResultLinkedToA'))}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-tools/bsc': {
    steps: [
      {
        target: '#tour-bsc-header',
        title: i18n.t('shared:setup_tools.scorecardsAcross4Areas'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.each')} <strong>{i18n.t('shared:setup_tools.scorecard')}</strong> {i18n.t('shared:setup_tools.isAttachedToACycleAnd')}
            </p>
            {note(i18n.t('shared:setup_tools.theImportButtonHereCanImport'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-bsc-scorecards',
        title: i18n.t('shared:setup_tools.n1CreateTheScorecardThenAdd'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.click')} <strong>{i18n.t('shared:setup_tools.newScorecard')}</strong> {i18n.t('shared:setup_tools.toCreateOneThenClickThe')}
            </p>
            {warn(i18n.t('shared:setup_tools.theTotalWeightOfItemsIn'))}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '.tour-bsc-scorecard-card',
        title: i18n.t('shared:setup_tools.runInParallelThenMakeIt'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.eachScorecardHasTwoModes')} <strong>{i18n.t('shared:setup_tools.parallel')}</strong>{i18n.t('shared:setup_tools.bscScoresAreStillComputedAnd')} <strong>{i18n.t('shared:setup_tools.official')}</strong>{i18n.t('shared:setup_tools.theBscScoreReplacesTheSystem')}
            </p>
            {warn(i18n.t('shared:setup_tools.inOfficialModeEvaluationsAreBlocked'))}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-bsc-scorecards',
        title: i18n.t('shared:setup_tools.whereToSeeTheResults'),
        content: (
          <p>
            {i18n.t('shared:setup_tools.scoresByItemTheBalanceRadar')}
            <strong> {i18n.t('shared:setup_tools.statisticsBscScorecard')}</strong>.
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/rewards': {
    steps: [
      {
        target: '#tour-workspace-card',
        title: i18n.t('shared:setup_tools.rewardPointsNotMoney'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.thisWholeSectionRunsOn')} <strong>{i18n.t('shared:setup_tools.points')}</strong>{i18n.t('shared:setup_tools.givingPointsToEmployeesSettingBudgets')}
            </p>
            {note(i18n.t('shared:setup_tools.theFeedAboveTheTabRow'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-workspace-tabs',
        title: i18n.t('shared:setup_tools.sevenTabsFourKindsOfWork'),
        content: (
          <div className="space-y-2">
            <ul className="text-xs space-y-1.5 list-disc pl-4 text-[var(--color-muted-foreground)] font-medium">
              <li><strong className="text-[var(--color-foreground)]">{i18n.t('shared:setup_tools.giveApprove')}</strong> {i18n.t('shared:setup_tools.rewardProposalsBudgets')}</li>
              <li><strong className="text-[var(--color-foreground)]">{i18n.t('shared:setup_tools.automatic')}</strong> {i18n.t('shared:setup_tools.automaticProgramsCheckIns')}</li>
              <li><strong className="text-[var(--color-foreground)]">{i18n.t('shared:setup_tools.recognition')}</strong> {i18n.t('shared:setup_tools.certificateTemplates')}</li>
              <li><strong className="text-[var(--color-foreground)]">{i18n.t('shared:setup_tools.giftRedemption')}</strong> {i18n.t('shared:setup_tools.giftsGiftRedemptionRequests')}</li>
            </ul>
            {note(i18n.t('shared:setup_tools.theGoldNumberOnATab'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-workspace-tabs',
        title: i18n.t('shared:setup_tools.setupOrderTheFirstTime'),
        content: (
          <p>
            {i18n.t('shared:setup_tools.newOrganizationsShouldGo')} <strong>{i18n.t('shared:setup_tools.budgets')}</strong> {i18n.t('shared:setup_tools.soManagersCanRewardOnTheir')}{' '}
            <strong>{i18n.t('shared:setup_tools.gifts')}</strong> {i18n.t('shared:setup_tools.soPointsHaveSomewhereToBe')}{' '}
            <strong>{i18n.t('shared:setup_tools.checkIns')}</strong> {i18n.t('shared:setup_tools.and')} <strong>{i18n.t('shared:setup_tools.automaticPrograms')}</strong>.
          </p>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-tools/rewards#grants': {
    title: i18n.t('shared:setup_tools.rewardProposals'),
    steps: [
      {
        target: '#tour-grants-filters',
        title: i18n.t('shared:setup_tools.filterByStatus'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.allSixStatusesAreShownAs')}
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-grants-root',
        title: i18n.t('shared:setup_tools.withinTheBudgetNoApprovalNeeded'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.whenAManagerGivesPoints')} <strong>{i18n.t('shared:setup_tools.withinTheirBudget')}</strong> {i18n.t('shared:setup_tools.itTakesEffectImmediatelyAboveThe')}
            </p>
            {warn(i18n.t('shared:setup_tools.approvingPutsThePointsIntoThe'))}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-grants-root',
        title: i18n.t('shared:setup_tools.giveNewPoints'),
        content: (
          <p>
            {i18n.t('shared:setup_tools.theButton')} <strong>{i18n.t('shared:setup_tools.rewardPoints')}</strong> {i18n.t('shared:setup_tools.isOnTheCardAtThe')}
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/rewards#budgets': {
    title: i18n.t('shared:setup_tools.rewardBudgets'),
    steps: [
      {
        target: '#tour-budgets-note',
        title: i18n.t('shared:setup_tools.aBudgetSoYouDoNot'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.peopleWithABudgetCanReward')}
            </p>
            {warn(i18n.t('shared:setup_tools.withoutGrantingBudgetsToAnyoneEvery'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-budgets-root',
        title: i18n.t('shared:setup_tools.validityHasATimeLimit'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.theTextOnTheTableCounts')} <strong>{i18n.t('shared:setup_tools.inEffect')}</strong>{i18n.t('shared:setup_tools.notIncludingExpiredOnesEachBudget')}
            </p>
            {note(i18n.t('shared:setup_tools.expiredBudgetsDoNotRenewAutomatically'))}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/rewards#programs': {
    title: i18n.t('shared:setup_tools.automaticPrograms'),
    steps: [
      {
        target: '#tour-programs-note',
        title: i18n.t('shared:setup_tools.automaticButYouStillClickRun'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.programs')} <strong>{i18n.t('shared:setup_tools.doNotRunOnASchedule')}</strong>{i18n.t('shared:setup_tools.youClick')} <strong>{i18n.t('shared:setup_tools.run')}</strong>{i18n.t('shared:setup_tools.chooseThePeriodCyclePreviewThe')}
            </p>
            {note(i18n.t('shared:setup_tools.rewardTiersDeclaredInTheConfiguration'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-programs-actions',
        title: i18n.t('shared:setup_tools.setTheRuleOnce'),
        content: (
          <p>
            <strong>{i18n.t('shared:setup_tools.createProgram')}</strong> {i18n.t('shared:setup_tools.toDeclareTheRuleWhoeverMakes')}
          </p>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-programs-root',
        title: i18n.t('shared:setup_tools.pointsComeFromTheCommonFund'),
        content: (
          <p>
            {i18n.t('shared:setup_tools.pointsAwardedByProgramsComeFrom')} <strong>{i18n.t('shared:setup_tools.organizationsCommonFund')}</strong>{i18n.t('shared:setup_tools.notDeductedFromAnyManagersPersonal')}
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/rewards#checkin': {
    title: i18n.t('shared:setup_tools.checkIns'),
    steps: [
      {
        target: '#tour-checkin-note',
        title: i18n.t('shared:setup_tools.employeesClickEveryDayThemselves'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.theCheckInCardShowsOn')} <strong>{i18n.t('shared:setup_tools.mineMyPoints')}</strong>{i18n.t('shared:setup_tools.whenEmployeesClickThePointsGo')}
            </p>
            {warn(i18n.t('shared:setup_tools.pointsPerCheckInTimesHeadcount'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-checkin-stats',
        title: i18n.t('shared:setup_tools.twoFiguresToCalibrateThePoints'),
        content: (
          <p>
            <strong>{i18n.t('shared:setup_tools.checkedInToday')}</strong> {i18n.t('shared:setup_tools.showsHowManyPeopleActuallyUse')}{' '}
            <strong>{i18n.t('shared:setup_tools.pointsGivenThisMonth')}</strong> {i18n.t('shared:setup_tools.isTheRealCostOfThe')}
          </p>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-checkin-form',
        title: i18n.t('shared:setup_tools.turnOnSetPointsRewardStreaks'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.theFirstSwitchTurnsTheWhole')}
            </p>
            {note(i18n.t('shared:setup_tools.streakRulesAreDecidedByThe'))}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/rewards#certificates': {
    title: i18n.t('shared:setup_tools.certificateTemplates2'),
    steps: [
      {
        target: '#tour-certificates-intro',
        title: i18n.t('shared:setup_tools.theCompanysOwnCertificates'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.withoutAnyTemplateThePrintScreen')}
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-certificates-root',
        title: i18n.t('shared:setup_tools.whenTheyAreUsed'),
        content: (
          <p>
            {i18n.t('shared:setup_tools.templatesAreUsedWhenPrintingA')}
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/rewards#gifts': {
    title: i18n.t('shared:setup_tools.gifts'),
    steps: [
      {
        target: '#tour-gifts-actions',
        title: i18n.t('shared:setup_tools.giftCatalogForPoints'),
        content: (
          <div className="space-y-2">
            <p>
              <strong>{i18n.t('shared:setup_tools.addGift')}</strong> {i18n.t('shared:setup_tools.toDeclareANewItemName')}
            </p>
            {note(i18n.t('shared:setup_tools.thereIsAUrboxGiftCatalog'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-gifts-root',
        title: i18n.t('shared:setup_tools.outOfStockLocksAutomatically'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.whenTheQuantityReaches0The')}
            </p>
            {warn(i18n.t('shared:setup_tools.withAnEmptyShopRewardPoints'))}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/rewards#redemptions': {
    title: i18n.t('shared:setup_tools.giftRedemptionRequests'),
    steps: [
      {
        target: '#tour-redemptions-filters',
        title: i18n.t('shared:setup_tools.giftDeliveryQueue'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.filterByStatusToSeparateThe')} <strong>{i18n.t('shared:setup_tools.pending')}</strong> {i18n.t('shared:setup_tools.partFromTheDeliveredPartThe')}
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-redemptions-root',
        title: i18n.t('shared:setup_tools.pointsAreDeductedOnRedemption'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.whenEmployeesClickRedeemPointsAre')}
            </p>
            {warn(i18n.t('shared:setup_tools.slowHandlingMeansPeopleHaveLost'))}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/wallet': {
    steps: [
      {
        target: '#tour-workspace-card',
        title: i18n.t('shared:setup_tools.thisIsRealMoney'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.theWalletIsCompletelySeparateFrom')}
            </p>
            {warn(i18n.t('shared:setup_tools.doNotConfuseTheTwoBalances'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-workspace-tabs',
        title: i18n.t('shared:setup_tools.viewConfigureReconcile'),
        content: (
          <div className="space-y-2">
            <p>
              <strong>{i18n.t('shared:setup_tools.peopleBalances')}</strong> {i18n.t('shared:setup_tools.toLookThingsUp')} <strong>{i18n.t('shared:setup_tools.configuration')}</strong> {i18n.t('shared:setup_tools.toSetTheReceivingAccountAnd')} <strong>{i18n.t('shared:setup_tools.sepayReconciliation')}</strong> {i18n.t('shared:setup_tools.toMatchTransferTransactions')}
            </p>
            {note(i18n.t('shared:setup_tools.whenSettingUpForTheFirst'))}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-tools/wallet#wallets': {
    title: i18n.t('shared:setup_tools.peopleBalances'),
    steps: [
      {
        target: '#tour-cashwallets-stats',
        title: i18n.t('shared:setup_tools.threeFiguresForTheWholeOrganization'),
        content: (
          <div className="space-y-2">
            <p>
              <strong>{i18n.t('shared:setup_tools.holding')}</strong> {i18n.t('shared:setup_tools.isMoneyToppedUpButNot')} <strong>{i18n.t('shared:setup_tools.convertedToPoints')}</strong> {i18n.t('shared:setup_tools.isThePartAlreadySpent')} <strong>{i18n.t('shared:setup_tools.wallets')}</strong> {i18n.t('shared:setup_tools.countsPeopleWhoHaveToppedUp')}
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-cashwallets-filters',
        title: i18n.t('shared:setup_tools.lookUpWhenThereIsA'),
        content: (
          <p>
            {i18n.t('shared:setup_tools.searchByNameOrEmailFilter')}
          </p>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-cashwallets-stats',
        title: i18n.t('shared:setup_tools.walletsOutOfBalanceWithThe'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.whenAWalletIsOutOf')}
            </p>
            {warn(i18n.t('shared:setup_tools.aWalletOutOfBalanceIs'))}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-tools/wallet#config': {
    title: i18n.t('shared:setup_tools.walletConfiguration'),
    steps: [
      {
        target: '#tour-wallet-bank',
        title: i18n.t('shared:setup_tools.receivingAccount'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.theAccountNumberAndBankCode')} <strong>{i18n.t('shared:setup_tools.twoRequiredFields')}</strong> {i18n.t('shared:setup_tools.toBuildTheVietqrCodeWithout')}
            </p>
            {warn(i18n.t('shared:setup_tools.ifNothingEverComesInAfter'))}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-wallet-rate',
        title: i18n.t('shared:setup_tools.exchangeRate'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.theAmountOfMoneyThatConverts')} <strong>{i18n.t('shared:setup_tools.employeesWillSee')}</strong> {i18n.t('shared:setup_tools.nextToItConvertsAFew')}
            </p>
            {note(i18n.t('shared:setup_tools.pastTransactionsKeepTheOldRate'))}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-wallet-limits',
        title: i18n.t('shared:setup_tools.limitsAndQrCodeLifetime'),
        content: (
          <p>
            {i18n.t('shared:setup_tools.limitsTheAmountPerTopUp')}
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/wallet#reconcile': {
    title: i18n.t('shared:setup_tools.sepayReconciliation'),
    steps: [
      {
        target: '#tour-sepay-status',
        title: i18n.t('shared:setup_tools.doesTheLedgerBalance'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.theTopStripStatesTheStatus')}
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-sepay-scope',
        title: i18n.t('shared:setup_tools.queueOrAll'),
        content: (
          <div className="space-y-2">
            <p>
              <strong>{i18n.t('shared:setup_tools.queue')}</strong> {i18n.t('shared:setup_tools.showsOnlyTransactionsThatNeedYou')} <strong>{i18n.t('shared:setup_tools.all2')}</strong> {i18n.t('shared:setup_tools.showsEveryTransactionTheSystemReceived')}
            </p>
            {note(i18n.t('shared:setup_tools.unmatchedTransactionsAreUsuallyBecauseEmployees'))}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-tools/ai-quota': {
    steps: [
      {
        target: '#tour-aiquota-mine',
        title: i18n.t('shared:setup_tools.yourOwnQuota'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.theTopCardIsYourOwn')}
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-aiquota-pool',
        title: i18n.t('shared:setup_tools.theAllocationPool'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.theseThreeCardsShowHowMuch')}
            </p>
            {warn(i18n.t('shared:setup_tools.withAPoolOf0Nothing'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-aiquota-delegation',
        title: i18n.t('shared:setup_tools.letLowerLevelsAllocateThemselves'),
        content: (
          <p>
            {i18n.t('shared:setup_tools.turnThisSwitchOnAndUnit')}
          </p>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-aiquota-people',
        title: i18n.t('shared:setup_tools.whenTheQuotaRunsOutThe'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_tools.findPeopleByNameFilterBy')}
            </p>
            {note(i18n.t('shared:setup_tools.quotasResetMonthlyUnusedAmountsDo'))}
          </div>
        ),
        placement: 'top',
      },
    ],
  },
}))

export default setupToolsTours
