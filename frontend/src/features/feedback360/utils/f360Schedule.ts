import type { F360ScoringMode } from '../api/feedback360Api'
import i18n from 'i18next'

/**
 * Khung thời gian chiến dịch 360 bám theo kỳ KPI — cùng các mốc với backend `F360Schedule.java`
 * (backend chỉ kiểm tra biên; khoảng GỢI Ý tính ở đây để form tự điền ngay khi chọn kỳ).
 *
 * - Vào xếp loại: chạy CUỐI kỳ (KPI kết thúc → 360 → hiệu chỉnh → chốt). Gợi ý mở trước ngày cuối kỳ
 *   một khoảng bằng 1/4 kỳ (5–21 ngày), hạn = ngày cuối kỳ; được kéo tối đa 3 tuần sau kỳ.
 * - Chỉ để phát triển có gắn kỳ: gợi ý GIỮA kỳ, kéo 1/4 kỳ (5–14 ngày), nằm trọn trong kỳ.
 * - Không gắn kỳ: mở ngay, hạn sau 2 tuần.
 */

const DAY = 86_400_000
export const SCORING_TAIL_DAYS = 21

export interface CycleLike { startDate: string | null; endDate: string | null }
export interface Window { start: Date; due: Date; label: string }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const isScoring = (mode: F360ScoringMode) => mode !== 'DEVELOPMENT_ONLY'

/** Làm tròn lên giờ chẵn kế tiếp — ngày mở gợi ý không lẻ phút. */
function ceilHour(d: Date) {
  const r = new Date(d)
  if (r.getMinutes() || r.getSeconds() || r.getMilliseconds()) r.setHours(r.getHours() + 1, 0, 0, 0)
  return r
}
/** 08:00 cùng ngày (giờ máy người dùng). */
function morning(d: Date) {
  const r = new Date(d)
  r.setHours(8, 0, 0, 0)
  return r
}
/** 17:00 cùng ngày. */
function evening(d: Date) {
  const r = new Date(d)
  r.setHours(17, 0, 0, 0)
  return r
}

/** Khoảng được phép theo kỳ: [min, max]. Không gắn kỳ → null (không giới hạn). */
export function allowedRange(mode: F360ScoringMode, cycle: CycleLike | null | undefined) {
  if (!cycle?.startDate || !cycle.endDate) return null
  const min = new Date(cycle.startDate)
  const end = new Date(cycle.endDate)
  return { min, max: isScoring(mode) ? new Date(end.getTime() + SCORING_TAIL_DAYS * DAY) : end }
}

/**
 * Khoảng mở/hạn gợi ý, hoặc chuỗi lý do nếu kỳ không còn chỗ cho chế độ này (vd: 360 phát triển gắn
 * vào kỳ đã kết thúc).
 */
export function suggestWindow(mode: F360ScoringMode, cycle: CycleLike | null | undefined, now = new Date()): Window | string {
  const nowH = ceilHour(now)
  if (!cycle?.startDate || !cycle.endDate) {
    return { start: nowH, due: evening(new Date(nowH.getTime() + 14 * DAY)), label: i18n.t('feedback360:f360Schedule.openNowDueIn2Weeks') }
  }
  const cStart = new Date(cycle.startDate)
  const cEnd = new Date(cycle.endDate)
  const len = Math.max(DAY, cEnd.getTime() - cStart.getTime())

  if (isScoring(mode)) {
    const lead = clamp(len / 4, 5 * DAY, 21 * DAY)
    const latest = cEnd.getTime() + SCORING_TAIL_DAYS * DAY
    if (now.getTime() > latest - 3 * DAY) return i18n.t('feedback360:f360Schedule.thisCycleIsPastTheDeadline')
    const planned = morning(new Date(cEnd.getTime() - lead))
    const start = new Date(Math.max(planned.getTime(), cStart.getTime(), nowH.getTime()))
    let due = cEnd
    if (due.getTime() - start.getTime() < 3 * DAY) due = evening(new Date(Math.min(start.getTime() + lead, latest)))
    const weeks = Math.round(lead / (7 * DAY))
    return {
      start, due,
      label: start.getTime() === planned.getTime()
        ? i18n.t('feedback360:f360Schedule.endOfCycleDoneBeforeCalibration', { value: weeks >= 1 ? i18n.t('feedback360:f360Schedule.weeks', { count: weeks }) : i18n.t('feedback360:f360Schedule.days', { count: Math.round(lead / DAY) }) })
        : i18n.t('feedback360:f360Schedule.openNowSinceItIsThe'),
    }
  }

  const dur = clamp(len / 4, 5 * DAY, 14 * DAY)
  if (now.getTime() > cEnd.getTime() - DAY) {
    return i18n.t('feedback360:f360Schedule.theCycleHasEndedSoIn')
  }
  const planned = morning(new Date(cStart.getTime() + len / 2))
  const start = new Date(Math.max(planned.getTime(), nowH.getTime()))
  const due = new Date(Math.min(evening(new Date(start.getTime() + dur)).getTime(), cEnd.getTime()))
  return {
    start, due,
    label: start.getTime() === planned.getTime() ? i18n.t('feedback360:f360Schedule.midCycleForDevelopmentFeedback') : i18n.t('feedback360:f360Schedule.openNowEndWithinTheCycle'),
  }
}

/** Hạn đề cử gợi ý: 1/3 khoảng mở (1–5 ngày) sau ngày mở. */
export function suggestNominationDeadline(start: Date, due: Date) {
  const span = clamp((due.getTime() - start.getTime()) / 3, DAY, 5 * DAY)
  return evening(new Date(start.getTime() + span))
}

/** Lý do khung [start, due] không hợp lệ, hoặc null. Cùng luật với backend. */
export function windowProblem(mode: F360ScoringMode, cycle: CycleLike | null | undefined, start: Date | null, due: Date | null, now = new Date()) {
  if (!start || !due) return i18n.t('feedback360:f360Schedule.chooseTheStartDateAndThe')
  if (start.getTime() >= due.getTime()) return i18n.t('feedback360:f360Schedule.theStartDateMustBeBefore')
  if (due.getTime() <= now.getTime()) return i18n.t('feedback360:f360Schedule.theEvaluationDeadlineMustBeIn')
  const range = allowedRange(mode, cycle)
  if (range) {
    if (start < range.min) return i18n.t('feedback360:f360Schedule.theStartDateMustBeWithin')
    if (due > range.max) {
      return isScoring(mode)
        ? i18n.t('feedback360:f360Schedule.aCampaignThatCountsTowardRating')
        : i18n.t('feedback360:f360Schedule.aDevelopmentOnlyCampaignMustEnd')
    }
  }
  return null
}
