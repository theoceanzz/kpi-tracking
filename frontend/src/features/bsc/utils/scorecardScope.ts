// Một bộ tiêu chí có thể gắn NHIỀU đợt, hoặc gắn cả một KỲ (mọi đợt trong kỳ).
// Backend đã quy đổi cả hai về danh sách `periods` khi trả response, nên phía client
// chỉ cần soi danh sách đó thay vì so một trường kỳ duy nhất như trước.

type PeriodScoped = { periods?: { id: string }[] | null; status?: string | null }

/**
 * Bộ ĐÃ DUYỆT mới chấm điểm (và mới bắt KPI gắn hạng mục) — cùng luật với backend
 * `BscScorecardStatus.isScoring`. Nháp / chờ duyệt (kể cả thẻ phân rã tự sinh) và thẻ đã đóng thì
 * chưa. `APPROVED` là trạng thái cũ, vẫn tính là đang chấm.
 */
export const isScoringScorecard = (sc: PeriodScoped) =>
  !sc.status || sc.status === 'ACTIVE' || sc.status === 'APPROVED'

/** Bộ tiêu chí này có áp dụng cho đợt `periodId` không. */
export const scorecardAppliesToPeriod = (sc: PeriodScoped, periodId?: string | null): boolean =>
  !!periodId && (sc.periods || []).some(p => p.id === periodId)

/** Lọc các bộ tiêu chí ĐANG CHẤM ĐIỂM cho một đợt (bỏ bộ nháp / chờ duyệt / đã đóng). */
export const scorecardsForPeriod = <T extends PeriodScoped>(scorecards: T[] | undefined, periodId?: string | null): T[] =>
  !periodId ? [] : (scorecards || []).filter(sc => isScoringScorecard(sc) && scorecardAppliesToPeriod(sc, periodId))
