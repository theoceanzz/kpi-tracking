import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3 } from 'lucide-react'
import { usePageTitle } from '@/features/organization/hooks/usePageTitle'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { useTourScope } from '@/hooks/useTourScope'
import { tourAnchor } from '@/components/common/tours/anchors'
import type { DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import DashboardCustomizeChrome, { DashboardEditToolbar } from '@/components/common/dashboard/DashboardCustomizeChrome'
import type { ChartShape } from '@/components/charts/ChartTypePreview'
import {
  useAnalyticsGrid, useAnalyticsScopeData, useUnitOptions, usePositionLayout,
  PAGE_DEFAULT_INTENT, type OptionField,
} from '../grid/analyticsGrid'
import { usePinToHome } from '../grid/usePinToHome'
import WidgetConfigPanel from '../grid/WidgetConfigPanel'
import WidgetConfigSummary from '../grid/WidgetConfigSummary'
import { useStatsTier } from '../hooks/useStatsTier'
import AiShortcutButton from '../../ai/chat/components/AiShortcutButton'
import { aiShortcuts } from '../../ai/chat/aiShortcuts'

import LeaderboardPack, {
  LEADERBOARD_WIDGETS, LEADERBOARD_POSITION_LAYOUT, LEADERBOARD_GROUP_OF, LEADERBOARD_PREVIEW_OF,
  LEADERBOARD_DESC_OF, useLeaderboardExtraFields,
} from './LeaderboardPack'
import SummaryPack, {
  SUMMARY_WIDGETS, SUMMARY_GROUP_OF, SUMMARY_PREVIEW_OF, SUMMARY_DESC_OF,
} from './SummaryTab'
import DrillPack, {
  DRILL_GROUP_OF, DRILL_PREVIEW_OF, DRILL_DESC_OF, useDrillAllowedWidgets, useDrillExtraFields,
} from './DrillDownTab'
import BscPack, {
  BSC_WIDGETS, BSC_GROUP_OF, BSC_PREVIEW_OF, BSC_DESC_OF,
} from './BscAnalyticsTab'
import MyKpiPack, {
  MYKPI_WIDGETS, MYKPI_GROUP_OF, MYKPI_PREVIEW_OF, MYKPI_DESC_OF, MYKPI_POSITION_LAYOUT,
} from './MyStatsTab'
import MyObjectivesPack, {
  MYOBJ_WIDGETS, MYOBJ_GROUP_OF, MYOBJ_PREVIEW_OF, MYOBJ_DESC_OF, MYOBJ_POSITION_LAYOUT,
} from './MyObjectivesTab'
import SubordinatePack, {
  SUB_WIDGETS, SUB_GROUP_OF, SUB_PREVIEW_OF, SUB_DESC_OF,
} from './SubordinateManagementTab'

/**
 * Thống kê — MỘT trang, MỘT lưới.
 *
 * <p>Trước đây trang này là sáu mục rời, và vào trang thì thấy lưới thẻ chọn mục chứ không thấy số
 * liệu: phải bấm thêm một lần nữa mới có biểu đồ đầu tiên. Nay mở ra là thấy ngay ba bảng trả lời
 * ba câu hỏi đầu tiên của người quản lý — ai dẫn đầu, đơn vị nào dẫn đầu, chỗ nào tụt ở đợt nào.
 *
 * <p>42 ô còn lại vẫn đủ nhưng ẩn mặc định, bật trong "Thêm biểu đồ". Bày hết ra một lúc thì không
 * ai đọc cái nào.
 *
 * <p>Mỗi CỤM ô vẫn giữ tệp riêng và chỉ vẽ ô mà lưới hỏi tới (xem `grid/widgetPack.ts`). Cụm nào
 * không có ô nào đang hiện thì không được gắn lần nào, nên ẩn hết ô BSC là không còn lời gọi BSC.
 */
export default function AnalyticsPage() {
  const { t } = useTranslation('analytics')
  const { user } = useAuthStore()
  const pageTitle = usePageTitle('analytics', t('AnalyticsPage.statistics'))
  useTourScope('analytics', null)

  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: org, isLoading: loadingOrg } = useOrganization(organizationId)
  const isOkr = org?.enableOkr ?? false
  const isBsc = org?.enableBsc ?? false

  const { hasPermission } = useHasPermission()
  const { allows } = useStatsTier()
  const { periods, cycles } = useAnalyticsScopeData()
  const unitOptions = useUnitOptions()
  const drillWidgets = useDrillAllowedWidgets()
  const drillExtraFields = useDrillExtraFields(cycles)
  const leaderboardExtraFields = useLeaderboardExtraFields(cycles)
  const pin = usePinToHome()
  const pageIntent = PAGE_DEFAULT_INTENT

  /*
    Lọc ô theo quyền/cờ NGAY lần render đầu: `hydrate` của lưới chỉ chạy một lần cho mỗi scope, nên
    danh sách ô khả dụng phải đúng từ đầu — thêm ô sau đó thì lưới đã chốt bố cục rồi.

    Sáu bộ gác từng thuộc về sáu tab nay dồn vào một trang; sót một điều kiện là nhân viên nhìn thấy
    ô của giám đốc (backend vẫn chặn, nhưng ô sẽ hiện lỗi thay vì biến mất).
  */
  const canSubmit = hasPermission(['SUBMISSION:CREATE'])
  const canManageUnit = hasPermission(['KPI:VIEW', 'SUBMISSION:REVIEW'])
  const canBsc = hasPermission(['BSC:MANAGE'])
  const allWidgets = useMemo(() => {
    const packs: DashboardWidget[][] = []
    if (allows('UNIT')) packs.push(LEADERBOARD_WIDGETS())
    if (canManageUnit) packs.push(isOkr ? SUB_WIDGETS() : SUMMARY_WIDGETS())
    packs.push(drillWidgets)
    if (canBsc && isBsc) packs.push(BSC_WIDGETS())
    if (canSubmit) packs.push(isOkr ? MYOBJ_WIDGETS() : MYKPI_WIDGETS())
    // Chỉ ba ô mở đầu hiện sẵn; phần còn lại nằm trong thư viện.
    return packs.flat().map(w => (LEADERBOARD_IDS.has(w.i) ? w : { ...w, visible: false }))
  }, [allows, canManageUnit, canBsc, canSubmit, isOkr, isBsc, drillWidgets])

  const catalog = useMemo(() => {
    const group = { ...LEADERBOARD_GROUP_OF(), ...SUMMARY_GROUP_OF(), ...DRILL_GROUP_OF(), ...BSC_GROUP_OF(), ...MYKPI_GROUP_OF(), ...MYOBJ_GROUP_OF(), ...SUB_GROUP_OF() }
    const preview = { ...LEADERBOARD_PREVIEW_OF, ...SUMMARY_PREVIEW_OF, ...DRILL_PREVIEW_OF, ...BSC_PREVIEW_OF, ...MYKPI_PREVIEW_OF, ...MYOBJ_PREVIEW_OF, ...SUB_PREVIEW_OF }
    const desc = { ...LEADERBOARD_DESC_OF(), ...SUMMARY_DESC_OF(), ...DRILL_DESC_OF(), ...BSC_DESC_OF(), ...MYKPI_DESC_OF(), ...MYOBJ_DESC_OF(), ...SUB_DESC_OF() }
    return allWidgets.map(w => ({
      template: w, icon: null, groupLabel: group[w.i], preview: preview[w.i] as ChartShape, description: desc[w.i],
    }))
  }, [allWidgets])

  /*
    Ba ô xếp hạng là bộ mặc định — NHƯNG chỉ cho người được xem số của người khác. Nhân viên (cấp
    SELF) không có ô nào trong bộ đó, mở trang ra là một lưới trắng; họ rơi về bộ "của tôi".
  */
  const positionLayout = allows('UNIT') ? LEADERBOARD_POSITION_LAYOUT
    : isOkr ? MYOBJ_POSITION_LAYOUT : MYKPI_POSITION_LAYOUT
  const grid = usePositionLayout(allWidgets, positionLayout, 'DIRECTOR')
  const dash = useAnalyticsGrid({ scope: 'ANALYTICS', defaultWidgets: grid.defaultWidgets })
  const { updateWidgetSettings, widgets } = dash

  const extraFieldsOf = useCallback(
    (i: string): OptionField[] | undefined => leaderboardExtraFields(i) ?? drillExtraFields(i),
    [leaderboardExtraFields, drillExtraFields],
  )

  /*
    `useCallback` là bắt buộc chứ không phải tối ưu tuỳ hứng: lưới cache phần tử từng ô theo định
    danh hàm này. Hàm mới mỗi render là mọi biểu đồ vẽ lại mỗi lần trang render.
  */
  const renderWidget = useCallback((w: DashboardWidget, ctx: { openConfig: () => void }) => {
    const Pack = packOf(w.i)
    if (!Pack) return null
    const meta = (
      <WidgetConfigSummary
        widget={w} pageIntent={pageIntent} periods={periods} cycles={cycles}
        unitOptions={unitOptions} extraFields={extraFieldsOf(w.i)} onOpen={ctx.openConfig}
      />
    )
    return (
      <Pack
        widget={w} meta={meta} openConfig={ctx.openConfig}
        pageIntent={pageIntent} periods={periods} cycles={cycles}
        unitOptions={unitOptions} widgets={widgets} updateWidgetSettings={updateWidgetSettings}
      />
    )
  }, [pageIntent, periods, cycles, unitOptions, widgets, updateWidgetSettings, extraFieldsOf])

  // Chờ cờ tính năng rồi mới vẽ: dựng lưới bằng giá trị mặc định sẽ hiện nhầm bộ ô rồi nháy sang
  // bộ khác ngay sau đó, và `hydrate` đã chốt bố cục theo bộ sai mất rồi.
  if (loadingOrg) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 md:px-0 pb-20 space-y-8 animate-pulse">
        <div className="h-9 w-48 bg-[var(--color-muted)] rounded-lg" />
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {[1, 2].map(i => <div key={i} className="h-80 bg-[var(--color-muted)] rounded-2xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-0 pb-20 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-foreground)] flex items-center gap-2">
            <BarChart3 size={20} className="text-slate-400" /> {pageTitle}
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">{t('AnalyticsPage.pickMoreCharts')}</p>
        </div>
        <div id="tour-analytics-customize" {...tourAnchor('analytics.toolbar')} className="flex items-center gap-3 flex-wrap">
          {/* Hai tab cũ mỗi tab một nút AI; gộp trang thì còn một nút, hỏi đúng câu hay hỏi nhất. */}
          <AiShortcutButton
            {...tourAnchor('analytics.ai')} size="sm"
            label={t('AnalyticsPage.rankChanges')} prompt={aiShortcuts.rankDelta()}
            title={t('AnalyticsPage.kAiComparesRanks')}
          />
          <DashboardEditToolbar api={dash} />
        </div>
      </div>

      <div id="tour-analytics-widgets">
        <DashboardCustomizeChrome
          api={dash}
          renderWidget={renderWidget}
          catalog={catalog}
          presets={grid.presets}
          recommendedIds={grid.recommendedIds}
          recommendedLabel={grid.recommendedLabel}
          onTogglePin={pin.enabled ? pin.toggle : undefined}
          isPinned={pin.isPinned}
          renderConfig={(w, update) => (
            <WidgetConfigPanel
              widget={w} update={update} pageIntent={pageIntent} periods={periods} cycles={cycles}
              unitOptions={unitOptions} extraFields={extraFieldsOf(w.i)}
            />
          )}
        />
      </div>
    </div>
  )
}

/* ── Ô nào thuộc cụm nào ──────────────────────────────────────────────────── */

const LEADERBOARD_IDS = new Set(['rank-people', 'rank-units', 'heatmap-units'])

/**
 * Tra theo DANH SÁCH id chứ không theo tiền tố: `rank-table` là ô cũ của cụm Tổng quan còn
 * `rank-people` là ô mới — cùng tiền tố `rank-`, khác cụm.
 */
function packOf(i: string) {
  if (LEADERBOARD_IDS.has(i)) return LeaderboardPack
  if (i.startsWith('bsc-')) return BscPack
  if (i.startsWith('drill-')) return DrillPack
  if (i.startsWith('sub-')) return SubordinatePack
  if (i.startsWith('mykpi-')) return MyKpiPack
  if (i.startsWith('myobj-')) return MyObjectivesPack
  return SummaryPack
}
