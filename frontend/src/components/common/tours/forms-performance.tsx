import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'
import { tourKit, tourTarget } from './kit'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Bài đi qua các hộp thoại của "Quản lý hiệu suất" — nối sau bài của mục (`next`).
 *
 * Hộp duyệt / chấm mở theo DÒNG ĐẦU của danh sách (cần có dữ liệu): danh sách trống thì các bước
 * trong hộp tự rơi. Mọi nút duyệt, trả lại, chốt, gửi đều gọi `blockedByTour()` nên không đổi gì thật.
 */

export const PENDING_REVIEW: TourKey = 'performance/kpi-criteria-pending+review'
export const ADJ_REVIEW: TourKey = 'performance/kpi-adjustments-pending+review'
export const STAFF_EVAL: TourKey = 'performance/submissions-org-unit+score'
export const CYCLE_EVAL_DIALOGS: TourKey = 'performance/cycle-evaluation+dialogs'
export const F360_FORM: TourKey = 'performance/feedback360+form'

const { t, modal } = tourKit('tourForms')

const formsPerformanceTours = perLanguage((): Record<TourKey, TourDef> => {
  const review = modal('pending.review')
  const adj = modal('adj.review')
  const staff = modal('subs.staffEval')
  const unitScore = modal('cycleeval.unitScore')
  const finalize = modal('cycleeval.finalize')
  const send = modal('cycleeval.sendDialog')
  const f360 = modal('f360.form')

  return {
    [PENDING_REVIEW]: {
      title: t('reviewKpi.title'),
      cleanup: review.close,
      steps: [
        review.step('reviewKpi.dialog', tourTarget('review.dialog'), 'auto'),
        review.step('reviewKpi.facts', tourTarget('review.facts'), 'bottom'),
        review.step('reviewKpi.assignees', tourTarget('review.assignees'), 'top'),
        review.step('reviewKpi.chain', tourTarget('review.chain'), 'top'),
        review.step('reviewKpi.reject', tourTarget('review.reject'), 'top'),
        review.step('reviewKpi.approve', tourTarget('review.approve'), 'top'),
      ],
    },

    [ADJ_REVIEW]: {
      title: t('reviewAdj.title'),
      cleanup: adj.close,
      steps: [
        adj.step('reviewAdj.dialog', tourTarget('adjreview.dialog'), 'auto'),
        adj.step('reviewAdj.reason', tourTarget('adjreview.reason'), 'bottom'),
        adj.step('reviewAdj.compare', tourTarget('adjreview.compare'), 'bottom'),
        adj.step('reviewAdj.reject', tourTarget('adjreview.reject'), 'top'),
        adj.step('reviewAdj.approve', tourTarget('adjreview.approve'), 'top'),
      ],
    },

    [STAFF_EVAL]: {
      title: t('staffEval.title'),
      cleanup: staff.close,
      steps: [
        staff.step('staffEval.dialog', tourTarget('staffeval.dialog'), 'auto'),
        staff.step('staffEval.kpis', tourTarget('staffeval.kpis'), 'top'),
        staff.step('staffEval.score', tourTarget('staffeval.score'), 'top'),
        staff.step('staffEval.comments', tourTarget('staffeval.comments'), 'top'),
        staff.step('staffEval.submit', tourTarget('staffeval.submit'), 'top'),
      ],
    },

    // Ba hộp mở từ dải bước: chấm điểm phòng → chốt kết quả → gửi kết quả cho nhân viên.
    [CYCLE_EVAL_DIALOGS]: {
      title: t('cycleEval.title'),
      cleanup: async () => {
        await unitScore.close()
        await finalize.close()
        await send.close()
      },
      steps: [
        unitScore.step('cycleEval.unitScore', tourTarget('unitscore.dialog'), 'auto'),
        unitScore.step('cycleEval.unitSummary', tourTarget('unitscore.summary'), 'bottom'),
        unitScore.step('cycleEval.unitManual', tourTarget('unitscore.manual'), 'bottom'),
        unitScore.step('cycleEval.unitSlider', tourTarget('unitscore.slider'), 'bottom'),
        unitScore.step('cycleEval.unitSave', tourTarget('unitscore.save'), 'top'),
        finalize.step('cycleEval.finalize', tourTarget('finalize.summary'), 'bottom'),
        finalize.step('cycleEval.finalizeComment', tourTarget('finalize.comment'), 'top'),
        finalize.step('cycleEval.finalizeUnfinished', tourTarget('finalize.unfinished'), 'top'),
        finalize.step('cycleEval.finalizeConfirm', tourTarget('finalize.confirm'), 'top'),
        send.step('cycleEval.send', tourTarget('send.picker'), 'bottom'),
        send.step('cycleEval.sendList', tourTarget('send.list'), 'top'),
        send.step('cycleEval.sendSubmit', tourTarget('send.submit'), 'top'),
      ],
    },

    [F360_FORM]: {
      title: t('f360Form.title'),
      cleanup: f360.close,
      steps: [
        f360.opener('f360Form.add', tourTarget('f360.create'), 'left'),
        f360.step('f360Form.name', tourTarget('f360.form.name'), 'bottom'),
        f360.step('f360Form.purpose', tourTarget('f360.form.purpose'), 'bottom'),
        f360.step('f360Form.cycle', tourTarget('f360.form.cycle'), 'bottom'),
        f360.step('f360Form.window', tourTarget('f360.form.window'), 'bottom'),
        f360.step('f360Form.description', tourTarget('f360.form.description'), 'top'),
        f360.step('f360Form.questions', tourTarget('f360.form.questions'), 'top'),
        f360.step('f360Form.process', tourTarget('f360.form.process'), 'top'),
        f360.step('f360Form.advanced', tourTarget('f360.form.advanced'), 'top'),
        f360.step('f360Form.submit', tourTarget('f360.form.submit'), 'top'),
      ],
    },
  }
})

export default formsPerformanceTours
