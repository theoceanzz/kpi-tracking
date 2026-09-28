import i18n from 'i18next'
/**
 * Câu hỏi soạn sẵn cho các nút "K.AI" trên trang nghiệp vụ.
 *
 * <p>Một chỗ giữ câu chữ, vì câu chữ là thứ đã ĐO: mỗi câu ở đây khớp (hoặc gần khớp) một ca trong
 * `backend/src/test/resources/ai-questions.json` — A27 việc cần làm, A26 biến động hạng, A25 lệch
 * tự chấm, D13 gửi duyệt nháp, D14/D17 chốt/mở đợt, D16 phân rã, E01/E04 KPI và điểm của tôi.
 * Đổi cách hỏi ở đây là đổi thứ router và tool đã được đo — sửa thì đo lại.
 *
 * <p>Tên đơn vị / kỳ truyền vào là tên HIỂN THỊ (không phải id): backend giải tên trong cây đơn vị
 * của người hỏi; id đơn vị đi riêng qua `focusUnitId` của nút.
 */

const cua = (unit?: string | null) => (unit ? i18n.t('analytics:aiShortcuts.of', { unit }) : i18n.t('analytics:aiShortcuts.ofMyUnit'))
const ky = (period?: string | null) => (period ? i18n.t('analytics:aiShortcuts.inCycle', { period }) : '')
const dot = (cycle?: string | null) => (cycle ? ` ${cycle}` : i18n.t('analytics:aiShortcuts.current'))

export const aiShortcuts = {
  // ── thao tác GHI: trợ lý dựng lời mời xác nhận, chưa ghi gì ──────────────────────────────
  reviewSubmissions: (unit?: string | null, period?: string | null) =>
    i18n.t('analytics:aiShortcuts.approvePendingSubmissions', { unit: cua(unit), period: ky(period) }),
  remindNonSubmitters: (unit?: string | null, period?: string | null) =>
    i18n.t('analytics:aiShortcuts.sendSubmissionRemindersToThoseWho', { period: ky(period), unit: cua(unit) }),
  reviewKpiCriteria: (unit?: string | null, period?: string | null) =>
    i18n.t('analytics:aiShortcuts.approveKpisPendingApproval', { unit: cua(unit), period: ky(period) }),
  reviewAdjustments: (unit?: string | null) =>
    i18n.t('analytics:aiShortcuts.approvePendingKpiAdjustmentRequests', { unit: cua(unit) }),
  submitDraftKpis: (unit?: string | null, period?: string | null) =>
    i18n.t('analytics:aiShortcuts.submitDraftKpisForApproval', { unit: cua(unit), period: ky(period) }),
  decomposeKpi: (kpiName: string) =>
    i18n.t('analytics:aiShortcuts.breakDownKpiToChildUnits', { kpiName }),
  finalizeCycle: (cycle?: string | null, unit?: string | null) =>
    i18n.t('analytics:aiShortcuts.finalizeTheEvaluationPeriod', { cycle: dot(cycle), unit: cua(unit) }),
  reopenCycle: (cycle?: string | null, unit?: string | null) =>
    i18n.t('analytics:aiShortcuts.reopenTheEvaluationPeriodForRescoring', { cycle: dot(cycle), unit: cua(unit) }),
  sendCycleResults: (cycle?: string | null, unit?: string | null) =>
    i18n.t('analytics:aiShortcuts.sendTheEvaluationPeriodResultsTo', { cycle: dot(cycle), unit: cua(unit) }),
  reviewRewardGrants: () => i18n.t('analytics:aiShortcuts.approvePendingPointRewardProposals'),

  // ── câu ĐỌC đúng trang ────────────────────────────────────────────────────────────────────
  myTasks: () => i18n.t('analytics:aiShortcuts.whatDoINeedToDo'),
  rankDelta: () => i18n.t('analytics:aiShortcuts.whichUnitsMovedUpOrDown'),
  deviation: () => i18n.t('analytics:aiShortcuts.whichUnitsSelfAssessmentDeviatedMost'),
  myKpisAndScore: () => i18n.t('analytics:aiShortcuts.whatAreMyKpisThisCycle'),
  myConduct: () => i18n.t('analytics:aiShortcuts.howIsMyConductFormThis'),

  // ── gợi ý chỉ tiêu: đi đường điền form — agent chính tra số liệu + tài liệu tổ chức rồi gọi
  //    suggest_kpi_form, người dùng nhận thẻ "Đề xuất điền form" và bấm Điền ─────────────────────
  //    Câu chữ = ca F10 của run-form-fill.js: nêu rõ "đọc tài liệu + số liệu" để planner xếp
  //    get_org_documents trước — không nêu thì gợi ý là kiến thức chung của model.
  suggestKpis: (unit?: string | null) =>
    i18n.t('analytics:aiShortcuts.readTheJobDescriptionsTheOrganizations', { value: unit ? ` ${unit}` : i18n.t('analytics:aiShortcuts.myUnit') })
    + i18n.t('analytics:aiShortcuts.thenSuggestASuitableKpiAnd'),
} as const
