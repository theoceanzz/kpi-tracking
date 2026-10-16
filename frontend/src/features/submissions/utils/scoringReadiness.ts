import type { TFunction } from 'i18next'
import type { ScoringReadiness } from '@/types/evaluation'

/**
 * Vì sao quản lý chưa chấm được người này — luật nằm ở backend (EvaluationReadinessService),
 * đây chỉ dựng câu từ kết quả. Trả rỗng khi đã chấm được.
 */
export function scoringBlockReasons(r: ScoringReadiness | null | undefined, t: TFunction): string[] {
  if (!r || r.ready) return []
  if (r.requiredKpiCount === 0) return [t('submissions:ScoringReadiness.noKpi')]
  const reasons: string[] = []
  if (r.missingKpiNames.length > 0) {
    reasons.push(t('submissions:ScoringReadiness.submitted', { submitted: r.submittedKpiCount, required: r.requiredKpiCount }))
  }
  if (r.selfEvaluationRequired && !r.selfEvaluated) reasons.push(t('submissions:ScoringReadiness.selfEvalMissing'))
  return reasons
}
