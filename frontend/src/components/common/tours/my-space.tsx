import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'
import {
  myKpiSteps,
  mySubmissionsSteps,
  evaluationsSteps,
  myAdjustmentsSteps,
} from './inherited'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Hướng dẫn cho "Của tôi" — dòng sidebar, sáu mục, và các tab của hai mục ví.
 *
 * Bốn mục công việc đã có nội dung từ hồi chúng còn là bốn dòng sidebar riêng; ở đây chỉ
 * gắn lại vào khoá ba tầng. Phần viết mới là cấp trang và hai mục ví — hai mục này trước
 * đó không có gì, dù chúng động tới điểm thưởng và tiền thật.
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

const mySpaceTours = perLanguage((): Record<TourKey, TourDef> => ({
  /* ══════════ Cấp trang ══════════ */
  'my-space': {
    steps: [
      {
        target: '#tour-settings-nav',
        title: i18n.t('shared:my_space.everythingThatIsYours'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:my_space.theGroup')} <strong>{i18n.t('shared:my_space.work')}</strong> {i18n.t('shared:my_space.isTheKpisAssignedToYou')}
            </p>
            <p>
              {i18n.t('shared:my_space.theGroup')} <strong>{i18n.t('shared:my_space.wallet')}</strong> {i18n.t('shared:my_space.isSeparateBecauseTheyAreTwo')}
            </p>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-card-my-kpi',
        title: i18n.t('shared:my_space.yourWorkLoop'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:my_space.theFourCardsOfTheWork')} <strong>{i18n.t('shared:my_space.kpis')}</strong> {i18n.t('shared:my_space.submit')}{' '}
              <strong>{i18n.t('shared:my_space.reports')}</strong> {i18n.t('shared:my_space.receive')} <strong>{i18n.t('shared:my_space.evaluations')}</strong>{i18n.t('shared:my_space.ifAKpiNoLongerFits')} <strong>{i18n.t('shared:my_space.adjustmentRequest')}</strong>.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-settings-nav',
        title: i18n.t('shared:my_space.aRedDotIsWorkWaiting'),
        content: (
          <div className="space-y-2">
            <p>{i18n.t('shared:my_space.aCardWithARedDot')}</p>
            {note(i18n.t('shared:my_space.missingACardTheWalletGroup'))}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  /* ══════════ Cụm Công việc ══════════ */
  'my-space/my-kpi': { steps: myKpiSteps() },
  'my-space/my-submissions': { steps: mySubmissionsSteps() },
  'my-space/evaluations': { steps: evaluationsSteps() },
  'my-space/my-adjustments': { steps: myAdjustmentsSteps() },

  /* ══════════ Cụm Ví ══════════ */
  'my-space/my-rewards': {
    steps: [
      {
        target: '#tour-my-rewards-balance',
        title: i18n.t('shared:my_space.yourRewardPoints'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:my_space.thisCardIsYourCurrentPoint')}
            </p>
            {note(i18n.t('shared:my_space.theFeedAboveIsTheReward'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-my-rewards-checkin',
        title: i18n.t('shared:my_space.theCheckInCardSitsOutside'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:my_space.theCheckInCardIsPlaced')} <strong>{i18n.t('shared:my_space.above')}</strong> {i18n.t('shared:my_space.theTabRowOnPurposeIf')}
            </p>
            {warn(i18n.t('shared:my_space.breakingADailyStreakLosesThe'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-workspace-tabs',
        title: i18n.t('shared:my_space.fourTabsSpendViewShowOff'),
        content: (
          <div className="space-y-2">
            <p>
              <strong>{i18n.t('shared:my_space.giftShop')}</strong> {i18n.t('shared:my_space.toRedeemPoints')} <strong>{i18n.t('shared:my_space.pointHistory')}</strong> {i18n.t('shared:my_space.toSeeWherePointsComeFrom')} <strong>{i18n.t('shared:my_space.certificates')}</strong> {i18n.t('shared:my_space.toDownloadCertificates')} <strong>{i18n.t('shared:my_space.redeemedGifts')}</strong> {i18n.t('shared:my_space.toTrackItemsWaitingToBe')}
            </p>
            {note(i18n.t('shared:my_space.theNumberOnEachTabIs'))}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'my-space/my-rewards#shop': {
    title: i18n.t('shared:my_space.giftShop'),
    steps: [
      {
        target: '#tour-gift-shop-grid',
        title: i18n.t('shared:my_space.redeemPointsForGifts'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:my_space.eachCardShowsThePointPrice')}{' '}
              <strong>{i18n.t('shared:my_space.short')}</strong>{i18n.t('shared:my_space.noMentalMathNeeded')}
            </p>
            {note(i18n.t('shared:my_space.outOfStockAndNotEnough'))}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-gift-shop-grid',
        title: i18n.t('shared:my_space.pointsAreDeductedTheMomentYou'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:my_space.clickingRedeemDeductsPointsImmediatelyBefore')}{' '}
              <strong>{i18n.t('shared:my_space.redeemedGifts')}</strong> {i18n.t('shared:my_space.waitingForThePersonInCharge')}
            </p>
            {warn(i18n.t('shared:my_space.thereIsNoRefundButtonThink'))}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'my-space/my-rewards#history': {
    title: i18n.t('shared:my_space.pointHistory'),
    steps: [
      {
        target: '#tour-my-rewards-history',
        title: i18n.t('shared:my_space.wherePointsComeFromAndGo'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:my_space.eachRowShowsTheReasonThe')}
            </p>
            {note(i18n.t('shared:my_space.longListsArePaginatedUseThe'))}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'my-space/my-rewards#certificates': {
    title: i18n.t('shared:my_space.certificates'),
    steps: [
      {
        target: '#tour-my-certificates-grid',
        title: i18n.t('shared:my_space.yourCertificates'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:my_space.notEveryRewardComesWithA')}
            </p>
            {note(i18n.t('shared:my_space.ifTheCompanyHasNotBuilt'))}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'my-space/my-rewards#redemptions': {
    title: i18n.t('shared:my_space.redeemedGifts'),
    steps: [
      {
        target: '#tour-my-rewards-redemptions',
        title: i18n.t('shared:my_space.itemsWaitingToBeReceived'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:my_space.theStatusOfEachRedemptionFrom')}
            </p>
            {note(i18n.t('shared:my_space.ifAnItemStaysPendingToo'))}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'my-space/my-cash-wallet': {
    steps: [
      {
        target: '#tour-my-wallet-balance',
        title: i18n.t('shared:my_space.thisIsMoneyNotPoints'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:my_space.theWalletHoldsYourRealCash')}
            </p>
            {warn(i18n.t('shared:my_space.conversionIsOneWayMoneyTo'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-my-wallet-topup',
        title: i18n.t('shared:my_space.topUpFromAnywhere'),
        content: (
          <p>
            {i18n.t('shared:my_space.theButton')} <strong>{i18n.t('shared:my_space.topUp')}</strong> {i18n.t('shared:my_space.inTheTopCornerIsAlways')}
          </p>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-workspace-tabs',
        title: '🗂️ Ba tab',
        content: (
          <p>
            <strong>{i18n.t('shared:my_space.convertToPoints')}</strong> {i18n.t('shared:my_space.toConvert')} <strong>{i18n.t('shared:my_space.topUpOrders')}</strong> {i18n.t('shared:my_space.toTrackTopUpsWaitingTo')} <strong>{i18n.t('shared:my_space.walletHistory')}</strong> {i18n.t('shared:my_space.toLookUpEveryMovement')}
          </p>
        ),
        placement: 'bottom',
      },
    ],
  },

  'my-space/my-cash-wallet#convert': {
    title: i18n.t('shared:my_space.convertToPoints'),
    steps: [
      {
        target: '#tour-my-wallet-convert',
        title: i18n.t('shared:my_space.convertAtTheCurrentRate'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:my_space.enterTheAmountYouWantTo')}
            </p>
            {warn(i18n.t('shared:my_space.onceConvertedItCannotBeReversed'))}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'my-space/my-cash-wallet#topups': {
    title: i18n.t('shared:my_space.topUpOrders'),
    steps: [
      {
        target: '#tour-my-wallet-topups',
        title: i18n.t('shared:my_space.topUpByBankTransfer'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:my_space.eachTopUpHasItsOwn')}
            </p>
            {warn(i18n.t('shared:my_space.ifTheTransferDescriptionIsWrong'))}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-my-wallet-topups',
        title: i18n.t('shared:my_space.theQrCodeExpires'),
        content: (
          <p>
            {i18n.t('shared:my_space.overdueOrdersAreCancelledAutomaticallyCreate')}
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'my-space/my-cash-wallet#history': {
    title: i18n.t('shared:my_space.walletHistory'),
    steps: [
      {
        target: '#tour-my-wallet-history',
        title: i18n.t('shared:my_space.everyBalanceMovement'),
        content: (
          <div className="space-y-2">
            <p>{i18n.t('shared:my_space.topUpsConversionsToPointsAnd')}</p>
            {note(i18n.t('shared:my_space.thisIsTheSourceLedgerFor'))}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'my-space/my-conduct': {
    steps: [
      {
        target: '#tour-my-conduct-target',
        title: i18n.t('shared:my_space.selfScoreConduct'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:my_space.choose')} <strong>{i18n.t('shared:my_space.onePeriod')}</strong> {i18n.t('shared:my_space.or')} <strong>{i18n.t('shared:my_space.theWholeCycle')}</strong> {i18n.t('shared:my_space.toOpenTheFormUntilYou')}
            </p>
            {note(i18n.t('shared:my_space.theFigureBoxesOnTheCard'))}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-conduct-sheet',
        title: i18n.t('shared:my_space.evidenceMattersMoreThanTheScore'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:my_space.eachCriterionHasAScoreField')} <strong>{i18n.t('shared:my_space.evidence')}</strong>{i18n.t('shared:my_space.fieldTheManagerScoresBasedOn')}
            </p>
            {note(i18n.t('shared:my_space.theWeightColumnShowsWhichCriteria'))}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-conduct-sheet-actions',
        title: i18n.t('shared:my_space.saveAndExport'),
        content: (
          <div className="space-y-2">
            <p>
              <strong>{i18n.t('shared:my_space.saveSelfAssessment')}</strong> {i18n.t('shared:my_space.savesYourPart')} <strong>{i18n.t('shared:my_space.exportExcel')}</strong> {i18n.t('shared:my_space.exportsTheWholeFormToA')}
            </p>
            {warn(i18n.t('shared:my_space.onceTheUnitHasFinalizedThe'))}
          </div>
        ),
        placement: 'top',
      },
    ],
  },
}))

export default mySpaceTours
