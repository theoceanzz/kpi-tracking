import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'
/**
 * Tám nhóm biểu đồ của thư viện "Thêm biểu đồ", theo đúng thứ tự muốn hiện.
 *
 * <p>Tách khỏi `DashboardCustomizeChrome` vì file đó chỉ được xuất component — xuất thêm hằng ở
 * đó là fast-refresh mất tác dụng cho cả file.
 */
export const CHART_CATEGORY_ORDER = perLanguage(() => ([
  i18n.t('shared:chartCategories.figures'),
  i18n.t('shared:chartCategories.comparisonCharts'),
  i18n.t('shared:chartCategories.correlationCharts'),
  i18n.t('shared:chartCategories.trendCharts'),
  i18n.t('shared:chartCategories.distributionCharts'),
  i18n.t('shared:chartCategories.partToWhole'),
  i18n.t('shared:chartCategories.flowCharts'),
  i18n.t('shared:chartCategories.rankingCharts'),
] as const))
