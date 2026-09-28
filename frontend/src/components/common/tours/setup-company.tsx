import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Hướng dẫn cho "Thiết lập công ty" — dòng sidebar và chín mục bên trong.
 *
 * Trước đây trang này chỉ có một bước giới thiệu lưới thẻ, cộng ba mục còn sót lại từ
 * hồi chúng là ba dòng sidebar riêng (vai trò, cơ cấu, nhân viên). Sáu mục còn lại —
 * gồm cả bốn mục hệ thống mà khách hàng ít khi tự tìm ra — không có gì.
 *
 * Về các neo dùng ở đây, xem ghi chú đầu file `setup-tools.tsx`.
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

const danger = (text: string) => (
  <p className="text-xs bg-[var(--color-error-bg)] p-2 rounded-control text-[var(--color-error)] font-medium italic border-l-4 border-[var(--color-error-border)]">
    ⛔ {text}
  </p>
)

const setupCompanyTours = perLanguage((): Record<TourKey, TourDef> => ({
  /* ══════════ Cấp trang ══════════ */
  'setup-company': {
    steps: [
      {
        target: '#tour-settings-nav',
        title: i18n.t('shared:setup_company.threeGroupsThreeQuestions'),
        content: (
          <div className="space-y-2">
            <p>
              <strong>{i18n.t('shared:setup_company.organization')}</strong> {i18n.t('shared:setup_company.whoThisCompanyIsAndHow')}{' '}
              <strong>{i18n.t('shared:setup_company.people')}</strong> {i18n.t('shared:setup_company.whoWorksWhereAndWhatThey')}{' '}
              <strong>{i18n.t('shared:setup_company.system')}</strong> {i18n.t('shared:setup_company.howTheAppTalksToEmployees')}
            </p>
            <p className="text-caption">
              {i18n.t('shared:setup_company.clickACardToOpenIt')}
            </p>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-card-info',
        title: i18n.t('shared:setup_company.n1BasicDeclarations'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_company.nameBusinessCodeThen')} <strong>{i18n.t('shared:setup_company.companyLevels')}</strong> {i18n.t('shared:setup_company.howManyTiersTheCompanyHas')}
            </p>
            {warn(i18n.t('shared:setup_company.levelsDecideTheShapeOfThe'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-card-roles',
        title: i18n.t('shared:setup_company.n2RolesStructureEmployees'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_company.thePeopleGroupHasTheRight')} <strong>{i18n.t('shared:setup_company.roles')}</strong> {i18n.t('shared:setup_company.firstBuildThe')}{' '}
              <strong>{i18n.t('shared:setup_company.unitTree')}</strong> {i18n.t('shared:setup_company.nextAndOnlyThen')} <strong>{i18n.t('shared:setup_company.addEmployees')}</strong> {i18n.t('shared:setup_company.andAssignThemToThoseTwo')}
            </p>
            {note(i18n.t('shared:setup_company.doItInTheWrongOrder'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-card-sidebar',
        title: i18n.t('shared:setup_company.n3TheGroupFewPeopleNotice'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_company.theFourSystemSectionsLetYou')} <strong>{i18n.t('shared:setup_company.renameEveryMenuItem')}</strong> {i18n.t('shared:setup_company.inYourCompanysOwnTermsChoose')}
            </p>
            <p className="text-caption">
              {i18n.t('shared:setup_company.notRequiredToRunButIt')}
            </p>
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  /* ══════════ Cụm Tổ chức ══════════ */
  'setup-company/info': {
    steps: [
      {
        target: '#tour-company-hero',
        title: i18n.t('shared:setup_company.businessProfile'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_company.theBusinessNameAndCodeAppear')} <strong>{i18n.t('shared:setup_company.editProfile')}</strong> {i18n.t('shared:setup_company.inTheRightCornerToEdit')}
            </p>
            {note(i18n.t('shared:setup_company.theLogoAndCoverImageAre'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-company-hero',
        title: i18n.t('shared:setup_company.listOfEnabledFeatures'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_company.theLastCardListsTheModules')} <strong>{i18n.t('shared:setup_company.view')}</strong>{' '}
              {i18n.t('shared:setup_company.toTurnThemOnOffGo')}
            </p>
            {note(i18n.t('shared:setup_company.someItemDisappearedFromTheMenu'))}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-company/ranks': {
    steps: [
      {
        target: '#tour-company-hierarchy',
        title: i18n.t('shared:setup_company.howManyTiersYourCompanyHas'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_company.eachRowIsATierIn')}
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-company-hierarchy',
        title: i18n.t('shared:setup_company.useYourCompanysOwnNames'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_company.theNamesYouSetHereAre')}
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-company-hierarchy',
        title: i18n.t('shared:setup_company.setEarlyChangeLate'),
        content: (
          <div className="space-y-2">
            <p>{i18n.t('shared:setup_company.addingOrRemovingATierAffects')}</p>
            {warn(i18n.t('shared:setup_company.finalizeTheLevelStructureAsSoon'))}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  /* ══════════ Cụm Con người ══════════ */
  'setup-company/roles': {
    steps: [
      {
        target: '#tour-roles-header',
        title: i18n.t('shared:setup_company.rolesAndPermissions'),
        content: (
          <div className="space-y-2">
            <p>{i18n.t('shared:setup_company.aRoleIsBothAStandardized')}</p>
            <p className="text-caption">
              {i18n.t('shared:setup_company.assign')} <strong>{i18n.t('shared:setup_company.permissions')}</strong> {i18n.t('shared:setup_company.toRolesThenAssignRolesTo')}
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-roles-hierarchy-btn',
        title: i18n.t('shared:setup_company.hierarchyChart'),
        content: (
          <p>
            {i18n.t('shared:setup_company.openTheChartToSeeThe')}
          </p>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-roles-stats',
        title: i18n.t('shared:setup_company.whoHoldsWhichRole'),
        content: <p>{i18n.t('shared:setup_company.theNumberOfPeopleAssignedTo')}</p>,
        placement: 'bottom',
      },
      {
        target: '#tour-roles-table',
        title: i18n.t('shared:setup_company.beCarefulWithPowerfulPermissions'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_company.permissionsOfThe')} <strong>{i18n.t('shared:setup_company.administration')}</strong> {i18n.t('shared:setup_company.and')} <strong>{i18n.t('shared:setup_company.approval')}</strong> {i18n.t('shared:setup_company.typeAllowInterferingWithOtherPeoples')}
            </p>
            {danger(i18n.t('shared:setup_company.doNotGrantTheFullAdministration'))}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-company/org-structure': {
    steps: [
      {
        target: '#tour-org-view-mode',
        title: i18n.t('shared:setup_company.twoWaysToViewTheSame'),
        content: (
          <div className="space-y-2">
            <p>{i18n.t('shared:setup_company.sameDataTwoViewsDependingOn')}</p>
            <ul className="text-xs space-y-1 list-disc pl-4 text-[var(--color-muted-foreground)]">
              <li><strong>{i18n.t('shared:setup_company.chart')}</strong> {i18n.t('shared:setup_company.seeTheOverallManagementFlowAnd')}</li>
              <li><strong>{i18n.t('shared:setup_company.list')}</strong> {i18n.t('shared:setup_company.findQuicklyAndEditInBulk')}</li>
            </ul>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-org-content',
        title: i18n.t('shared:setup_company.buildTheOrganization'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_company.createAUnitPlaceItUnder')} <strong>{i18n.t('shared:setup_company.thePersonInCharge')}</strong>{i18n.t('shared:setup_company.theNumberOfTiersYouMay')}
            </p>
            {warn(i18n.t('shared:setup_company.aUnitWithoutAPersonIn'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-org-content',
        title: i18n.t('shared:setup_company.thisTreeDecidesALot'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_company.thisIsNotJustAChart')}
            </p>
            {note(i18n.t('shared:setup_company.importALargeUnitTreeFrom'))}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-company/users': {
    steps: [
      {
        target: '#tour-users-header',
        title: i18n.t('shared:setup_company.allAccounts'),
        content: <p>{i18n.t('shared:setup_company.theCentralPlaceToManageEvery')}</p>,
        placement: 'bottom',
      },
      {
        target: '#tour-users-import',
        title: i18n.t('shared:setup_company.importFromExcel'),
        content: (
          <p>
            {i18n.t('shared:setup_company.forLargeStaffListsUse')} <strong>{i18n.t('shared:setup_company.importFromExcel2')}</strong> {i18n.t('shared:setup_company.insteadOfCreatingByHandDownload')}
          </p>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-users-add',
        title: i18n.t('shared:setup_company.addOneAtATime'),
        content: <p>{i18n.t('shared:setup_company.forPeopleWhoJoinAfterThe')}</p>,
        placement: 'bottom',
      },
      {
        target: '#tour-users-filters',
        title: i18n.t('shared:setup_company.searchAndFilter'),
        content: (
          <div className="space-y-2">
            <p>{i18n.t('shared:setup_company.filterByUnitRoleOrAccount')}</p>
            <p className="text-caption italic">
              {i18n.t('shared:setup_company.tipFilterByStatusToReview')}
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-users-table',
        title: i18n.t('shared:setup_company.notAssignedMeansNotUsableYet'),
        content: (
          <div className="space-y-2">
            <p>{i18n.t('shared:setup_company.clickEachPersonToCompleteTheir')}</p>
            <ul className="text-xs space-y-1 list-disc pl-4 text-[var(--color-muted-foreground)]">
              <li>{i18n.t('shared:setup_company.assignTo')} <strong>{i18n.t('shared:setup_company.unit')}</strong> {i18n.t('shared:setup_company.inTheOrganizationTree')}</li>
              <li>{i18n.t('shared:setup_company.grant')} <strong>{i18n.t('shared:setup_company.roles')}</strong> {i18n.t('shared:setup_company.thatMatchesTheirWork')}</li>
            </ul>
            {warn(i18n.t('shared:setup_company.missingEitherOfTheseThePerson'))}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  /* ══════════ Cụm Hệ thống ══════════ */
  'setup-company/sidebar': {
    steps: [
      {
        target: '#tour-sidebar-header',
        title: i18n.t('shared:setup_company.callEverythingByYourNames'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_company.renameAnyItemOnTheMenu')}
            </p>
            {note(i18n.t('shared:setup_company.theSubtitleRightUnderTheHeading'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-sidebar-header',
        title: i18n.t('shared:setup_company.searchBeforeEditingAndRememberTo'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_company.theCard')} <strong>{i18n.t('shared:setup_company.searchItems')}</strong> {i18n.t('shared:setup_company.filtersByBothTheDefaultLabels')}
              <strong> {i18n.t('shared:setup_company.saveChanges')}</strong> {i18n.t('shared:setup_company.rightNextToItAllFields')}
            </p>
            {warn(i18n.t('shared:setup_company.leavingTheScreenWithoutSavingLoses'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-sidebar-note',
        title: i18n.t('shared:setup_company.groupedByWhereTheItemAppears'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_company.theTableIsSplitIntoBlocks')} <strong>{i18n.t('shared:setup_company.navigationBar')}</strong> {i18n.t('shared:setup_company.isTheSidebarRowsAndEach')}
            </p>
            {note(i18n.t('shared:setup_company.itIsSplitThisWayBecause'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-sidebar-scope-sidebar',
        title: i18n.t('shared:setup_company.renamingDoesNotChangeFunction'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_company.eachRowShowsTheDefaultLabel')}
            </p>
            {note(i18n.t('shared:setup_company.clearingAFieldReturnsThatItem'))}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-company/notifications': {
    steps: [
      {
        target: '#tour-notif-header',
        title: i18n.t('shared:setup_company.defaultsForTheWholeOrganization'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_company.settingsHereApplyAsThe')} <strong>{i18n.t('shared:setup_company.default')}</strong> {i18n.t('shared:setup_company.forEveryEmployeeAfterEditingRemember')}
              <strong> {i18n.t('shared:setup_company.saveSettings')}</strong> {i18n.t('shared:setup_company.inTheRightCornerOfThis')}
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-notif-events',
        title: i18n.t('shared:setup_company.twoChannelsToggledIndependently'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_company.eachRowIsAnEventA')} <strong>Email</strong> {i18n.t('shared:setup_company.mailToTheInboxAnd')} <strong>{i18n.t('shared:setup_company.system')}</strong> {i18n.t('shared:setup_company.theInAppBellEachTurned')}
            </p>
            {note(i18n.t('shared:setup_company.turnOnBothForUrgentMatters'))}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-notif-events',
        title: i18n.t('shared:setup_company.mailContentIsInAnotherSection'),
        content: (
          <p>
            {i18n.t('shared:setup_company.thisDecides')} <strong>{i18n.t('shared:setup_company.whetherToSend')}</strong>{i18n.t('shared:setup_company.asFor')} <strong>{i18n.t('shared:setup_company.whatToSend')}</strong> {i18n.t('shared:setup_company.theMailSubjectAndContentThat')}
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-company/email': {
    steps: [
      {
        target: '#tour-email-list',
        title: i18n.t('shared:setup_company.mailCatalogGrouped'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_company.theLeftColumnListsEveryType')}
            </p>
          </div>
        ),
        placement: 'right',
      },
      {
        target: '#tour-email-subject',
        title: i18n.t('shared:setup_company.automaticallyFilledVariables'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_company.theSubjectAndContentUse')} <strong>{i18n.t('shared:setup_company.variables')}</strong> {i18n.t('shared:setup_company.thatAreReplacedWhenSendingThe')}
            </p>
            {warn(i18n.t('shared:setup_company.someVariablesAreRequiredWithoutThem'))}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-email-editor',
        title: i18n.t('shared:setup_company.visualEditingOrHtmlEditing'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_company.switchBetweenTheVisualEditorAnd')}
            </p>
            {note(i18n.t('shared:setup_company.inHtmlModeScriptAndIframe'))}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-email-actions',
        title: i18n.t('shared:setup_company.previewSaveOrResetToDefault'),
        content: (
          <div className="space-y-2">
            <p>
              <strong>{i18n.t('shared:setup_company.preview')}</strong> {i18n.t('shared:setup_company.rendersATrialMailWithSample')} <strong>{i18n.t('shared:setup_company.restoreDefault')}</strong>
              {i18n.t('shared:setup_company.returnsTheTemplateToTheOriginal')}
            </p>
            {warn(i18n.t('shared:setup_company.alwaysPreviewBeforeSavingSentMail'))}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-company/api': {
    steps: [
      {
        target: '#tour-lark-status',
        title: i18n.t('shared:setup_company.connectToLark'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_company.theTopStripShowsTheStatus')}
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-lark-credentials',
        title: i18n.t('shared:setup_company.followTheStepsInOrder'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_company.theStepsAreNumberedAndUnlock')} <strong>App ID</strong> {i18n.t('shared:setup_company.and')}
              <strong> App Secret</strong> {i18n.t('shared:setup_company.hereClick')} <strong>{i18n.t('shared:setup_company.checkConnection')}</strong>.
            </p>
            {note(i18n.t('shared:setup_company.thereIsAButtonInThe'))}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-lark-connect',
        title: i18n.t('shared:setup_company.linkWithYourOwnAccount'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_company.click')} <strong>{i18n.t('shared:setup_company.connectToLark2')}</strong>{i18n.t('shared:setup_company.signInOnceAndTheSystem')}
            </p>
            {warn(i18n.t('shared:setup_company.permissionsJustAddedOnLarkOnly'))}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-lark-defaults',
        title: i18n.t('shared:setup_company.unitAndRoleForNewPeople'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:setup_company.peopleSigningInFromLarkFor')}
            </p>
            {warn(i18n.t('shared:setup_company.aDefaultThatIsTooBroad'))}
          </div>
        ),
        placement: 'top',
      },
    ],
  },
}))

export default setupCompanyTours
