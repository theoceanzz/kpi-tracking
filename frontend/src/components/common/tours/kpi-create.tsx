import type { TourKey } from '@/store/tourStore'
import type { TourDef, TourStep } from './registry'
import { tourTarget } from './anchors'
import { runTourAction } from './actions'
import { waitForTarget } from './engine'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Luồng "Tạo KPI" ở mục Quản lý chỉ tiêu — ba bài nối nhau theo đúng ba chặng của form:
 *
 *   1/3 Bối cảnh       — mở form, loại chỉ tiêu, đợt, tần suất, hạn chót, đơn vị, người thực hiện
 *   2/3 Nguồn & nội dung — tự do / hạng mục BSC / KR, hai công tắc, tên, con số, trọng số, nút tạo
 *   3/3 Gửi duyệt       — tìm bản nháp, chọn, gửi (từng cái, cả loạt, hoặc nhờ K.AI), chuỗi duyệt
 *
 * Tách bài vì luồng dài hơn 15 bước, không phải để bớt chi tiết: mỗi ô của form là một bước.
 * Bài trang `performance/kpi-criteria` nối sang bài 1 (xem `performance.tsx`).
 *
 * Không đổi dữ liệu thật: form chỉ được MỞ và đổi nguồn (trạng thái giao diện), các bước mặc định
 * chặn bấm, `KpiFormModal` từ chối gửi khi có bài đang chạy, và `useFormDraft` không ghi nháp.
 */

export const KPI_CREATE_1: TourKey = 'performance/kpi-criteria+create-1'
export const KPI_CREATE_2: TourKey = 'performance/kpi-criteria+create-2'
export const KPI_CREATE_3: TourKey = 'performance/kpi-criteria+create-3'

const t = (key: string) => i18n.t(`shared:kpiCreate.${key}`)
const p = (text: string) => <p>{text}</p>

const openForm = () => runTourAction('kpi.form.open')
const closeForm = () => runTourAction('kpi.form.close')
/** Danh sách: đóng form và mở nhóm đầu tiên để thấy dòng chỉ tiêu (nhóm mặc định thu gọn). */
const listWithRows = async () => {
  await closeForm()
  await runTourAction('kpi.groups.expand')
}

/**
 * Mở form rồi mới đổi nguồn. Form tự đặt lại nguồn về "Tự do" trong effect lúc mở, nên đổi ngay
 * trong cùng nhịp sẽ bị ghi đè — chờ form có trên màn hình và effect chạy xong đã.
 */
const formWithSource = (source: 'FREE' | 'BSC' | 'OKR') => async () => {
  await openForm()
  await waitForTarget(tourTarget('kpi.form'), 3000)
  await new Promise((r) => setTimeout(r, 60))
  await runTourAction('kpi.form.source', source)
}

const field = (id: string, target: string, placement: TourStep['placement'] = 'bottom', extra: Partial<TourStep> = {}): TourStep => ({
  id,
  target,
  title: t(`${id}Title`),
  content: p(t(`${id}Body`)),
  placement,
  ...extra,
})

const kpiCreateTours = perLanguage((): Record<TourKey, TourDef> => ({
  /* ══════════ 1/3 — Mở form, chọn bối cảnh ══════════ */
  [KPI_CREATE_1]: {
    title: t('part1'),
    next: KPI_CREATE_2,
    cleanup: closeForm,
    steps: [
      { id: 'intro', target: 'body', title: t('introTitle'), content: p(t('introBody')), placement: 'center' },
      field('add', tourTarget('kpi.add'), 'bottom', { advanceOnClick: true, prepare: closeForm }),
      field('type', tourTarget('kpi.form.type'), 'bottom', { prepare: openForm }),
      field('period', tourTarget('kpi.form.period'), 'bottom', { prepare: openForm }),
      field('frequency', tourTarget('kpi.form.frequency'), 'bottom', { prepare: openForm }),
      field('deadline', tourTarget('kpi.form.deadline'), 'bottom', { prepare: openForm }),
      field('units', tourTarget('kpi.form.units'), 'top', { prepare: openForm }),
      field('assignees', tourTarget('kpi.form.assignees'), 'top', { prepare: openForm }),
      field('assigneeFilter', tourTarget('kpi.form.assignee-filter'), 'top', { prepare: openForm }),
    ],
  },

  /* ══════════ 2/3 — Nguồn và nội dung chỉ tiêu ══════════ */
  [KPI_CREATE_2]: {
    title: t('part2'),
    next: KPI_CREATE_3,
    cleanup: async () => {
      await runTourAction('kpi.form.source', 'FREE')
      await closeForm()
    },
    steps: [
      field('source', tourTarget('kpi.form.source'), 'bottom', { prepare: formWithSource('FREE') }),
      field('sourceBsc', tourTarget('kpi.form.source.bsc'), 'top', { prepare: formWithSource('BSC') }),
      field('sourceOkr', tourTarget('kpi.form.source.okr'), 'top', { prepare: formWithSource('OKR') }),
      field('reverse', tourTarget('kpi.form.reverse'), 'top', { prepare: formWithSource('FREE') }),
      field('bonus', tourTarget('kpi.form.bonus'), 'top', { prepare: formWithSource('FREE') }),
      field('name', tourTarget('kpi.form.name'), 'top', { prepare: formWithSource('FREE') }),
      field('ai', tourTarget('kpi.form.ai'), 'left', { requires: ['ORG:VIEW', 'SUBMISSION:REVIEW'], prepare: formWithSource('FREE') }),
      field('description', tourTarget('kpi.form.description'), 'top', { prepare: formWithSource('FREE') }),
      field('target', tourTarget('kpi.form.target'), 'top', { prepare: formWithSource('FREE') }),
      field('minimum', tourTarget('kpi.form.minimum'), 'top', { prepare: formWithSource('FREE') }),
      field('unit', tourTarget('kpi.form.unit'), 'top', { prepare: formWithSource('FREE') }),
      field('weight', tourTarget('kpi.form.weight'), 'top', { prepare: formWithSource('FREE') }),
      field('submit', tourTarget('kpi.form.submit'), 'top', { prepare: formWithSource('FREE') }),
    ],
  },

  /* ══════════ 3/3 — Gửi duyệt ══════════ */
  [KPI_CREATE_3]: {
    title: t('part3'),
    cleanup: async () => {
      await closeForm()
      await runTourAction('kpi.groups.restore')
    },
    steps: [
      field('tabs', tourTarget('kpi.tabs'), 'bottom', { prepare: listWithRows }),
      field('myDrafts', tourTarget('kpi.my-drafts'), 'bottom', { prepare: listWithRows }),
      field('rowSelect', tourTarget('kpi.row.select'), 'right', { prepare: listWithRows }),
      field('personSelect', tourTarget('kpi.person.select'), 'left', { prepare: listWithRows }),
      field('rowMenu', tourTarget('kpi.row.menu'), 'left', { prepare: listWithRows }),
      field('submitAi', tourTarget('kpi.submit-ai'), 'bottom', { requires: 'KPI:SUBMIT', prepare: listWithRows }),
      field('chain', tourTarget('kpi.tabs'), 'bottom', { prepare: listWithRows }),
      field('help', tourTarget('tour.help'), 'bottom', { prepare: listWithRows }),
    ],
  },
}))

export default kpiCreateTours
