import { OrganizationResponse } from '@/features/orgunits/api/organizationApi'

export function getScoringFunctions(org?: OrganizationResponse | null) {
  const maxScore = org?.evaluationMaxScore ?? 100
  
  // Sort levels by threshold descending to check from highest to lowest
  const defaultLevels = [
    { name: 'XUẤT SẮC', threshold: 90, color: '#10b981' },
    { name: 'TỐT', threshold: 80, color: '#3b82f6' },
    { name: 'KHÁ', threshold: 70, color: '#f59e0b' },
    { name: 'TRUNG BÌNH', threshold: 50, color: '#6366f1' },
    { name: 'YẾU', threshold: 0, color: '#ef4444' },
  ]
  const levels = org?.evaluationLevels?.length 
    ? [...org.evaluationLevels].sort((a, b) => b.threshold - a.threshold)
    : defaultLevels

  const getScoreLevel = (score: number | null) => {
    if (score == null) return null
    return levels.find(l => score >= l.threshold)
  }

  const getScoreColor = (score: number | null) => {
    if (score == null) return 'text-slate-400'
    const level = getScoreLevel(score)
    if (!level) return 'text-rose-600 dark:text-rose-400'
    
    // If color is a hex, we might need inline style, but for now map common ones or use default
    if (level.color?.startsWith('#')) {
       // Return a dummy class or we handle it in components. 
       // For simplicity, let's stick to a set of predefined colors if hex matches
       const hex = level.color.toLowerCase()
       if (hex === '#10b981') return 'text-emerald-600 dark:text-emerald-400'
       if (hex === '#3b82f6') return 'text-blue-600 dark:text-blue-400'
       if (hex === '#f59e0b') return 'text-amber-600 dark:text-amber-400'
       if (hex === '#6366f1') return 'text-indigo-600 dark:text-indigo-400'
       if (hex === '#ef4444') return 'text-rose-600 dark:text-rose-400'
    }
    
    return 'text-[var(--color-primary)]'
  }

  const getScoreBg = (score: number | null) => {
    if (score == null) return 'bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700'
    const level = getScoreLevel(score)
    if (!level) return 'bg-rose-50 border-rose-100 dark:bg-rose-900/20 dark:border-rose-900/40'
    
    if (level.color?.startsWith('#')) {
       const hex = level.color.toLowerCase()
       if (hex === '#10b981') return 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/40'
       if (hex === '#3b82f6') return 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-900/40'
       if (hex === '#f59e0b') return 'bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/40'
       if (hex === '#6366f1') return 'bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-900/40'
       if (hex === '#ef4444') return 'bg-rose-50 border-rose-100 dark:bg-rose-900/20 dark:border-rose-900/40'
    }

    return 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20'
  }

  const getScoreLabel = (score: number | null) => {
    if (score == null) return 'Chưa chấm'
    const level = getScoreLevel(score)
    return level ? level.name : 'Không đạt'
  }

  return { getScoreColor, getScoreBg, getScoreLabel, maxScore, levels }
}

/**
 * Tổ chức có dùng MA TRẬN xếp loại hay không.
 *
 * Ma trận cần ĐỦ HAI TRỤC — điểm hành vi (hàng) và % hoàn thành KPI (cột) — mà một loại
 * KPI chỉ cấp được MỘT trục. Tổ chức đủ hai trục khi:
 * 1. bật KPI định tính ⇒ có cả hai loại KPI (định lượng ở cột, định tính ở hàng); hoặc
 * 2. bật chấm hạnh kiểm ⇒ điểm hạnh kiểm bù đúng trục còn trống.
 *
 * Đây là cờ cấp TỔ CHỨC để mở/ẩn màn hình. Từng người trong từng đợt vẫn có thể thiếu
 * trục (vd chỉ có KPI định tính mà tổ chức không chấm hạnh kiểm) — khi đó người đó không
 * có xếp loại, chứ hệ thống không bịa trục để ép ra hạng.
 */
export function usesPerformanceMatrix(
  org?: { enableQualitative?: boolean; enableConduct?: boolean } | null
): boolean {
  return !!(org?.enableQualitative || org?.enableConduct)
}
