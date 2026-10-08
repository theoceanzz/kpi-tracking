import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'
import { tourKit, tourTarget } from './kit'
import { KPI_CREATE_1 } from './kpi-create'
import { perLanguage } from '@/i18n/perLanguage'
import { ADJ_REVIEW, CYCLE_EVAL_DIALOGS, F360_FORM, PENDING_REVIEW, STAFF_EVAL } from './forms-performance'

/**
 * Hướng dẫn cho "Quản lý hiệu suất" — trang gộp và sáu mục bên trong.
 *
 * Bản 2 viết lại theo khuôn từng bước nhỏ (xem `kit.tsx`). Sửa chỗ bản 1 tả sai: "chốt đánh giá
 * phòng ban khoá kỳ" — kỳ chỉ khoá khi chốt đánh giá kỳ của đơn vị GỐC; dải chuỗi duyệt cũ
 * (`#tour-cycleeval-chain`) đã thay bằng dải luồng. Mục Đánh giá 360 trước đây chưa có bài.
 */

const V = 2
/** Bản 3: mục có hộp thoại nối thêm bài đi qua hộp đó (xem `forms-performance.tsx`). */
const V3 = 3
const { s, sectionCards } = tourKit('tourPerformance')

const performanceTours = perLanguage((): Record<TourKey, TourDef> => ({
  performance: { version: V, steps: sectionCards('performance') },

  // Bước cuối nối sang luồng "Tạo KPI" từng bước (xem `kpi-create.tsx`).
  'performance/kpi-criteria': {
    version: V,
    next: KPI_CREATE_1,
    steps: [
      s('criteria.stats', tourTarget('ws.stats'), 'bottom'),
      s('criteria.add', tourTarget('kpi.add'), 'left'),
      s('criteria.import', tourTarget('kpi.import'), 'bottom'),
      s('criteria.submitAi', tourTarget('kpi.submit-ai'), 'bottom'),
      s('criteria.period', tourTarget('kpi.period'), 'bottom'),
      s('criteria.type', tourTarget('kpi.type'), 'bottom'),
      s('criteria.sort', tourTarget('kpi.sort'), 'bottom'),
      s('criteria.more', tourTarget('filter.more'), 'bottom'),
      s('criteria.search', tourTarget('filter.search'), 'bottom'),
      s('criteria.view', tourTarget('filter.trailing'), 'bottom'),
      s('criteria.tabs', tourTarget('kpi.tabs'), 'bottom'),
      s('criteria.list', tourTarget('kpi.list'), 'top'),
      s('criteria.rowMenu', tourTarget('kpi.row.menu'), 'left'),
    ],
  },

  'performance/kpi-criteria-pending': {
    version: V3,
    next: PENDING_REVIEW,
    steps: [
      s('pending.stats', tourTarget('ws.stats'), 'bottom'),
      s('pending.ai', tourTarget('pending.ai'), 'left'),
      s('pending.period', tourTarget('pending.period'), 'bottom'),
      s('pending.search', tourTarget('filter.search'), 'bottom'),
      s('pending.tabs', tourTarget('pending.tabs'), 'bottom'),
      s('pending.table', tourTarget('pending.table'), 'top'),
      s('pending.personApprove', tourTarget('pending.person-approve'), 'left'),
      s('pending.view', tourTarget('pending.view'), 'left'),
      s('pending.approve', tourTarget('pending.approve'), 'left'),
      s('pending.reject', tourTarget('pending.reject'), 'left'),
      s('pending.bulk', tourTarget('pending.bulk'), 'top'),
    ],
  },

  'performance/kpi-adjustments-pending': {
    version: V3,
    next: ADJ_REVIEW,
    steps: [
      s('adj.stats', tourTarget('ws.stats'), 'bottom'),
      s('adj.ai', tourTarget('adj.ai'), 'left'),
      s('adj.period', tourTarget('adj.period'), 'bottom'),
      s('adj.tabs', tourTarget('adj.tabs'), 'bottom'),
      s('adj.table', tourTarget('adj.table'), 'top'),
      s('adj.view', tourTarget('adj.view'), 'left'),
      s('adj.approve', tourTarget('adj.approve'), 'left'),
      s('adj.reject', tourTarget('adj.reject'), 'left'),
      s('adj.bulk', tourTarget('adj.bulk'), 'top'),
    ],
  },

  'performance/submissions-org-unit': {
    version: V3,
    next: STAFF_EVAL,
    steps: [
      s('subs.stats', tourTarget('ws.stats'), 'bottom'),
      s('subs.unit', tourTarget('subs.unit'), 'bottom'),
      s('subs.period', tourTarget('subs.period'), 'bottom'),
      s('subs.search', tourTarget('filter.search'), 'bottom'),
      s('subs.aiBatch', tourTarget('subs.ai-batch'), 'bottom'),
      s('subs.aiApprove', tourTarget('subs.ai-approve'), 'bottom'),
      s('subs.aiRemind', tourTarget('subs.ai-remind'), 'bottom'),
      s('subs.table', tourTarget('subs.table'), 'top'),
      s('subs.score', tourTarget('subs.score'), 'left'),
      s('subs.viewEval', tourTarget('subs.view-eval'), 'left'),
      s('subs.next', tourTarget('subs.next'), 'top'),
    ],
  },

  'performance/cycle-evaluation': {
    version: V3,
    next: CYCLE_EVAL_DIALOGS,
    steps: [
      s('cycleeval.unit', tourTarget('cycleeval.unit'), 'bottom'),
      s('cycleeval.cycle', tourTarget('cycleeval.cycle'), 'bottom'),
      s('cycleeval.stats', tourTarget('ws.stats'), 'bottom'),
      s('cycleeval.flow', tourTarget('cycleeval.flow'), 'bottom'),
      s('cycleeval.table', tourTarget('cycleeval.table'), 'top'),
      s('cycleeval.view', tourTarget('cycleeval.view'), 'left'),
      s('cycleeval.export', tourTarget('cycleeval.export'), 'bottom'),
      s('cycleeval.send', tourTarget('cycleeval.send'), 'bottom'),
      s('cycleeval.ai', tourTarget('cycleeval.ai'), 'bottom'),
    ],
  },

  'performance/feedback360': {
    version: 2,
    next: F360_FORM,
    steps: [
      s('f360.create', tourTarget('f360.create'), 'left'),
      s('f360.filters', tourTarget('f360.filters'), 'bottom'),
      s('f360.list', tourTarget('f360.list'), 'top'),
    ],
  },
}))

export default performanceTours
