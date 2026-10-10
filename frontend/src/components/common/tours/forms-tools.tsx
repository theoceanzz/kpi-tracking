import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'
import { tourKit, tourTarget } from './kit'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Bài đi qua từng ô của các modal trong "Thiết lập công cụ" — nối sau bài của mục/tab (`next`).
 * Khuôn như `forms-company.tsx`: mở bằng `useTourModal`, không gửi (`blockedByTour`), `cleanup` đóng.
 */

export const CYCLES_FORM: TourKey = 'setup-tools/kpi-cycles#cycles+form'
export const PERIODS_FORM: TourKey = 'setup-tools/kpi-cycles#periods+form'
export const OKR_OBJECTIVE_FORM: TourKey = 'setup-tools/okr+objective'
export const OKR_KR_FORM: TourKey = 'setup-tools/okr+kr'
export const BSC_FORM: TourKey = 'setup-tools/bsc+form'
export const AWARD_FORM: TourKey = 'setup-tools/rewards#grants+form'
export const BUDGET_FORM: TourKey = 'setup-tools/rewards#budgets+form'
export const PROGRAM_FORM: TourKey = 'setup-tools/rewards#programs+form'
export const GIFT_FORM: TourKey = 'setup-tools/rewards#gifts+form'
export const CERTIFICATE_FORM: TourKey = 'setup-tools/rewards#certificates+form'

const { t, modal } = tourKit('tourForms')

const formsToolsTours = perLanguage((): Record<TourKey, TourDef> => {
  const cycle = modal('cycles.form')
  const period = modal('periods.form')
  const objective = modal('okr.objective')
  const kr = modal('okr.kr')
  const bsc = modal('bsc.form')
  const award = modal('rewards.award')
  const budget = modal('rewards.budget')
  const program = modal('rewards.program')
  const gift = modal('rewards.gift')
  const cert = modal('rewards.certificate')

  return {
    [CYCLES_FORM]: {
      title: t('cycleForm.title'),
      cleanup: cycle.close,
      steps: [
        cycle.opener('cycleForm.add', tourTarget('cycles.add'), 'left'),
        cycle.step('cycleForm.form', tourTarget('cycles.form'), 'right'),
        cycle.step('cycleForm.mode', tourTarget('cycles.form.mode'), 'right'),
        cycle.step('cycleForm.name', tourTarget('cycles.form.name'), 'right'),
        cycle.step('cycleForm.type', tourTarget('cycles.form.type'), 'right'),
        cycle.step('cycleForm.evalMode', tourTarget('cycles.form.eval-mode'), 'right'),
        cycle.step('cycleForm.dates', tourTarget('cycles.form.dates'), 'right'),
        cycle.step('cycleForm.periods', tourTarget('cycles.form.periods'), 'right'),
        cycle.step('cycleForm.description', tourTarget('cycles.form.description'), 'right'),
        cycle.step('cycleForm.submit', tourTarget('cycles.form.submit'), 'top'),
      ],
    },

    [PERIODS_FORM]: {
      title: t('periodForm.title'),
      cleanup: period.close,
      steps: [
        period.opener('periodForm.add', tourTarget('periods.add'), 'left'),
        period.step('periodForm.form', tourTarget('periods.form'), 'right'),
        period.step('periodForm.name', tourTarget('periods.form.name'), 'right'),
        period.step('periodForm.type', tourTarget('periods.form.type'), 'right'),
        period.step('periodForm.cycle', tourTarget('periods.form.cycle'), 'right'),
        period.step('periodForm.dates', tourTarget('periods.form.dates'), 'right'),
        period.step('periodForm.reminder', tourTarget('periods.form.reminder'), 'right'),
        period.step('periodForm.submit', tourTarget('periods.form.submit'), 'top'),
      ],
    },

    [OKR_OBJECTIVE_FORM]: {
      title: t('objectiveForm.title'),
      next: OKR_KR_FORM,
      cleanup: objective.close,
      steps: [
        objective.opener('objectiveForm.add', tourTarget('okr.add'), 'left'),
        objective.step('objectiveForm.form', tourTarget('okr.form'), 'right'),
        objective.step('objectiveForm.name', tourTarget('okr.form.name'), 'bottom'),
        objective.step('objectiveForm.description', tourTarget('okr.form.description'), 'bottom'),
        objective.step('objectiveForm.dates', tourTarget('okr.form.dates'), 'bottom'),
        objective.step('objectiveForm.units', tourTarget('okr.form.units'), 'top'),
        objective.step('objectiveForm.status', tourTarget('okr.form.status'), 'top'),
        objective.step('objectiveForm.bsc', tourTarget('okr.form.bsc'), 'top'),
        objective.step('objectiveForm.submit', tourTarget('okr.form.submit'), 'top'),
      ],
    },

    // Mở form KR của mục tiêu đầu danh sách; chưa có mục tiêu thì các bước trong form tự rơi.
    [OKR_KR_FORM]: {
      title: t('krForm.title'),
      cleanup: kr.close,
      steps: [
        kr.opener('krForm.add', tourTarget('okr.add-kr'), 'top'),
        kr.step('krForm.form', tourTarget('kr.form'), 'right'),
        kr.step('krForm.name', tourTarget('kr.form.name'), 'bottom'),
        kr.step('krForm.description', tourTarget('kr.form.description'), 'bottom'),
        kr.step('krForm.numbers', tourTarget('kr.form.numbers'), 'top'),
        kr.step('krForm.allocation', tourTarget('kr.form.allocation'), 'top'),
        kr.step('krForm.submit', tourTarget('kr.form.submit'), 'top'),
      ],
    },

    [BSC_FORM]: {
      title: t('bscForm.title'),
      cleanup: bsc.close,
      steps: [
        bsc.opener('bscForm.add', tourTarget('bsc.add'), 'left'),
        bsc.step('bscForm.name', tourTarget('bsc.form.name'), 'bottom'),
        bsc.step('bscForm.applyScope', tourTarget('bsc.form.apply-scope'), 'bottom'),
        bsc.step('bscForm.periods', tourTarget('bsc.form.periods'), 'bottom'),
        bsc.step('bscForm.scope', tourTarget('bsc.form.scope'), 'bottom'),
        bsc.step('bscForm.vision', tourTarget('bsc.form.vision'), 'bottom'),
        bsc.step('bscForm.emptyPolicy', tourTarget('bsc.form.empty-policy'), 'top'),
        bsc.step('bscForm.items', tourTarget('bsc.form.items'), 'top'),
        bsc.step('bscForm.split', tourTarget('bsc.form.split'), 'left'),
        bsc.step('bscForm.area', tourTarget('bsc.form.area'), 'top'),
        bsc.step('bscForm.addItem', tourTarget('bsc.form.add-item'), 'left'),
        bsc.step('bscForm.rowToggle', tourTarget('bsc.form.row-toggle'), 'right'),
        bsc.step('bscForm.rowWeight', tourTarget('bsc.form.row-weight'), 'left'),
        bsc.step('bscForm.submit', tourTarget('bsc.form.submit'), 'top'),
      ],
    },

    [AWARD_FORM]: {
      title: t('awardForm.title'),
      cleanup: award.close,
      steps: [
        award.opener('awardForm.add', tourTarget('grants.award'), 'left'),
        award.step('awardForm.form', tourTarget('award.form'), 'right'),
        award.step('awardForm.budget', tourTarget('award.form.budget'), 'bottom'),
        award.step('awardForm.people', tourTarget('award.form.people'), 'bottom'),
        award.step('awardForm.points', tourTarget('award.form.points'), 'top'),
        award.step('awardForm.reason', tourTarget('award.form.reason'), 'top'),
        award.step('awardForm.certificate', tourTarget('award.form.certificate'), 'top'),
        award.step('awardForm.submit', tourTarget('award.form.submit'), 'top'),
      ],
    },

    [BUDGET_FORM]: {
      title: t('budgetForm.title'),
      cleanup: budget.close,
      steps: [
        budget.opener('budgetForm.add', tourTarget('budgets.add'), 'left'),
        budget.step('budgetForm.form', tourTarget('budget.form'), 'right'),
        budget.step('budgetForm.recipient', tourTarget('budget.form.recipient'), 'right'),
        budget.step('budgetForm.scope', tourTarget('budget.form.scope'), 'right'),
        budget.step('budgetForm.total', tourTarget('budget.form.total'), 'right'),
        budget.step('budgetForm.max', tourTarget('budget.form.max'), 'left'),
        budget.step('budgetForm.notes', tourTarget('budget.form.notes'), 'right'),
        budget.step('budgetForm.submit', tourTarget('budget.form.submit'), 'top'),
      ],
    },

    [PROGRAM_FORM]: {
      title: t('programForm.title'),
      cleanup: program.close,
      steps: [
        program.opener('programForm.add', tourTarget('programs.add'), 'left'),
        program.step('programForm.form', tourTarget('program.form'), 'right'),
        program.step('programForm.name', tourTarget('program.form.name'), 'right'),
        program.step('programForm.applies', tourTarget('program.form.applies'), 'right'),
        program.step('programForm.ranking', tourTarget('program.form.ranking'), 'right'),
        program.step('programForm.units', tourTarget('program.form.units'), 'right'),
        program.step('programForm.tiers', tourTarget('program.form.tiers'), 'right'),
        program.step('programForm.tie', tourTarget('program.form.tie'), 'right'),
        program.step('programForm.auto', tourTarget('program.form.auto'), 'right'),
        program.step('programForm.submit', tourTarget('program.form.submit'), 'top'),
      ],
    },

    [GIFT_FORM]: {
      title: t('giftForm.title'),
      cleanup: gift.close,
      steps: [
        gift.opener('giftForm.add', tourTarget('gifts.add'), 'left'),
        gift.step('giftForm.form', tourTarget('gift.form'), 'right'),
        gift.step('giftForm.image', tourTarget('gift.form.image'), 'right'),
        gift.step('giftForm.name', tourTarget('gift.form.name'), 'right'),
        gift.step('giftForm.points', tourTarget('gift.form.points'), 'right'),
        gift.step('giftForm.delivery', tourTarget('gift.form.delivery'), 'right'),
        gift.step('giftForm.submit', tourTarget('gift.form.submit'), 'top'),
      ],
    },

    // Hộp thoại toàn màn hình: không có bước "cả hộp", đi thẳng từng khối.
    [CERTIFICATE_FORM]: {
      title: t('certificateForm.title'),
      cleanup: cert.close,
      steps: [
        cert.opener('certificateForm.add', tourTarget('cert.add'), 'left'),
        cert.step('certificateForm.name', tourTarget('cert.form.name'), 'bottom'),
        cert.step('certificateForm.style', tourTarget('cert.form.style'), 'bottom'),
        cert.step('certificateForm.paper', tourTarget('cert.form.paper'), 'bottom'),
        cert.step('certificateForm.content', tourTarget('cert.form.content'), 'right'),
        cert.step('certificateForm.signer', tourTarget('cert.form.signer'), 'right'),
        cert.step('certificateForm.colors', tourTarget('cert.form.colors'), 'right'),
        cert.step('certificateForm.flags', tourTarget('cert.form.flags'), 'right'),
        cert.step('certificateForm.preview', tourTarget('cert.form.preview'), 'left'),
        cert.step('certificateForm.submit', tourTarget('cert.form.submit'), 'top'),
      ],
    },
  }
})

export default formsToolsTours
