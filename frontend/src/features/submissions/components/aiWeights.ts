import type { AiReviewSettings } from '../api/aiReviewApi'

/** Ba trọng số của điểm AI gợi ý (%, tổng phải 100). */
export type AiWeights = Pick<AiReviewSettings, 'weightTarget' | 'weightQuality' | 'weightOnTime'>

export function weightTotal(w: AiWeights) {
  return w.weightTarget + w.weightQuality + w.weightOnTime
}
