import { SERIES_COLORS, seriesColor } from '@/components/charts/chartPalette'

/**
 * Giải TOKEN màu do trợ lý chọn ra mã màu thật.
 *
 * <p>Backend chỉ trả token (`series:0`, `success`…) chứ không trả hex: màu ngữ nghĩa và màu chủ đạo
 * đổi theo theme sáng/tối và theo màu tổ chức chọn, nên một mã hex cố định từ model sẽ sai ngay ở
 * chế độ tối. Token của chuỗi lấy thẳng bảng `chartPalette`; token ngữ nghĩa đọc biến CSS đang hiệu lực.
 */
const CSS_VAR: Record<string, string> = {
  success: '--color-success-solid',
  warning: '--color-warning-solid',
  error: '--color-error-solid',
  info: '--color-info-solid',
  primary: '--color-primary',
  ai: '--color-ai-solid',
  neutral: '--color-subtle-foreground',
}

/** Màu dự phòng khi chạy ngoài trình duyệt (test) hoặc biến CSS chưa có giá trị. */
const FALLBACK: Record<string, string> = {
  success: '#047857',
  warning: '#b45309',
  error: '#b91c1c',
  info: '#1d4ed8',
  primary: '#4f46e5',
  ai: '#7c3aed',
  neutral: '#94a3b8',
}

export function resolveColorToken(token: string | undefined, index = 0): string {
  if (!token) return seriesColor(index)
  if (token.startsWith('series:')) {
    const i = Number(token.slice('series:'.length))
    return Number.isFinite(i) ? (SERIES_COLORS[Math.abs(i) % SERIES_COLORS.length] ?? seriesColor(index)) : seriesColor(index)
  }
  const cssVar = CSS_VAR[token]
  if (!cssVar) return seriesColor(index)
  const fallback = FALLBACK[token] ?? seriesColor(index)
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
  return value || fallback
}
