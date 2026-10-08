import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'
import { tourKit, tourTarget } from './kit'
import { perLanguage } from '@/i18n/perLanguage'
import { EVAL_FORM, MY_ADJ_FORM, MY_KPI_ADJUST, REDEEM_FORM, TOPUP_FORM } from './forms-me'

/**
 * Hướng dẫn cho "Của tôi" — trang gộp, từng mục và các tab của Điểm / Ví.
 *
 * Bản 2 viết lại theo khuôn từng bước nhỏ (xem `kit.tsx`). Bản 1 nói "bốn thẻ của cụm Công việc"
 * trong khi cụm nay có tới tám thẻ tuỳ module. Ba mục OKR, BSC và Đánh giá 360 của tôi trước đây
 * chưa có bài — nay có, bản 1.
 */

const V = 2
/** Bản 3: mục có hộp thoại nối thêm bài đi qua hộp đó (xem `forms-me.tsx`). */
const V3 = 3
const { s, sectionCards } = tourKit('tourMySpace')

const mySpaceTours = perLanguage((): Record<TourKey, TourDef> => ({
  'my-space': { version: V, steps: sectionCards('my-space') },

  'my-space/my-kpi': {
    version: V3,
    next: MY_KPI_ADJUST,
    steps: [
      s('mykpi.ai', tourTarget('mykpi.ai'), 'left'),
      s('mykpi.search', tourTarget('filter.search'), 'bottom'),
      s('mykpi.view', tourTarget('filter.trailing'), 'bottom'),
      s('mykpi.table', tourTarget('mykpi.table'), 'top'),
      s('mykpi.submit', tourTarget('mykpi.submit'), 'left'),
      s('mykpi.adjust', tourTarget('mykpi.adjust'), 'left'),
      s('mykpi.selfEval', tourTarget('mykpi.self-eval'), 'left'),
    ],
  },

  'my-space/my-okr': {
    steps: [
      s('myokr.objective', tourTarget('myokr.objective'), 'top'),
      s('myokr.search', tourTarget('filter.search'), 'bottom'),
      s('myokr.analytics', tourTarget('myokr.analytics'), 'left'),
      s('myokr.manage', tourTarget('myokr.manage'), 'left'),
    ],
  },

  'my-space/my-bsc': {
    steps: [
      s('mybsc.scorecard', tourTarget('mybsc.scorecard'), 'bottom'),
      s('mybsc.perspective', tourTarget('mybsc.perspective'), 'top'),
      s('mybsc.search', tourTarget('filter.search'), 'bottom'),
      s('mybsc.analytics', tourTarget('mybsc.analytics'), 'left'),
      s('mybsc.manage', tourTarget('mybsc.manage'), 'left'),
    ],
  },

  'my-space/my-submissions': {
    version: V,
    steps: [
      s('mysub.stats', tourTarget('ws.stats'), 'bottom'),
      s('mysub.add', tourTarget('mysub.add'), 'left'),
      s('mysub.search', tourTarget('filter.search'), 'bottom'),
      s('mysub.tabs', tourTarget('mysub.tabs'), 'bottom'),
      s('mysub.drafts', tourTarget('mysub.drafts'), 'bottom'),
      s('mysub.list', tourTarget('mysub.list'), 'top'),
      s('mysub.edit', tourTarget('mysub.edit'), 'left'),
      s('mysub.send', tourTarget('mysub.send'), 'left'),
    ],
  },

  'my-space/evaluations': {
    version: V3,
    next: EVAL_FORM,
    steps: [
      s('eval.add', tourTarget('eval.add'), 'left'),
      s('eval.selfNow', tourTarget('eval.self-now'), 'bottom'),
      s('eval.period', tourTarget('eval.period'), 'bottom'),
      s('eval.table', tourTarget('eval.table'), 'top'),
      s('eval.view', tourTarget('eval.view'), 'left'),
    ],
  },

  'my-space/my-adjustments': {
    version: V3,
    next: MY_ADJ_FORM,
    steps: [
      s('myadj.add', tourTarget('myadj.add'), 'left'),
      s('myadj.list', tourTarget('myadj.list'), 'top'),
    ],
  },

  'my-space/my-conduct': {
    version: V,
    steps: [
      s('myconduct.target', tourTarget('filter.bar'), 'bottom'),
      s('myconduct.sheet', tourTarget('myconduct.sheet'), 'top'),
      s('myconduct.saveSelf', tourTarget('myconduct.save-self'), 'top'),
      s('myconduct.export', tourTarget('myconduct.export'), 'top'),
      s('myconduct.ai', tourTarget('myconduct.ai'), 'left'),
    ],
  },

  'my-space/my-feedback360': {
    steps: [
      s('myf360.waiting', tourTarget('myf360.waiting'), 'top'),
      s('myf360.done', tourTarget('myf360.done'), 'top'),
      s('myf360.reports', tourTarget('myf360.reports'), 'top'),
    ],
  },

  /* ── Điểm của tôi: mục có bốn tab ── */
  'my-space/my-rewards': {
    version: V,
    steps: [
      s('myrewards.balance', tourTarget('myrewards.balance'), 'bottom'),
      s('myrewards.checkin', tourTarget('myrewards.checkin'), 'bottom'),
      s('myrewards.tabs', tourTarget('ws.tabs'), 'bottom'),
    ],
  },
  'my-space/my-rewards#shop': {
    version: V3,
    next: REDEEM_FORM,
    steps: [
      s('myrewards.shop', tourTarget('myrewards.shop'), 'top'),
      s('myrewards.redeem', tourTarget('myrewards.redeem'), 'top'),
    ],
  },
  'my-space/my-rewards#history': {
    version: V,
    steps: [s('myrewards.history', tourTarget('myrewards.history'), 'top')],
  },
  'my-space/my-rewards#certificates': {
    version: V3,
    steps: [
      s('myrewards.certificates', tourTarget('myrewards.certificates'), 'top'),
      s('myrewards.certPrint', tourTarget('mycert.print'), 'top'),
    ],
  },
  'my-space/my-rewards#redemptions': {
    version: V3,
    steps: [
      s('myrewards.redemptions', tourTarget('myrewards.redemptions'), 'top'),
      s('myrewards.redeemView', tourTarget('myredeem.view'), 'left'),
      s('myrewards.redeemCancel', tourTarget('myredeem.cancel'), 'left'),
    ],
  },

  /* ── Ví của tôi: mục có ba tab ── */
  'my-space/my-cash-wallet': {
    version: V3,
    next: TOPUP_FORM,
    steps: [
      s('mywallet.balance', tourTarget('mywallet.balance'), 'bottom'),
      s('mywallet.topup', tourTarget('mywallet.topup'), 'left'),
      s('mywallet.tabs', tourTarget('ws.tabs'), 'bottom'),
    ],
  },
  'my-space/my-cash-wallet#convert': {
    version: V3,
    steps: [
      s('mywallet.convert', tourTarget('mywallet.convert'), 'top'),
      s('mywallet.convertRate', tourTarget('convert.rate'), 'bottom'),
      s('mywallet.convertPoints', tourTarget('convert.points'), 'bottom'),
      s('mywallet.convertCost', tourTarget('convert.cost'), 'bottom'),
      s('mywallet.convertMax', tourTarget('convert.max'), 'left'),
      s('mywallet.convertSubmit', tourTarget('convert.submit'), 'top'),
    ],
  },
  'my-space/my-cash-wallet#topups': {
    version: V3,
    steps: [
      s('mywallet.topups', tourTarget('mywallet.topups'), 'top'),
      s('mywallet.topupStatus', tourTarget('topups.status'), 'bottom'),
      s('mywallet.topupReceipt', tourTarget('topups.receipt'), 'left'),
      s('mywallet.topupResume', tourTarget('topups.resume'), 'left'),
    ],
  },
  'my-space/my-cash-wallet#history': {
    version: V3,
    steps: [
      s('mywallet.history', tourTarget('mywallet.history'), 'top'),
      s('mywallet.ledgerType', tourTarget('ledger.type'), 'bottom'),
      s('mywallet.ledgerExplain', tourTarget('ledger.explain'), 'bottom'),
    ],
  },
}))

export default mySpaceTours
