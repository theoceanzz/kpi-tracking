// Một bộ tiêu chí có thể gắn NHIỀU đợt, hoặc gắn cả một KỲ (mọi đợt trong kỳ).
// Backend đã quy đổi cả hai về danh sách `periods` khi trả response, nên phía client
// chỉ cần soi danh sách đó thay vì so một trường kỳ duy nhất như trước.

type PeriodScoped = { periods?: { id: string }[] | null }

/** Bộ tiêu chí này có áp dụng cho đợt `periodId` không. */
export const scorecardAppliesToPeriod = (sc: PeriodScoped, periodId?: string | null): boolean =>
  !!periodId && (sc.periods || []).some(p => p.id === periodId)

/** Lọc các bộ tiêu chí áp dụng cho một đợt. */
export const scorecardsForPeriod = <T extends PeriodScoped>(scorecards: T[] | undefined, periodId?: string | null): T[] =>
  !periodId ? [] : (scorecards || []).filter(sc => scorecardAppliesToPeriod(sc, periodId))
