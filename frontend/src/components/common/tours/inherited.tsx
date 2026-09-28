import { Step } from 'react-joyride'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Nội dung hướng dẫn viết từ hồi mỗi màn hình còn là một dòng sidebar riêng.
 *
 * Vẫn đang chạy và vẫn đúng, nên được các file trong thư mục này dùng lại nguyên vẹn
 * thay vì chép tay sang chỗ mới — chép tay một đống JSX chỉ để đổi chỗ ở là cách chắc
 * chắn nhất để làm rơi mất một bước.
 *
 * Khác biệt với các file cùng thư mục: ở đây là mảng bước trần, không mang khoá. Khoá
 * ba tầng do file của từng trang gán. Viết lại màn nào thì bê nội dung vào file trang
 * đó và xoá mảng tương ứng khỏi đây.
 */

/**
 * Page tour definitions - each page has its own set of steps.
 * Steps only reference DOM targets that exist on that specific page.
 */

/* ─── KPI Criteria Page ─── */
export const kpiCriteriaSteps = perLanguage((): Step[] => ([
  {
    target: '#tour-kpi-toolbar',
    title: i18n.t('shared:inherited.centralizedKpiManagement'),
    content: (
      <div className="space-y-2">
        <p>{i18n.t('shared:inherited.aPowerfulFilteringToolThatLets')}</p>
        <p className="text-caption">{i18n.t('shared:inherited.youCanFilterByDepartmentKpi')}</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-kpi-add-btn',
    title: i18n.t('shared:inherited.setGoals'),
    content: (
      <div className="space-y-3">
        <p>{i18n.t('shared:inherited.startAssigningKpisToYourTeam')} <strong>SMART</strong> {i18n.t('shared:inherited.specificMeasurableAchievableRelevantTimeBound')}</p>
        <div className="p-2 bg-[var(--color-warning-bg)] border-l-4 border-[var(--color-warning-border)] rounded text-xs text-[var(--color-warning)] font-medium">
          {i18n.t('shared:inherited.importantMakeSureTheTotalWeight')}
        </div>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-kpi-tabs',
    title: i18n.t('shared:inherited.approvalFlow'),
    content: (
      <div className="space-y-2">
        <p>{i18n.t('shared:inherited.closelyTrackTheStatusOfEach')}</p>
        <p className="text-caption italic">{i18n.t('shared:inherited.rememberOnlyKpisInThe')} <strong>{i18n.t('shared:inherited.approved')}</strong> {i18n.t('shared:inherited.statusOfficiallyTakeEffectAndCount')}</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    // Trước đây bước này trỏ vào `#tour-kpi-delegate-btn` — nút nằm TRONG menu "..." của
    // từng dòng, nên chỉ tồn tại lúc menu đang mở. Ngoài đời không bao giờ có neo đó và
    // TourHost lặng lẽ bỏ luôn bước này. Trỏ vào chính danh sách rồi chỉ đường tới menu.
    target: '#tour-kpi-list',
    title: i18n.t('shared:inherited.cascadeGoals'),
    content: (
      <div className="space-y-2">
        <p>
          {i18n.t('shared:inherited.eachRowHasAMenu')} <strong>“…”</strong> {i18n.t('shared:inherited.atTheEndInIt')} <strong>{i18n.t('shared:inherited.cascadeKpi')}</strong> {i18n.t('shared:inherited.isAShortcutTo')} <strong>{i18n.t('shared:inherited.assignWork')}</strong> {i18n.t('shared:inherited.toSubordinates')}
        </p>
        <p className="text-xs bg-[var(--color-info-bg)] p-2 rounded-control text-[var(--color-info)] italic border-l-4 border-[var(--color-info-border)]">
          {i18n.t('shared:inherited.tipTheSystemAutomaticallyCreatesA')}
        </p>
        <p className="text-caption">
          {i18n.t('shared:inherited.onlyShownWhenTheOrganizationHas')} <strong>{i18n.t('shared:inherited.waterfall')}</strong> {i18n.t('shared:inherited.andTheKpiIsInStatus')} <strong>{i18n.t('shared:inherited.approved2')}</strong>.
        </p>
      </div>
    ),
    placement: 'top',
  },
]))

/* ─── My KPI Page ─── */
export const myKpiSteps = perLanguage((): Step[] => ([
  {
    target: '#tour-my-kpi-toolbar',
    title: i18n.t('shared:inherited.personalObjectivesBoard'),
    content: (
      <div className="space-y-2">
        <p>{i18n.t('shared:inherited.welcomeAllTheTasksAndGoals')}</p>
        <p className="text-xs text-[var(--color-primary)] font-medium italic">{i18n.t('shared:inherited.checkCarefullyTheTargetsYourManager')}</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-my-kpi-table',
    title: i18n.t('shared:inherited.trackExecute'),
    content: (
      <div className="space-y-3">
        <p>{i18n.t('shared:inherited.theKeyParametersYouNeedTo')}</p>
        <ul className="text-xs space-y-2 list-disc pl-4 text-[var(--color-muted-foreground)] font-medium">
          <li><strong className="text-[var(--color-foreground)]">{i18n.t('shared:inherited.unitOfMeasure')}</strong> {i18n.t('shared:inherited.howTheResultIsMeasuredVnd')}</li>
          <li><strong className="text-[var(--color-foreground)]">{i18n.t('shared:inherited.weight')}</strong> {i18n.t('shared:inherited.howMuchThisGoalAffectsYour')}</li>
          <li><strong className="text-[var(--color-foreground)]">{i18n.t('shared:inherited.progress')}</strong> {i18n.t('shared:inherited.clickThe')} <strong>{i18n.t('shared:inherited.submit')}</strong> {i18n.t('shared:inherited.buttonAsSoonAsYouFinish')}</li>
        </ul>
        <p className="text-xs bg-[var(--color-warning-bg)] p-2 rounded-control text-[var(--color-warning)] italic border-l-4 border-[var(--color-warning-border)]">
          {i18n.t('shared:inherited.tipIfAGoalNoLonger')}
        </p>
      </div>
    ),
    placement: 'bottom',
  },
]))

/* ─── My Submissions Page ─── */
export const mySubmissionsSteps = perLanguage((): Step[] => ([
  {
    target: '#tour-my-sub-tabs',
    title: i18n.t('shared:inherited.submissionStatus'),
    content: (
      <div className="space-y-2">
        <p>{i18n.t('shared:inherited.closelyTrackYourManagersApprovalProgress')}</p>
        <p className="text-caption">
          {i18n.t('shared:inherited.ifASubmissionIs')} <strong>{i18n.t('shared:inherited.rejected')}</strong>{i18n.t('shared:inherited.readYourManagersFeedbackCarefullyThen')}
        </p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-my-sub-list',
    title: i18n.t('shared:inherited.workLog'),
    content: (
      <div className="space-y-2">
        <p>{i18n.t('shared:inherited.thisIsTheArchiveOfThe')}</p>
        <p className="text-xs bg-[var(--color-primary-soft)] p-2 rounded-control text-[var(--color-primary)] italic">
          {i18n.t('shared:inherited.youCanUseThisDataTo')}
        </p>
      </div>
    ),
    placement: 'bottom',
  },
]))

/* ─── Org Unit Submissions (Approve) Page ─── */
export const orgUnitSubmissionsSteps = perLanguage((): Step[] => ([
  {
    target: '#tour-approve-stats',
    title: i18n.t('shared:inherited.reviewOverview'),
    content: <p>{i18n.t('shared:inherited.summaryFiguresToQuicklyGraspThe')}</p>,
    placement: 'bottom',
  },
  {
    target: '#tour-approve-toolbar',
    title: i18n.t('shared:inherited.filterPrioritize'),
    content: (
      <div className="space-y-2">
        <p>{i18n.t('shared:inherited.useFiltersToPrioritizeApprovingImportant')}</p>
        <p className="text-caption italic">{i18n.t('shared:inherited.youCanQuicklyFilterByEach')}</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-approve-table',
    title: i18n.t('shared:inherited.fairEvaluation'),
    content: (
      <div className="space-y-3">
        <p>{i18n.t('shared:inherited.whenApprovingSubmissionsClickEachRow')} <strong>{i18n.t('shared:inherited.evidenceDocuments')}</strong> {i18n.t('shared:inherited.theEmployeeAttached')}</p>
        <div className="p-2 bg-[var(--color-info-bg)] border-l-4 border-[var(--color-info-border)] rounded text-xs text-[var(--color-info)] font-medium">
          {i18n.t('shared:inherited.tipLeaveSincereCommentsFeedbackPositive')}
        </div>
      </div>
    ),
    placement: 'bottom',
  },
]))

/* ─── KPI Pending Approval Page ─── */
export const kpiPendingSteps = perLanguage((): Step[] => ([
  {
    target: '#tour-pending-header',
    title: i18n.t('shared:inherited.reviewGoals'),
    content: (
      <div className="space-y-2">
        <p>{i18n.t('shared:inherited.thisIsTheMostImportantStep')}</p>
        <p className="text-xs text-[var(--color-primary)] font-medium italic">{i18n.t('shared:inherited.agreeOnAndApproveGoalsRight')}</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-pending-toolbar',
    title: i18n.t('shared:inherited.filterByUnit'),
    content: <p>{i18n.t('shared:inherited.reviewDepartmentByDepartmentToEnsure')}</p>,
    placement: 'bottom',
  },
  {
    target: '#tour-pending-tabs',
    title: i18n.t('shared:inherited.quickHandling'),
    content: (
      <div className="space-y-2">
        <p>{i18n.t('shared:inherited.youCan')} <strong>{i18n.t('shared:inherited.bulkApprove')}</strong> {i18n.t('shared:inherited.kpisThatMeetTheStandardTo')}</p>
        <p className="text-caption italic">{i18n.t('shared:inherited.tipOnlyApproveWhenYouAre')}</p>
      </div>
    ),
    placement: 'bottom',
  },
]))

/* ─── KPI Adjustment Approval Page ─── */
export const kpiAdjustmentsSteps = perLanguage((): Step[] => ([
  {
    target: '#tour-adj-header',
    title: i18n.t('shared:inherited.changeControl'),
    content: (
      <div className="space-y-2">
        <p>{i18n.t('shared:inherited.duringTheWorkIfObjectiveChanges')} <strong>{i18n.t('shared:inherited.adjustFigures')}</strong>.</p>
        <p className="text-xs text-[var(--color-primary)] font-medium">{i18n.t('shared:inherited.youMakeTheFinalDecisionOn')}</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-adj-toolbar',
    title: i18n.t('shared:inherited.filterUrgentRequests'),
    content: <p>{i18n.t('shared:inherited.adjustmentRequestsAreUsuallyTimeSensitive')} <strong>{i18n.t('shared:inherited.countdown')}</strong> {i18n.t('shared:inherited.isAboutToRunOutTo')}</p>,
    placement: 'bottom',
  },
  {
    target: '#tour-adj-tabs',
    title: i18n.t('shared:inherited.evidenceForTheChange'),
    content: (
      <div className="space-y-2">
        <p>{i18n.t('shared:inherited.clickARequestToSeeThe')} <strong>{i18n.t('shared:inherited.detailedReason')}</strong> {i18n.t('shared:inherited.theEmployeeGave')}</p>
        <p className="text-xs bg-[var(--color-warning-bg)] p-2 rounded-control text-[var(--color-warning)] italic border-l-4 border-[var(--color-warning-border)]">
          {i18n.t('shared:inherited.onlyAcceptWhenTheReasonIs')}
        </p>
      </div>
    ),
    placement: 'bottom',
  },
]))

/* ─── My Adjustments Page ─── */
export const myAdjustmentsSteps = perLanguage((): Step[] => ([
  {
    target: '#tour-myadj-header',
    title: i18n.t('shared:inherited.yourRequests'),
    content: <p>{i18n.t('shared:inherited.whereTheTargetAdjustmentRequestsYou')}</p>,
    placement: 'bottom',
  },
  {
    target: '#tour-myadj-table',
    title: i18n.t('shared:inherited.trackTheHandlingDeadline'),
    content: (
      <div className="space-y-3">
        <p>{i18n.t('shared:inherited.noteEachRequestOnlyHas')} <strong>{i18n.t('shared:inherited.n24Hours')}</strong> {i18n.t('shared:inherited.forTheManagerToApprove')}</p>
        <div className="p-2 bg-[var(--color-error-bg)] border-l-4 border-[var(--color-error-border)] rounded text-xs text-[var(--color-error)] italic">
          {i18n.t('shared:inherited.ifOverdueTheRequestClosesAutomatically')}
        </div>
      </div>
    ),
    placement: 'bottom',
  },
]))

/* ─── Evaluations Page ─── */
export const evaluationsSteps = perLanguage((): Step[] => ([
  {
    target: '#tour-eval-header',
    title: i18n.t('shared:inherited.performanceResults'),
    content: (
      <div className="space-y-2">
        <p>{i18n.t('shared:inherited.thisIsTheFinalScoreSheet')}</p>
        <p className="text-xs text-[var(--color-primary)] font-medium italic">{i18n.t('shared:inherited.thisResultIsTheMostImportant')}</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-eval-filters',
    title: i18n.t('shared:inherited.historyLookup'),
    content: <p>{i18n.t('shared:inherited.easilyLookUpResultsFromMany')} <strong>{i18n.t('shared:inherited.competencyGrowthChart')}</strong> {i18n.t('shared:inherited.andEmployeesProgressOverTime')}</p>,
    placement: 'bottom',
  },
  {
    target: '#tour-eval-table',
    title: i18n.t('shared:inherited.rankingBoard'),
    content: (
      <div className="space-y-2">
        <p>{i18n.t('shared:inherited.clickEachRowToSeeThe')} <strong>{i18n.t('shared:inherited.evaluationDetails')}</strong>.</p>
        <p className="text-caption italic">{i18n.t('shared:inherited.hereYouCanCompareTheGap')}</p>
      </div>
    ),
    placement: 'bottom',
  },
]))

