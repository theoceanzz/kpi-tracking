import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'
import { tourKit, tourTarget } from './kit'
import { perLanguage } from '@/i18n/perLanguage'
import { AWARD_FORM, BSC_FORM, BUDGET_FORM, CERTIFICATE_FORM, CYCLES_FORM, GIFT_FORM, OKR_OBJECTIVE_FORM, PERIODS_FORM, PROGRAM_FORM } from './forms-tools'

/**
 * Hướng dẫn cho "Thiết lập công cụ" — trang gộp, từng mục, và từng tab trong mục.
 *
 * Bản 2 viết lại theo khuôn từng bước nhỏ (xem `kit.tsx`). Sửa luôn chỗ bản 1 tả sai: trang kỳ/đợt
 * không có thao tác "đóng đợt để chốt số" — kỳ chỉ khoá khi chốt đánh giá kỳ của đơn vị gốc. Hai
 * mục Quy tắc sinh mã và Rà soát AI trước đây chưa có bài — nay có, bản 1.
 */

const V = 2
/** Bản 3: mục/tab có modal nối thêm bài đi qua từng ô của modal (xem `forms-tools.tsx`). */
const V3 = 3
const { s, sectionCards } = tourKit('tourSetupTools')

const setupToolsTours = perLanguage((): Record<TourKey, TourDef> => ({
  'setup-tools': { version: V, steps: sectionCards('setup-tools') },

  'setup-tools/modules': {
    version: V,
    steps: [
      s('modules.list', tourTarget('modules.list'), 'top'),
      s('modules.switch', tourTarget('modules.switch'), 'left'),
      s('modules.details', tourTarget('modules.details'), 'left'),
    ],
  },

  /* ── Thang điểm: mục có ba tab ── */
  'setup-tools/scoring': {
    version: V,
    steps: [s('scoring.tabs', tourTarget('ws.tabs'), 'bottom')],
  },
  'setup-tools/scoring#quantitative': {
    version: V,
    steps: [
      s('quant.edit', tourTarget('scoring.edit'), 'left'),
      s('quant.reset', tourTarget('scoring.reset'), 'left'),
      s('quant.max', tourTarget('scoring.max'), 'bottom'),
      s('quant.levels', tourTarget('scoring.levels'), 'top'),
    ],
  },
  'setup-tools/scoring#qualitative': {
    version: V,
    steps: [
      s('qual.edit', tourTarget('qual.edit'), 'left'),
      s('qual.reset', tourTarget('qual.reset'), 'left'),
      s('qual.guide', tourTarget('qual.guide'), 'bottom'),
      s('qual.levels', tourTarget('qual.levels'), 'top'),
    ],
  },
  'setup-tools/scoring#conduct': {
    version: V,
    steps: [
      s('conduct.sets', tourTarget('conduct.sets'), 'top'),
      s('conduct.groups', tourTarget('conduct.groups'), 'left'),
      s('conduct.addSet', tourTarget('conduct.add-set'), 'top'),
      s('conduct.help', tourTarget('conduct.help'), 'left'),
      s('conduct.reset', tourTarget('conduct.reset'), 'left'),
    ],
  },

  'setup-tools/matrix': {
    version: V,
    steps: [
      s('matrix.guide', tourTarget('matrix.guide'), 'bottom'),
      s('matrix.table', tourTarget('matrix.table'), 'top'),
      s('matrix.edit', tourTarget('matrix.edit'), 'left'),
      s('matrix.reset', tourTarget('matrix.reset'), 'left'),
    ],
  },

  'setup-tools/unit-class': {
    version: V,
    steps: [
      s('unitclass.levels', tourTarget('unitclass.levels'), 'bottom'),
      s('unitclass.profiles', tourTarget('unitclass.profiles'), 'right'),
      s('unitclass.add', tourTarget('unitclass.add'), 'right'),
      s('unitclass.which', tourTarget('unitclass.which'), 'top'),
      s('unitclass.help', tourTarget('unitclass.help'), 'left'),
      s('unitclass.reset', tourTarget('unitclass.reset'), 'left'),
      s('unitclass.save', tourTarget('unitclass.save'), 'left'),
    ],
  },

  'setup-tools/code-rules': {
    steps: [
      s('coderules.section', tourTarget('coderules.section'), 'top'),
      s('coderules.auto', tourTarget('coderules.auto'), 'left'),
      s('coderules.manual', tourTarget('coderules.manual'), 'left'),
      s('coderules.token', tourTarget('coderules.token'), 'top'),
      s('coderules.save', tourTarget('coderules.save'), 'left'),
    ],
  },

  /* ── Kỳ / đợt: mục có hai tab ── */
  'setup-tools/kpi-cycles': {
    version: V,
    steps: [s('kpiCycles.tabs', tourTarget('ws.tabs'), 'bottom')],
  },
  'setup-tools/kpi-cycles#cycles': {
    version: V3,
    next: CYCLES_FORM,
    steps: [
      s('cycles.stats', tourTarget('ws.stats'), 'bottom'),
      s('cycles.add', tourTarget('cycles.add'), 'left'),
      s('cycles.search', tourTarget('filter.search'), 'bottom'),
      s('cycles.more', tourTarget('filter.more'), 'bottom'),
      s('cycles.table', tourTarget('cycles.table'), 'top'),
      s('cycles.edit', tourTarget('cycles.edit'), 'left'),
      s('cycles.history', tourTarget('cycles.history'), 'left'),
    ],
  },
  'setup-tools/kpi-cycles#periods': {
    version: V3,
    next: PERIODS_FORM,
    steps: [
      s('periods.stats', tourTarget('ws.stats'), 'bottom'),
      s('periods.add', tourTarget('periods.add'), 'left'),
      s('periods.search', tourTarget('filter.search'), 'bottom'),
      s('periods.table', tourTarget('periods.table'), 'top'),
      s('periods.edit', tourTarget('periods.edit'), 'left'),
      s('periods.delete', tourTarget('periods.delete'), 'left'),
    ],
  },

  'setup-tools/okr': {
    version: V3,
    next: OKR_OBJECTIVE_FORM,
    steps: [
      s('okr.add', tourTarget('okr.add'), 'left'),
      s('okr.list', tourTarget('okr.list'), 'top'),
      s('okr.addKr', tourTarget('okr.add-kr'), 'top'),
      s('okr.edit', tourTarget('okr.edit'), 'left'),
      s('okr.import', tourTarget('okr.import'), 'left'),
    ],
  },

  'setup-tools/bsc': {
    version: V3,
    next: BSC_FORM,
    steps: [
      s('bsc.tree', tourTarget('bsc.tree'), 'top'),
      s('bsc.card', tourTarget('bsc.card'), 'bottom'),
      s('bsc.add', tourTarget('bsc.add'), 'left'),
      s('bsc.import', tourTarget('bsc.import'), 'left'),
      s('bsc.policy', tourTarget('bsc.policy'), 'left'),
    ],
  },

  /* ── Quản lý thưởng: mục có bảy tab ── */
  'setup-tools/rewards': {
    version: V,
    steps: [s('rewards.tabs', tourTarget('ws.tabs'), 'bottom')],
  },
  'setup-tools/rewards#grants': {
    version: V3,
    next: AWARD_FORM,
    steps: [
      s('grants.filters', tourTarget('grants.filters'), 'bottom'),
      s('grants.award', tourTarget('grants.award'), 'left'),
      s('grants.ai', tourTarget('grants.ai'), 'left'),
      s('grants.table', tourTarget('data.table'), 'top'),
    ],
  },
  'setup-tools/rewards#budgets': {
    version: V3,
    next: BUDGET_FORM,
    steps: [
      s('budgets.note', tourTarget('budgets.note'), 'bottom'),
      s('budgets.add', tourTarget('budgets.add'), 'left'),
      s('budgets.table', tourTarget('data.table'), 'top'),
    ],
  },
  'setup-tools/rewards#programs': {
    version: V3,
    next: PROGRAM_FORM,
    steps: [
      s('programs.note', tourTarget('programs.note'), 'bottom'),
      s('programs.add', tourTarget('programs.add'), 'left'),
      s('programs.table', tourTarget('data.table'), 'top'),
      s('programs.run', tourTarget('programs.run'), 'left'),
    ],
  },
  'setup-tools/rewards#checkin': {
    version: V,
    steps: [
      s('checkin.note', tourTarget('checkin.note'), 'bottom'),
      s('checkin.stats', tourTarget('checkin.stats'), 'bottom'),
      s('checkin.form', tourTarget('checkin.form'), 'top'),
      s('checkin.milestones', tourTarget('checkin.milestones'), 'top'),
      s('checkin.save', tourTarget('checkin.save'), 'top'),
    ],
  },
  'setup-tools/rewards#certificates': {
    version: V3,
    next: CERTIFICATE_FORM,
    steps: [
      s('cert.intro', tourTarget('cert.intro'), 'bottom'),
      s('cert.add', tourTarget('cert.add'), 'left'),
      s('cert.edit', tourTarget('cert.edit'), 'left'),
    ],
  },
  'setup-tools/rewards#gifts': {
    version: V3,
    next: GIFT_FORM,
    steps: [
      s('gifts.add', tourTarget('gifts.add'), 'left'),
      s('gifts.urbox', tourTarget('gifts.urbox'), 'left'),
      s('gifts.table', tourTarget('data.table'), 'top'),
    ],
  },
  'setup-tools/rewards#redemptions': {
    version: V,
    steps: [
      s('redemptions.filters', tourTarget('redemptions.filters'), 'bottom'),
      s('redemptions.table', tourTarget('data.table'), 'top'),
      s('redemptions.retry', tourTarget('redemptions.retry'), 'left'),
      s('redemptions.reject', tourTarget('redemptions.reject'), 'left'),
    ],
  },

  /* ── Quản lý ví: mục có ba tab ── */
  'setup-tools/wallet': {
    version: V,
    steps: [s('wallet.tabs', tourTarget('ws.tabs'), 'bottom')],
  },
  'setup-tools/wallet#wallets': {
    version: V,
    steps: [
      s('cashwallets.stats', tourTarget('cashwallets.stats'), 'bottom'),
      s('cashwallets.filters', tourTarget('cashwallets.filters'), 'bottom'),
      s('cashwallets.table', tourTarget('cashwallets.table'), 'top'),
    ],
  },
  'setup-tools/wallet#config': {
    version: V,
    steps: [
      s('walletcfg.bank', tourTarget('wallet.bank'), 'right'),
      s('walletcfg.rate', tourTarget('wallet.rate'), 'right'),
      s('walletcfg.limits', tourTarget('wallet.limits'), 'right'),
      s('walletcfg.receipt', tourTarget('wallet.receipt'), 'right'),
      s('walletcfg.status', tourTarget('wallet.status'), 'left'),
      s('walletcfg.preview', tourTarget('wallet.preview'), 'left'),
      s('walletcfg.sepay', tourTarget('wallet.sepay'), 'left'),
      s('walletcfg.save', tourTarget('wallet.save'), 'top'),
    ],
  },
  'setup-tools/wallet#reconcile': {
    version: V,
    steps: [
      s('sepay.status', tourTarget('sepay.status'), 'bottom'),
      s('sepay.scope', tourTarget('sepay.scope'), 'bottom'),
      s('sepay.table', tourTarget('sepay.table'), 'top'),
      s('sepay.handle', tourTarget('sepay.handle'), 'left'),
    ],
  },

  'setup-tools/ai-quota': {
    version: V,
    steps: [
      s('aiquota.mine', tourTarget('aiquota.mine'), 'bottom'),
      s('aiquota.pool', tourTarget('aiquota.pool'), 'bottom'),
      s('aiquota.delegation', tourTarget('aiquota.delegation'), 'bottom'),
      s('aiquota.people', tourTarget('aiquota.people'), 'top'),
    ],
  },

  'setup-tools/ai-review': {
    steps: [
      s('aireview.settings', tourTarget('aireview.settings'), 'bottom'),
      s('aireview.toggle', tourTarget('aireview.toggle'), 'left'),
      s('aireview.weights', tourTarget('aireview.weights'), 'top'),
      s('aireview.save', tourTarget('aireview.save'), 'top'),
      s('aireview.criteria', tourTarget('aicriteria.section'), 'top'),
      s('aireview.upload', tourTarget('aicriteria.upload'), 'top'),
      s('aireview.report', tourTarget('aireport.section'), 'top'),
    ],
  },
}))

export default setupToolsTours
