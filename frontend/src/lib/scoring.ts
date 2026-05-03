import { OrganizationResponse } from '@/features/orgunits/api/organizationApi'

export function getScoringFunctions(org?: OrganizationResponse | null) {
  const maxScore = org?.evaluationMaxScore ?? 100
  const excellent = org?.excellentThreshold ?? 90
  const good = org?.goodThreshold ?? 70
  const fair = org?.fairThreshold ?? 50

  const getScoreColor = (score: number | null) => {
    if (score == null) return 'text-slate-400'
    if (score >= excellent) return 'text-emerald-600 dark:text-emerald-400'
    if (score >= good) return 'text-blue-600 dark:text-blue-400'
    if (score >= fair) return 'text-amber-600 dark:text-amber-400'
    return 'text-rose-600 dark:text-rose-400'
  }

  const getScoreBg = (score: number | null) => {
    if (score == null) return 'bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700'
    if (score >= excellent) return 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/40'
    if (score >= good) return 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-900/40'
    if (score >= fair) return 'bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/40'
    return 'bg-rose-50 border-rose-100 dark:bg-rose-900/20 dark:border-rose-900/40'
  }

  const getScoreLabel = (score: number | null) => {
    if (score == null) return 'Chưa chấm'
    if (score >= excellent) return 'Xuất sắc'
    if (score >= good) return 'Tốt'
    if (score >= fair) return 'Đạt'
    return 'Cần cải thiện'
  }

  return { getScoreColor, getScoreBg, getScoreLabel, maxScore }
}
