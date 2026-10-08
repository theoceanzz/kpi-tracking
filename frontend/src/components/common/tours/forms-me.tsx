import type { TourKey } from '@/store/tourStore'
import type { TourDef, TourStep } from './registry'
import { clickToOpen, tourKit, tourTarget } from './kit'
import { runTourAction } from './actions'
import { isTargetVisible, waitForTarget } from './engine'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Bài đi qua các hộp thoại của "Của tôi" — nối sau bài của mục/tab (`next`).
 *
 * Hộp gắn với một dòng (điều chỉnh một KPI, đổi một món quà, tự đánh giá một đợt) mở bằng cách bấm
 * đúng nút của dòng đầu tiên (`clickToOpen`); hộp mở từ nút trên đầu trang mở bằng `useTourModal`.
 * Mọi nút gửi đều gọi `blockedByTour()` nên không có đề nghị, phiếu, đơn đổi hay lệnh nạp thật nào.
 */

export const MY_KPI_ADJUST: TourKey = 'my-space/my-kpi+adjust'
export const MY_KPI_SELF_EVAL: TourKey = 'my-space/my-kpi+self-eval'
export const MY_ADJ_FORM: TourKey = 'my-space/my-adjustments+form'
export const EVAL_FORM: TourKey = 'my-space/evaluations+form'
export const REDEEM_FORM: TourKey = 'my-space/my-rewards#shop+redeem'
export const TOPUP_FORM: TourKey = 'my-space/my-cash-wallet+topup'
/** Trang Nộp bài (/submissions/new) không nằm trên sidebar: tự báo `useTourScope('submission-new')`. */
export const NEW_SUBMISSION: TourKey = 'submission-new'

const { t, s, intro, modal } = tourKit('tourForms')

const closeMyKpi = () => runTourAction('mykpi.modals.close')
const closeMyAdj = () => runTourAction('myadj.modals.close')
const closeRedeem = () => runTourAction('myrewards.redeem.close')

/** Mở form đề nghị điều chỉnh qua hộp chọn KPI: mở hộp chọn rồi nhờ nó chọn KPI đầu tiên. */
const myAdjForm = async () => {
  if (isTargetVisible(tourTarget('adjform.dialog'))) return
  await runTourAction('myadj.picker.open')
  if (!(await waitForTarget(tourTarget('adjpicker.item'), 2500))) return
  await runTourAction('adjpicker.pickFirst')
  await waitForTarget(tourTarget('adjform.dialog'), 3000)
}

/** Các bước của form đề nghị điều chỉnh — dùng chung cho hai nơi mở nó. */
const adjustSteps = (prepare: () => Promise<void>): TourStep[] => [
  s('adjForm.note', tourTarget('adjform.note'), 'bottom', { prepare }),
  s('adjForm.mode', tourTarget('adjform.mode'), 'bottom', { prepare }),
  s('adjForm.numbers', tourTarget('adjform.numbers'), 'bottom', { prepare }),
  s('adjForm.reason', tourTarget('adjform.reason'), 'top', { prepare }),
  s('adjForm.submit', tourTarget('adjform.submit'), 'top', { prepare }),
]

/** Các bước của phiếu tự đánh giá — dùng chung cho "KPI của tôi" và "Đánh giá". */
const selfEvalSteps = (prepare: () => Promise<void>): TourStep[] => [
  s('evalForm.context', tourTarget('evalform.context'), 'bottom', { prepare }),
  s('evalForm.score', tourTarget('evalform.score'), 'top', { prepare }),
  s('evalForm.evidence', tourTarget('evalform.evidence'), 'top', { prepare }),
  s('evalForm.submit', tourTarget('evalform.submit'), 'top', { prepare }),
]

const formsMeTours = perLanguage((): Record<TourKey, TourDef> => {
  const evalForm = modal('eval.form')
  const topup = modal('mywallet.topup')
  const openKpiAdjust = clickToOpen(tourTarget('mykpi.adjust'), tourTarget('adjform.dialog'))
  const openKpiSelfEval = clickToOpen(tourTarget('mykpi.self-eval'), tourTarget('evalform.dialog'))
  const openRedeem = clickToOpen(tourTarget('myrewards.redeem'), tourTarget('redeem.dialog'))
  const openPicker = () => runTourAction('myadj.picker.open')

  return {
    [MY_KPI_ADJUST]: {
      title: t('myKpiAdjust.title'),
      next: MY_KPI_SELF_EVAL,
      cleanup: closeMyKpi,
      steps: [
        s('myKpiAdjust.open', tourTarget('mykpi.adjust'), 'left', { prepare: closeMyKpi, advanceOnClick: true }),
        s('adjForm.dialog', tourTarget('adjform.dialog'), 'auto', { prepare: openKpiAdjust }),
        ...adjustSteps(openKpiAdjust),
      ],
    },

    [MY_KPI_SELF_EVAL]: {
      title: t('myKpiSelfEval.title'),
      cleanup: closeMyKpi,
      steps: [
        s('myKpiSelfEval.open', tourTarget('mykpi.self-eval'), 'left', { prepare: closeMyKpi, advanceOnClick: true }),
        s('evalForm.dialog', tourTarget('evalform.dialog'), 'auto', { prepare: openKpiSelfEval }),
        ...selfEvalSteps(openKpiSelfEval),
      ],
    },

    [MY_ADJ_FORM]: {
      title: t('myAdjForm.title'),
      cleanup: closeMyAdj,
      steps: [
        s('myAdjForm.add', tourTarget('myadj.add'), 'left', { prepare: closeMyAdj, advanceOnClick: true }),
        s('myAdjForm.picker', tourTarget('adjpicker.dialog'), 'auto', { prepare: openPicker }),
        s('myAdjForm.search', tourTarget('adjpicker.search'), 'bottom', { prepare: openPicker }),
        s('myAdjForm.item', tourTarget('adjpicker.item'), 'bottom', { prepare: openPicker }),
        s('adjForm.dialog', tourTarget('adjform.dialog'), 'auto', { prepare: myAdjForm }),
        ...adjustSteps(myAdjForm),
      ],
    },

    [EVAL_FORM]: {
      title: t('evalFormTour.title'),
      cleanup: evalForm.close,
      steps: [
        evalForm.opener('evalFormTour.add', tourTarget('eval.add'), 'left'),
        evalForm.step('evalForm.dialog', tourTarget('evalform.dialog'), 'auto'),
        ...selfEvalSteps(evalForm.open),
      ],
    },

    [REDEEM_FORM]: {
      title: t('redeemForm.title'),
      cleanup: closeRedeem,
      steps: [
        s('redeemForm.open', tourTarget('myrewards.redeem'), 'top', { prepare: closeRedeem, advanceOnClick: true }),
        s('redeemForm.gift', tourTarget('redeem.gift'), 'bottom', { prepare: openRedeem }),
        s('redeemForm.quantity', tourTarget('redeem.quantity'), 'bottom', { prepare: openRedeem }),
        s('redeemForm.balance', tourTarget('redeem.balance'), 'top', { prepare: openRedeem }),
        s('redeemForm.notes', tourTarget('redeem.notes'), 'top', { prepare: openRedeem }),
        s('redeemForm.submit', tourTarget('redeem.submit'), 'top', { prepare: openRedeem }),
      ],
    },

    // Bài của chính trang (tự chạy lần đầu) — form nằm ngay trên trang nên không cần mở gì.
    [NEW_SUBMISSION]: {
      title: t('newSub.title'),
      steps: [
        intro('newSub.intro'),
        s('newSub.kpi', tourTarget('newsub.kpi'), 'bottom'),
        s('newSub.actual', tourTarget('newsub.actual'), 'bottom'),
        s('newSub.note', tourTarget('newsub.note'), 'top'),
        s('newSub.files', tourTarget('newsub.files'), 'top'),
        s('newSub.side', tourTarget('newsub.side'), 'left'),
        s('newSub.draft', tourTarget('newsub.draft'), 'top'),
        s('newSub.submit', tourTarget('newsub.submit'), 'top'),
      ],
    },

    [TOPUP_FORM]: {
      title: t('topupForm.title'),
      cleanup: topup.close,
      steps: [
        topup.opener('topupForm.add', tourTarget('mywallet.topup'), 'left'),
        topup.step('topupForm.dialog', tourTarget('topup.dialog'), 'auto'),
        topup.step('topupForm.amount', tourTarget('topup.amount'), 'bottom'),
        topup.step('topupForm.quick', tourTarget('topup.quick'), 'bottom'),
        topup.step('topupForm.submit', tourTarget('topup.submit'), 'top'),
      ],
    },
  }
})

export default formsMeTours
