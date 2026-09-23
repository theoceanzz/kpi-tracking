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

const cua = (unit?: string | null) => (unit ? ` của ${unit}` : ' của đơn vị tôi')
const ky = (period?: string | null) => (period ? ` kỳ ${period}` : '')
const dot = (cycle?: string | null) => (cycle ? ` ${cycle}` : ' hiện tại')

export const aiShortcuts = {
  // ── thao tác GHI: trợ lý dựng lời mời xác nhận, chưa ghi gì ──────────────────────────────
  reviewSubmissions: (unit?: string | null, period?: string | null) =>
    `Duyệt các bài nộp đang chờ${cua(unit)}${ky(period)}`,
  remindNonSubmitters: (unit?: string | null, period?: string | null) =>
    `Gửi nhắc nộp cho những người chưa nộp báo cáo${ky(period)}${cua(unit)}`,
  reviewKpiCriteria: (unit?: string | null, period?: string | null) =>
    `Duyệt các chỉ tiêu đang chờ phê duyệt${cua(unit)}${ky(period)}`,
  reviewAdjustments: (unit?: string | null) =>
    `Duyệt các yêu cầu điều chỉnh chỉ tiêu đang chờ${cua(unit)}`,
  submitDraftKpis: (unit?: string | null, period?: string | null) =>
    `Gửi duyệt các KPI nháp${cua(unit)}${ky(period)}`,
  decomposeKpi: (kpiName: string) =>
    `Phân rã chỉ tiêu "${kpiName}" xuống các đơn vị con theo tỉ lệ nhân sự`,
  finalizeCycle: (cycle?: string | null, unit?: string | null) =>
    `Chốt đợt đánh giá${dot(cycle)}${cua(unit)}`,
  reopenCycle: (cycle?: string | null, unit?: string | null) =>
    `Mở lại đợt đánh giá${dot(cycle)}${cua(unit)} để chấm lại`,
  sendCycleResults: (cycle?: string | null, unit?: string | null) =>
    `Gửi kết quả đợt đánh giá${dot(cycle)}${cua(unit)} cho nhân viên`,
  reviewRewardGrants: () => 'Duyệt các đề xuất thưởng điểm đang chờ',

  // ── câu ĐỌC đúng trang ────────────────────────────────────────────────────────────────────
  myTasks: () => 'Hôm nay tôi cần làm gì?',
  rankDelta: () => 'Đơn vị nào lên hạng hay tụt hạng so với đợt đánh giá trước?',
  deviation: () => 'Đơn vị nào tự chấm lệch với điểm quản lý chấm nhiều nhất trong đợt vừa rồi?',
  myKpisAndScore: () => 'KPI của tôi kỳ này gồm những gì và tôi dự kiến được bao nhiêu điểm?',
  myConduct: () => 'Phiếu hạnh kiểm của tôi đợt này thế nào?',

  // ── gợi ý chỉ tiêu: đi đường điền form — agent chính tra số liệu + tài liệu tổ chức rồi gọi
  //    suggest_kpi_form, người dùng nhận thẻ "Đề xuất điền form" và bấm Điền ─────────────────────
  //    Câu chữ = ca F10 của run-form-fill.js: nêu rõ "đọc tài liệu + số liệu" để planner xếp
  //    get_org_documents trước — không nêu thì gợi ý là kiến thức chung của model.
  suggestKpis: (unit?: string | null) =>
    `Đọc mô tả công việc, chiến lược của tổ chức và số liệu KPI hiện có của${unit ? ` ${unit}` : ' đơn vị tôi'}, `
    + 'rồi gợi ý một chỉ tiêu KPI phù hợp và điền vào biểu mẫu này: tên, mô tả, mục tiêu, đơn vị tính, trọng số, tần suất',
} as const
